/**
 * Fun Profile SSO SDK - Type Definitions
 */

// Client configuration
export interface FunProfileConfig {
  clientId: string;
  clientSecret?: string;
  redirectUri: string;
  baseUrl?: string;
  scopes?: string[];
  storage?: TokenStorage;
  autoRefresh?: boolean;
}

// Token storage interface
export interface TokenStorage {
  getTokens(): Promise<TokenData | null>;
  setTokens(tokens: TokenData): Promise<void>;
  clearTokens(): Promise<void>;
}

// OAuth tokens
export interface TokenData {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scope: string[];
}

// User profile
export interface FunUser {
  id: string;
  funId: string;
  username: string;
  fullName?: string;
  avatarUrl?: string;
  email?: string;
  walletAddress?: string;
  externalWalletAddress?: string;
  soul?: SoulNft;
  rewards?: UserRewards;
}

export interface SoulNft {
  element: string;
  level: number;
  tokenId?: string;
  mintedAt?: string;
}

export interface UserRewards {
  pending: number;
  approved: number;
  claimed: number;
  status: string;
}

// Registration options
export interface RegisterOptions {
  email?: string;
  phone?: string;
  username?: string;
  fullName?: string;
  avatarUrl?: string;
  platformData?: Record<string, unknown>;
}

// Sync options
export interface SyncOptions {
  mode: 'merge' | 'replace' | 'append';
  data: Record<string, unknown>;
  categories?: string[];
  clientTimestamp?: string;
}

// Response types
export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  scope: string;
  user: FunUser;
  isNewUser?: boolean;
}

export interface SyncResult {
  success: boolean;
  syncedAt: string;
  syncMode: string;
  syncCount: number;
  categoriesUpdated: string[];
  dataSize: number;
}

// Request options
export interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: Record<string, unknown>;
}

// Error types
export interface SSOError {
  error: string;
  errorDescription: string;
  details?: Record<string, unknown>;
}
