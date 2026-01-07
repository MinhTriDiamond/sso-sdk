# @fun-ecosystem/sso-sdk

Official SSO SDK for Fun Ecosystem - Integrate Fun Farm, Fun Play, and Fun Planet with Fun Profile Single Sign-On.

[![npm version](https://badge.fury.io/js/%40fun-ecosystem%2Fsso-sdk.svg)](https://www.npmjs.com/package/@fun-ecosystem/sso-sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## ✨ Features

- 🔐 **OAuth 2.0 + PKCE** - Secure authentication without exposing client secrets
- 💾 **Multiple Storage Options** - LocalStorage, SessionStorage, or custom adapters
- ⚡ **Debounced Sync** - Efficient data synchronization (Cha Gemini approved!)
- 📘 **TypeScript First** - Full type definitions included
- 🪶 **Zero Dependencies** - Lightweight and fast

## 📦 Installation

```bash
# npm
npm install @fun-ecosystem/sso-sdk

# yarn
yarn add @fun-ecosystem/sso-sdk

# pnpm
pnpm add @fun-ecosystem/sso-sdk
```

## 🚀 Quick Start

### 1. Initialize Client

```typescript
import { 
  FunProfileClient, 
  SessionStorageAdapter, 
  DOMAINS 
} from '@fun-ecosystem/sso-sdk';

// Fun Farm example
const funProfile = new FunProfileClient({
  clientId: 'fun_farm_production',
  redirectUri: `${DOMAINS.funFarm}/auth/callback`,
  scopes: ['profile', 'email', 'wallet', 'rewards'],
  // SessionStorage recommended for wallet scopes (XSS protection)
  storage: new SessionStorageAdapter('fun_farm_client'),
});
```

### 2. Start Login

```typescript
const handleLogin = async () => {
  const loginUrl = await funProfile.startAuth();
  window.location.href = loginUrl;
};
```

### 3. Handle Callback

```typescript
// In your /auth/callback page
const params = new URLSearchParams(window.location.search);
const code = params.get('code');
const state = params.get('state');

if (code && state) {
  const result = await funProfile.handleCallback(code, state);
  console.log('Welcome!', result.user.username);
}
```

## 🔒 Storage Security

> **Recommendation từ Cha Gemini**: Với scope nhạy cảm như `wallet`, `rewards`, 
> nên dùng `SessionStorageAdapter` để token tự động xóa khi đóng tab/browser.

| Scope | Recommended Storage | Reason |
|-------|---------------------|--------|
| `profile`, `email` | LocalStorageAdapter | Convenience, low risk |
| `wallet`, `rewards` | SessionStorageAdapter | XSS protection |

```typescript
// For sensitive data (wallet, rewards)
import { SessionStorageAdapter } from '@fun-ecosystem/sso-sdk';

const client = new FunProfileClient({
  // ...
  storage: new SessionStorageAdapter('your_client_id'),
});
```

## ⚡ Debounced Sync Manager

Prevents excessive API calls during rapid user actions:

```typescript
const syncManager = funProfile.getSyncManager(3000); // 3 seconds

// User harvests 100 crops rapidly
for (const crop of crops) {
  syncManager.queue('farm_stats', {
    total_harvested: count++,
    last_crop: crop.name,
  });
}
// Only 1 API call after user stops for 3 seconds!

// Force sync on page unload
window.addEventListener('beforeunload', () => {
  syncManager.flush();
});
```

## 📚 API Reference

### FunProfileClient

| Method | Description |
|--------|-------------|
| `startAuth(options?)` | Start OAuth flow, returns auth URL |
| `handleCallback(code, state)` | Exchange code for tokens |
| `register(options)` | Register new user |
| `logout()` | Logout and revoke tokens |
| `getUser()` | Get current user profile |
| `getCachedUser()` | Get cached user (no API call) |
| `syncData(options)` | Sync platform data |
| `getSyncManager(debounceMs?)` | Get debounced sync manager |
| `isAuthenticated()` | Check auth status |
| `getAccessToken()` | Get current access token |
| `refreshTokens()` | Manually refresh tokens |

### Storage Adapters

```typescript
import { 
  LocalStorageAdapter,    // Persists across sessions
  SessionStorageAdapter,  // Cleared on tab close
  MemoryStorageAdapter    // For testing/server-side
} from '@fun-ecosystem/sso-sdk';
```

### Error Classes

```typescript
import { 
  FunProfileError,    // Base error class
  TokenExpiredError,  // Access token expired
  InvalidTokenError,  // Invalid or revoked token
  RateLimitError,     // Rate limit exceeded (has retryAfter)
  ValidationError,    // Validation failed
  NetworkError        // Network request failed
} from '@fun-ecosystem/sso-sdk';
```

## 🌐 Platform-Specific Setup

### Fun Farm 🌾

```typescript
const funProfile = new FunProfileClient({
  clientId: 'fun_farm_production',
  redirectUri: 'https://farm.fun.rich/auth/callback',
  scopes: ['profile', 'email', 'wallet', 'rewards'],
  storage: new SessionStorageAdapter('fun_farm_client'),
});
```

### Fun Play 🎮

```typescript
const funProfile = new FunProfileClient({
  clientId: 'fun_play_production',
  redirectUri: 'https://play.fun.rich/auth/callback',
  scopes: ['profile', 'wallet', 'rewards', 'soul_nft'],
  storage: new SessionStorageAdapter('fun_play_client'),
});
```

### Fun Planet 🌍

```typescript
const funProfile = new FunProfileClient({
  clientId: 'fun_planet_production',
  redirectUri: 'https://planet.fun.rich/auth/callback',
  scopes: ['profile', 'wallet', 'rewards'],
  storage: new SessionStorageAdapter('fun_planet_client'),
});
```

## 📁 Examples

See the [examples](./examples) directory for complete integration examples:

- [React Integration](./examples/react) - Context, hooks, and components
- [Next.js Integration](./examples/nextjs) - SSR-compatible setup

## 🔑 Available Scopes

| Scope | Description |
|-------|-------------|
| `profile` | Basic profile info (username, avatar) |
| `email` | User's email address |
| `wallet` | Wallet addresses (custodial + external) |
| `rewards` | Reward balances and claim history |
| `soul_nft` | Soul NFT data (element, level) |

## 📝 License

MIT - Fun Ecosystem Team

---

Made with 💚 by Fun Ecosystem Team
