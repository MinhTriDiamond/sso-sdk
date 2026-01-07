# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-01-07

### Added

- 🎉 Initial release of @fun-ecosystem/sso-sdk
- OAuth 2.0 + PKCE authentication flow
- Multiple storage adapters:
  - `LocalStorageAdapter` - Persistent storage
  - `SessionStorageAdapter` - Session-based (recommended for wallet scopes)
  - `MemoryStorageAdapter` - In-memory for testing
- `DebouncedSyncManager` for efficient data synchronization
- Full TypeScript support with type definitions
- Error classes for better error handling:
  - `FunProfileError`
  - `TokenExpiredError`
  - `InvalidTokenError`
  - `RateLimitError`
  - `ValidationError`
  - `NetworkError`
- Platform constants for Fun Farm, Fun Play, Fun Planet
- React and Next.js integration examples

### Security

- PKCE (Proof Key for Code Exchange) implementation
- Secure token storage recommendations
- XSS protection with SessionStorageAdapter for sensitive scopes

---

## [Unreleased]

### Planned

- React hooks package (`@fun-ecosystem/sso-sdk-react`)
- Vue.js integration
- Offline support with sync queue
- Biometric authentication support
