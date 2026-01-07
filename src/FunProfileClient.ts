/**
 * Fun Profile SSO SDK - Main Client
 * 
 * Core client for OAuth 2.0 + PKCE authentication with Fun Profile.
 */

import type {
  FunProfileConfig,
  TokenStorage,
  TokenData,
  FunUser,
  RegisterOptions,
  SyncOptions,
  AuthResult,
  SyncResult,
  RequestOptions,
} from './types';

import {
  FunProfileError,
  TokenExpiredError,
  InvalidTokenError,
  RateLimitError,
  ValidationError,
  NetworkError,
} from './errors';

import {
  DEFAULT_BASE_URL,
  ENDPOINTS,
  DEFAULT_SCOPES,
  TOKEN_REFRESH_BUFFER,
} from './constants';

import {
  generateCodeVerifier,
  generateCodeChallenge,
  storeCodeVerifier,
  retrieveCodeVerifier,
} from './pkce';

import { LocalStorageAdapter } from './storage';
import { DebouncedSyncManager } from './sync-manager';

export class FunProfileClient {
  private config: Required<Omit<FunProfileConfig, 'clientSecret'>> & { clientSecret?: string };
  private storage: TokenStorage;
  private currentUser: FunUser | null = null;
  private syncManager: DebouncedSyncManager | null = null;

  constructor(config: FunProfileConfig) {
    this.config = {
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      redirectUri: config.redirectUri,
      baseUrl: config.baseUrl || DEFAULT_BASE_URL,
      scopes: config.scopes || DEFAULT_SCOPES,
      storage: config.storage || new LocalStorageAdapter(config.clientId),
      autoRefresh: config.autoRefresh !== false,
    };
    this.storage = this.config.storage;
  }

  // ============================================
  // Authentication Methods
  // ============================================

  /**
   * Start OAuth 2.0 + PKCE authorization flow
   * @returns Authorization URL to redirect user to
   */
  async startAuth(options?: { prompt?: 'login' | 'consent' | 'none' }): Promise<string> {
    const state = this.generateState();
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);

    // Store verifier for callback
    storeCodeVerifier(codeVerifier, state);

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: this.config.scopes.join(' '),
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    if (options?.prompt) {
      params.set('prompt', options.prompt);
    }

