# API Reference

## FunProfileClient

Main client class for SSO authentication and data synchronization.

### Constructor

```typescript
new FunProfileClient(config: FunProfileConfig)
```

#### FunProfileConfig

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `clientId` | `string` | ✅ | - | OAuth client ID |
| `clientSecret` | `string` | ❌ | - | OAuth client secret (for confidential clients) |
| `redirectUri` | `string` | ✅ | - | OAuth redirect URI |
| `baseUrl` | `string` | ❌ | Fun Profile API | SSO API base URL |
| `scopes` | `string[]` | ❌ | `['profile']` | Requested OAuth scopes |
| `storage` | `TokenStorage` | ❌ | `LocalStorageAdapter` | Token storage adapter |
| `autoRefresh` | `boolean` | ❌ | `true` | Auto-refresh expired tokens |

---

### Authentication Methods

#### `startAuth(options?)`

Start OAuth 2.0 + PKCE authorization flow.

```typescript
const authUrl = await client.startAuth({
  prompt: 'login' // 'login' | 'consent' | 'none'
});
window.location.href = authUrl;
```

#### `handleCallback(code, state)`

Exchange authorization code for tokens.

```typescript
const result = await client.handleCallback(code, state);
// result: AuthResult
```

#### `register(options)`

Register new user via platform.

```typescript
const result = await client.register({
  email: 'user@example.com',
  username: 'newuser',
  platformData: { source: 'fun_farm' }
});
```

#### `logout()`

Logout and revoke tokens.

```typescript
await client.logout();
```

---

### User Methods

#### `getUser()`

Get current user profile from API.

```typescript
const user = await client.getUser();
```

#### `getCachedUser()`

Get cached user (no API call).

```typescript
const user = client.getCachedUser();
```

---

### Sync Methods

#### `syncData(options)`

Sync platform data to Fun Profile.

```typescript
const result = await client.syncData({
  mode: 'merge', // 'merge' | 'replace' | 'append'
  data: {
    farm_stats: { level: 10, gold: 5000 }
  },
  categories: ['farm_stats'],
  clientTimestamp: new Date().toISOString()
});
```

#### `getSyncManager(debounceMs?)`

Get debounced sync manager for batching.

```typescript
const syncManager = client.getSyncManager(3000);

syncManager.queue('stats', { gold: 100 });
syncManager.queue('stats', { gold: 150 }); // Merged

// Only 1 API call after 3 seconds of inactivity
```

---

### Token Methods

#### `isAuthenticated()`

Check if user is authenticated.

```typescript
const isAuth = await client.isAuthenticated();
```

#### `getAccessToken()`

Get current access token (auto-refreshes if needed).

```typescript
const token = await client.getAccessToken();
```

#### `getTokens()`

Get raw token data.

```typescript
const tokens = await client.getTokens();
// tokens: TokenData | null
```

#### `refreshTokens()`

Manually refresh tokens.

```typescript
const newTokens = await client.refreshTokens();
```

---

## Types

### FunUser

```typescript
interface FunUser {
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
```

### AuthResult

```typescript
interface AuthResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  scope: string;
  user: FunUser;
  isNewUser?: boolean;
}
```

### SyncResult

```typescript
interface SyncResult {
  success: boolean;
  syncedAt: string;
  syncMode: string;
  syncCount: number;
  categoriesUpdated: string[];
  dataSize: number;
}
```

---

## Storage Adapters

### LocalStorageAdapter

Persistent storage across browser sessions.

```typescript
import { LocalStorageAdapter } from '@fun-ecosystem/sso-sdk';
new LocalStorageAdapter(clientId: string)
```

### SessionStorageAdapter

Cleared when tab/browser closes. Recommended for sensitive scopes.

```typescript
import { SessionStorageAdapter } from '@fun-ecosystem/sso-sdk';
new SessionStorageAdapter(clientId: string)
```

### MemoryStorageAdapter

In-memory storage for testing/SSR.

```typescript
import { MemoryStorageAdapter } from '@fun-ecosystem/sso-sdk';
new MemoryStorageAdapter()
```

---

## Error Classes

| Class | Code | Description |
|-------|------|-------------|
| `FunProfileError` | varies | Base error class |
| `TokenExpiredError` | `token_expired` | Access token expired |
| `InvalidTokenError` | `invalid_token` | Invalid or revoked token |
| `RateLimitError` | `rate_limit_exceeded` | Rate limit hit (has `retryAfter`) |
| `ValidationError` | `validation_failed` | Request validation failed |
| `NetworkError` | `network_error` | Network request failed |

```typescript
try {
  await client.syncData({ ... });
} catch (error) {
  if (error instanceof RateLimitError) {
    console.log(`Retry after ${error.retryAfter}s`);
  }
}
```

---

## Constants

```typescript
import { DOMAINS, ENDPOINTS, SDK_VERSION } from '@fun-ecosystem/sso-sdk';

DOMAINS.funProfile  // 'https://fun.rich'
DOMAINS.funFarm     // 'https://farm.fun.rich'
DOMAINS.funPlay     // 'https://play.fun.rich'
DOMAINS.funPlanet   // 'https://planet.fun.rich'

SDK_VERSION         // '1.0.0'
```