    return `${this.config.baseUrl}${ENDPOINTS.authorize}?${params.toString()}`;
  }

  /**
   * Handle OAuth callback and exchange code for tokens
   */
  async handleCallback(code: string, state: string): Promise<AuthResult> {
    const codeVerifier = retrieveCodeVerifier(state);
    if (!codeVerifier) {
      throw new ValidationError('Invalid state parameter - possible CSRF attack');
    }

    const response = await this.request(ENDPOINTS.token, {
      method: 'POST',
      body: {
        grant_type: 'authorization_code',
        code,
        redirect_uri: this.config.redirectUri,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        code_verifier: codeVerifier,
      },
    });

    return this.handleTokenResponse(response);
  }

  /**
   * Register a new user via the platform
   */
  async register(options: RegisterOptions): Promise<AuthResult> {
    const response = await this.request(ENDPOINTS.register, {
      method: 'POST',
      body: {
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        ...options,
      },
    });

    return this.handleTokenResponse(response);
  }

  /**
   * Logout and revoke tokens
   */
  async logout(): Promise<void> {
    // Flush any pending sync data first
    if (this.syncManager?.hasPendingData()) {
      try {
        await this.syncManager.flush();
      } catch {
        // Ignore sync errors on logout
      }
    }

    const tokens = await this.storage.getTokens();
    if (tokens) {
      try {
        await this.request(ENDPOINTS.revoke, {
          method: 'POST',
          body: {
            token: tokens.accessToken,
            client_id: this.config.clientId,
          },
        });
      } catch {
        // Ignore revoke errors
      }
    }

    await this.storage.clearTokens();
    this.currentUser = null;
    this.syncManager?.clear();
  }

  // ============================================
  // Sync Manager
  // ============================================

  /**
   * Get debounced sync manager for efficient data synchronization
   * @param debounceMs - Debounce time in milliseconds (default: 3000)
   */
  getSyncManager(debounceMs = 3000): DebouncedSyncManager {
    if (!this.syncManager) {
      this.syncManager = new DebouncedSyncManager(
        async (data) => {
          await this.syncData({
            mode: 'merge',
            data,
            clientTimestamp: new Date().toISOString(),
          });
        },
        debounceMs
      );
    }
    return this.syncManager;
  }

  // ============================================
  // User Data Methods
  // ============================================

  /**
   * Get current user profile
   */
  async getUser(): Promise<FunUser> {
    const response = await this.authenticatedRequest(ENDPOINTS.verify, {
      method: 'GET',
    });

    this.currentUser = this.transformUser(response.user);
    return this.currentUser;
  }

  /**
   * Get cached user (no API call)
   */
  getCachedUser(): FunUser | null {
    return this.currentUser;
  }

  /**
   * Sync platform data to Fun Profile
   */
  async syncData(options: SyncOptions): Promise<SyncResult> {
    const response = await this.authenticatedRequest(ENDPOINTS.syncData, {
      method: 'POST',
      body: {
        sync_mode: options.mode,
        platform_data: options.data,
        categories: options.categories,
        client_timestamp: options.clientTimestamp || new Date().toISOString(),
      },
    });

    return {
      success: response.success,
      syncedAt: response.synced_at,
      syncMode: response.sync_mode,
      syncCount: response.sync_count,
      categoriesUpdated: response.categories_updated,
      dataSize: response.data_size,
    };
  }

  // ============================================
  // Token Management
  // ============================================

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    const tokens = await this.storage.getTokens();
    if (!tokens) return false;

    // Check if token is expired
    if (Date.now() >= tokens.expiresAt - TOKEN_REFRESH_BUFFER) {
      if (this.config.autoRefresh) {
        try {
          await this.refreshTokens();
          return true;
        } catch {
          return false;
        }
      }
      return false;
    }

    return true;
  }

  /**
   * Get current access token
   */
  async getAccessToken(): Promise<string | null> {
    const tokens = await this.storage.getTokens();
    if (!tokens) return null;

    // Auto-refresh if needed
    if (Date.now() >= tokens.expiresAt - TOKEN_REFRESH_BUFFER) {
      if (this.config.autoRefresh) {
        const newTokens = await this.refreshTokens();
        return newTokens.accessToken;
      }
      throw new TokenExpiredError();
    }

    return tokens.accessToken;
  }

  /**
   * Get raw token data
   */
  async getTokens(): Promise<TokenData | null> {
    return this.storage.getTokens();
  }

  /**
   * Manually refresh tokens
   */
  async refreshTokens(): Promise<TokenData> {
    const tokens = await this.storage.getTokens();
    if (!tokens) {
      throw new InvalidTokenError('No tokens available');
    }

    const response = await this.request(ENDPOINTS.refresh, {
      method: 'POST',
      body: {
        grant_type: 'refresh_token',
        refresh_token: tokens.refreshToken,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
      },
    });

    const newTokens: TokenData = {
      accessToken: response.access_token,
      refreshToken: response.refresh_token || tokens.refreshToken,
      expiresAt: Date.now() + response.expires_in * 1000,
      scope: response.scope?.split(' ') || tokens.scope,
    };

    await this.storage.setTokens(newTokens);
    return newTokens;
  }

  // ============================================
  // Private Helpers
  // ============================================

  private async handleTokenResponse(response: Record<string, unknown>): Promise<AuthResult> {
    const tokens: TokenData = {
      accessToken: response.access_token as string,
      refreshToken: response.refresh_token as string,
      expiresAt: Date.now() + (response.expires_in as number) * 1000,
      scope: ((response.scope as string) || '').split(' '),
    };

    await this.storage.setTokens(tokens);

    if (response.user) {
      this.currentUser = this.transformUser(response.user as Record<string, unknown>);
    }

    return this.transformAuthResult(response, tokens);
  }

  private transformAuthResult(response: Record<string, unknown>, tokens: TokenData): AuthResult {
    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: Math.floor((tokens.expiresAt - Date.now()) / 1000),
      scope: tokens.scope.join(' '),
      user: this.currentUser!,
      isNewUser: response.is_new_user as boolean | undefined,
    };
  }

  private transformUser(data: Record<string, unknown>): FunUser {
    return {
      id: data.id as string,
      funId: data.fun_id as string,
      username: data.username as string,
      fullName: data.full_name as string | undefined,
      avatarUrl: data.avatar_url as string | undefined,
      email: data.email as string | undefined,
      walletAddress: data.wallet_address as string | undefined,
      externalWalletAddress: data.external_wallet_address as string | undefined,
      soul: data.soul_nft ? {
        element: (data.soul_nft as Record<string, unknown>).soul_element as string,
        level: (data.soul_nft as Record<string, unknown>).soul_level as number,
        tokenId: (data.soul_nft as Record<string, unknown>).token_id as string | undefined,
        mintedAt: (data.soul_nft as Record<string, unknown>).minted_at as string | undefined,
      } : undefined,
      rewards: data.rewards ? {
        pending: (data.rewards as Record<string, unknown>).pending as number,
        approved: (data.rewards as Record<string, unknown>).approved as number,
        claimed: (data.rewards as Record<string, unknown>).claimed as number,
        status: (data.rewards as Record<string, unknown>).status as string,
      } : undefined,
    };
  }

  private generateState(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, (x) => x.toString(16).padStart(2, '0')).join('');
  }

  private async request(
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<Record<string, unknown>> {
    const url = `${this.config.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    try {
      const response = await fetch(url, {
        method: options.method || 'GET',
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
      });

      if (!response.ok) {
        await this.handleError(response);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof FunProfileError) {
        throw error;
      }
      throw new NetworkError((error as Error).message);
    }
  }

  private async authenticatedRequest(
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<Record<string, unknown>> {
    const accessToken = await this.getAccessToken();
    if (!accessToken) {
      throw new InvalidTokenError('Not authenticated');
    }

    return this.request(endpoint, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${accessToken}`,
      },
    });
  }

  private async handleError(response: Response): Promise<never> {
    const contentType = response.headers.get('content-type');
    let errorData: Record<string, unknown> = {};

    if (contentType?.includes('application/json')) {
      try {
        errorData = await response.json();
      } catch {
        // Ignore JSON parse errors
      }
    }

    switch (response.status) {
      case 401:
        throw new InvalidTokenError(errorData.error_description as string);
      case 429: {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '60', 10);
        throw new RateLimitError(retryAfter);
      }
      case 400:
        throw new ValidationError(
          (errorData.error_description as string) || 'Validation failed',
          errorData.details as Record<string, unknown>
        );
      default:
        throw new FunProfileError(
          (errorData.error as string) || 'unknown_error',
          (errorData.error_description as string) || `Request failed with status ${response.status}`,
          errorData.details as Record<string, unknown>
        );
    }
  }
}
