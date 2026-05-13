---
title: "Authentication: Basic Auth, Bearer Tokens, API Keys, OAuth 2.0"
description: "Authentication methods explained: HTTP Basic Auth, Bearer tokens, API keys, OAuth 2.0 authorization flows, OpenID Connect, and when to use each method."
---

# Authentication: Basic Auth, Bearer Tokens, API Keys, OAuth 2.0

> [!tip] Authentication in a nutshell
> Authentication is verifying that someone is who they claim to be. HTTP provides several mechanisms: Basic Auth, Bearer tokens, API keys, and the OAuth 2.0 framework. Each has different security properties and use cases.

## What is Authentication?

Authentication is the process of **verifying identity**. It answers the question: "Are you who you claim to be?"

```
Authentication (AuthN)  → "Are you John?"
Authorization (AuthZ)   → "Can John access /admin?"
```

## HTTP Authentication Header

HTTP has a standard way to send credentials in requests:

```
Authorization: <type> <credentials>
```

The type and format depend on the authentication method.

## HTTP Basic Authentication

Basic Auth is the simplest form of HTTP authentication. Credentials are sent as base64-encoded username and password.

### How Basic Auth works

```
# Server requires authentication
GET /api/data HTTP/1.1
Host: api.example.com

# Response: 401 Unauthorized
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Basic realm="api"

# Client sends credentials
GET /api/data HTTP/1.1
Host: api.example.com
Authorization: Basic <base64-encoded-credentials>
# "am9objpzZWNyZXQxMjM=" = base64("john:secret123")

# Server validates and responds
HTTP/1.1 200 OK
```

### Basic Auth in curl

```bash
# With username and password
curl -u john:secret123 https://api.example.com/data

# Equivalent to:
curl -H "Authorization: Basic <base64-encoded-credentials>" https://api.example.com/data
```

### Basic Auth security

| Property | Basic Auth |
|----------|-----------|
| **Confidentiality** | ❌ Only base64-encoded (NOT encrypted). Credentials are visible in network traffic. |
| **Requires HTTPS** | Mandatory. Without HTTPS, credentials travel in plaintext. |
| **Password storage** | Server must store plaintext or reversible-encrypted passwords. |
| **Session management** | No session — every request sends credentials. |
| **Rotation** | Impossible without re-sending credentials. |

> [!caution] Basic Auth is almost always the wrong choice
> Basic Auth sends credentials with every request. It is not designed for modern API authentication. Use it only for simple internal tools or when absolutely required by legacy systems. It MUST be used over HTTPS only.

## Bearer Tokens (Token-based authentication)

Bearer tokens are the modern standard for API authentication. Any holder of the token (the "bearer") can use it.

### How Bearer Tokens work

```
# Client sends token
GET /api/data HTTP/1.1
Host: api.example.com
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Server validates token signature and extracts user data
HTTP/1.1 200 OK
Content-Type: application/json

{ "id": 123, "name": "John" }
```

### Bearer token vs Basic Auth

| Property | Basic Auth | Bearer Token |
|----------|-----------|-------------|
| **Credentials sent** | Username + password (base64) | Token (opaque string or JWT) |
| **Per-request** | Yes, every request | Yes, every request |
| **Revocable** | No (requires password change) | Yes (revoke the token) |
| **Scoped** | No (full access) | Yes (scopes/permissions) |
| **Storage** | In application code or URL | In cookie, localStorage, or env variable |
| **Best for** | Legacy systems, admin panels | Modern APIs, SPAs, mobile apps |

### Bearer token security best practices

```javascript
// Good: Store tokens in httpOnly cookies
res.cookie('token', accessToken, {
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  maxAge: 15 * 60 * 1000  // 15 minutes
});

// Good: Use HTTPS only
// Bad: Never send tokens over plain HTTP
// Bad: Never log tokens
console.log('Auth header:', req.headers.authorization); // BAD!
```

### Where to store tokens

| Location | Pros | Cons |
|----------|------|------|
| **httpOnly Cookie** | Protected from XSS, CSRF with SameSite | Not accessible to JS |
| **Memory** | Not persisted, XSS-protected | Lost on page refresh |
| **localStorage** | Accessible to JS, persists | Vulnerable to XSS |
| **sessionStorage** | Accessible to JS, per-tab | Lost on tab close |
| **Secure element** | Hardware-protected | Platform-dependent |

> [!tip] Best practice: httpOnly + Secure + SameSite cookies
> Store the Bearer token in an httpOnly cookie. This protects against XSS (JavaScript cannot read it) and works seamlessly with CSRF protection via SameSite.

## API Keys

API keys are simple strings used to identify the caller. They are commonly used for server-to-server authentication.

### How API keys work

```
# Using an API key in the header
GET /api/data HTTP/1.1
Host: api.example.com
X-API-Key: <your-api-key-here>

# Or in the query string (less common, less secure)
GET /api/data?api_key=<your-api-key-here>

# Or in the body for POST/PUT requests
POST /api/data
Content-Type: application/json
X-API-Key: <your-api-key-here>
{"name": "John"}
```

### API key security properties

| Property | Description |
|----------|-------------|
| **Identification** | API key identifies WHO is making the request |
| **Not authentication** | API keys identify but do not prove identity (no challenge/response) |
| **No expiration by default** | Keys are valid forever unless rotated manually |
| **Scoped** | Can have permissions (read-only, write, admin) |
| **Revocable** | Can be revoked by the key owner |

### API key best practices

```
# GOOD: Rotate keys regularly
# GOOD: Use different keys for development, staging, production
# GOOD: Store keys in environment variables or secrets managers
# GOOD: Use short-lived keys for sensitive operations
# GOOD: Log which key was used for audit trails

# BAD: Commit API keys to version control
# BAD: Send API keys in URL query strings (they appear in logs)
# BAD: Share API keys via email or chat
# BAD: Use the same key for all environments
```

### API key vs Bearer token

| Aspect | API Key | Bearer Token |
|--------|---------|-------------|
| **Identity** | Identifies the caller (e.g., "this app") | Identifies the user or session |
| **Authentication method** | Something you know (static string) | Something you know (signed token) |
| **Verification** | Simple string match | Cryptographic signature verification |
| **Revocation** | Delete the key | Revoke the token (or wait for expiry) |
| **Use case** | Server-to-server, external APIs | User authentication, user sessions |

## OAuth 2.0

OAuth 2.0 is an **authorization framework** that allows third-party applications to obtain limited access to a user's resources without sharing credentials.

### OAuth 2.0 vs OAuth 1.0

| | OAuth 1.0 | OAuth 2.0 |
|--|-----------|-----------|
| **Complexity** | Cryptographic signature for every request | Token-based (simpler) |
| **Tokens** | Request tokens + Access tokens | Just access tokens |
| **Use cases** | APIs only | APIs + User authentication |
| **Security** | More complex, more secure by design | Simpler, relies on HTTPS |
| **Adoption** | Legacy systems | Modern standard (almost universal) |

> [!note] OAuth 2.0 is NOT an authentication protocol
> OAuth 2.0 is an authorization framework. It answers "Can this app access these resources?" not "Who is this user?". OpenID Connect (OIDC) builds on OAuth 2.0 for authentication.

### OAuth 2.0 Actors

| Actor | Role |
|-------|------|
| **Resource Owner** | The user who owns the data |
| **Client** | The application requesting access |
| **Authorization Server** | Issues access tokens (e.g., Google's OAuth server) |
| **Resource Server** | Hosts the protected resources (e.g., Google's Contacts API) |

### OAuth 2.0 Authorization Flows

#### Authorization Code Flow (most common)

Used for server-side web applications:

```
1. User clicks "Login with Google"
2. Client redirects user to:
   https://accounts.google.com/o/oauth2/v2/auth
   ?client_id=YOUR_CLIENT_ID
   &redirect_uri=https://yourapp.com/callback
   &response_type=code
   &scope=email profile
   &state=random_csrf_token

3. User authenticates with Google and grants permission

4. Google redirects back:
   https://yourapp.com/callback?code=AUTHORIZATION_CODE&state=csrf_token

5. Client exchanges code for access token:
   POST https://oauth2.googleapis.com/token
   {
     "grant_type": "authorization_code",
     "code": "AUTHORIZATION_CODE",
     "client_id": "YOUR_CLIENT_ID",
     "client_secret": "YOUR_CLIENT_SECRET",
     "redirect_uri": "https://yourapp.com/callback"
   }

6. Google returns:
   {
     "access_token": "<jwt-access-token>",
     "refresh_token": "1//0g...",
     "expires_in": 3600,
     "scope": "email profile"
   }

7. Client uses access token to access Google APIs:
   GET https://www.googleapis.com/oauth2/v2/userinfo
   Authorization: Bearer ya29.a0AfH6SMB...
```

#### Authorization Code Flow with PKCE

PKCE (Proof Key for Code Exchange) adds security to prevent authorization code interception. Required for SPAs and mobile apps:

```
1. Client generates: code_verifier (random string)
2. Client computes: code_challenge = BASE64URL(SHA256(code_verifier))
3. Client sends: authorization request with code_challenge

4. User authenticates and grants permission

5. Client receives: authorization code

6. Client exchanges code for token, including code_verifier:
   POST /token
   code=AUTH_CODE&
   grant_type=authorization_code&
   code_verifier=RANDOM_STRING_GENERATED_IN_STEP_1
```

> [!tip] PKCE is required for public clients
> SPA (Single Page Applications) and mobile apps cannot securely store a client secret. PKCE protects them from authorization code interception attacks.

### OAuth 2.0 Grant Types

| Grant Type | Use case | Where client_secret is sent |
|------------|---------|---------------------------|
| **Authorization Code** | Server-side web apps | Token endpoint (behind server) |
| **Authorization Code + PKCE** | SPAs, mobile apps | Token endpoint (with code_verifier) |
| **Client Credentials** | Server-to-server | Token endpoint |
| **Refresh Token** | Refreshing expired access tokens | Token endpoint |

#### Client Credentials Flow (machine-to-machine)

Used when a service needs to access another service on its own behalf (no user involved):

```
POST https://auth.example.com/oauth/token
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials
&client_id=service_a
&client_secret=super_secret_key
&scope=read:users write:users
```

### OAuth 2.0 Scopes

Scopes define the level of access granted:

```
scope=email profile
# → Can read email and basic profile

scope=read:users write:users delete:users
# → Can read, write, and delete user data

scope=admin
# → Full admin access
```

> [!tip] Principle of least privilege
> Always request the minimum scope needed. If your app only needs the user's email, request `scope=email` — not `scope=profile email address`.

## OpenID Connect (OIDC)

OpenID Connect is an authentication layer on top of OAuth 2.0. It adds an `id_token` (JWT) to the authorization response.

### OIDC vs OAuth 2.0

| | OAuth 2.0 | OpenID Connect |
|--|-----------|----------------|
| **Purpose** | Authorization (access resources) | Authentication (identify the user) |
| **Response** | Access token | Access token + ID token (JWT) |
| **User info** | No (need separate call) | Yes (via UserInfo endpoint) |
| **Standard claims** | None | sub, name, email, picture, etc. |

### OIDC ID Token

```json
{
  "iss": "https://accounts.google.com",
  "sub": "110169484474386276334",
  "aud": "your-client-id.apps.googleusercontent.com",
  "exp": 1516239022,
  "iat": 1516235422,
  "email": "john.doe@gmail.com",
  "email_verified": true,
  "name": "John Doe",
  "picture": "https://lh3.googleusercontent.com/...",
  "locale": "en"
}
```

### OIDC Discovery

```
GET https://accounts.google.com/.well-known/openid-configuration

# Response:
{
  "issuer": "https://accounts.google.com",
  "authorization_endpoint": "https://accounts.google.com/o/oauth2/v2/auth",
  "token_endpoint": "https://oauth2.googleapis.com/token",
  "userinfo_endpoint": "https://openidconnect.googleapis.com/v1/userinfo",
  "jwks_uri": "https://www.googleapis.com/oauth2/v3/certs",
  "response_types_supported": ["code", "token", "id_token"],
  "grant_types_supported": ["authorization_code", "refresh_token", "client_credentials"]
}
```

## Authentication comparison summary

| Method | Best for | Security level | Complexity |
|--------|---------|---------------|-----------|
| **Basic Auth** | Legacy systems, simple tools | Low (base64 is not encryption) | Very low |
| **Session cookies** | Traditional server-rendered apps | High | Low |
| **Bearer tokens (JWT)** | APIs, SPAs, mobile apps | High | Medium |
| **API keys** | Server-to-server, external APIs | Medium | Low |
| **OAuth 2.0** | Third-party access | High | High |
| **OIDC** | User authentication via identity provider | Very high | High |

## Connection with the rest of the wiki

| Concept | In-depth article |
|---------|-----------------|
| Cookies and sessions | [[09-cookies-sessions]] |
| JWT | [[09-cookies-sessions]] |
| REST APIs | [[11-rest-api]] |
| HTTPS | [[07-https-tls]] |

## Summary

- **Basic Auth** sends base64-encoded credentials with every request. Simple but insecure without HTTPS.
- **Bearer Tokens** (JWT) are the modern standard for API authentication. Tokens are self-contained and verifiable.
- **API Keys** identify the caller (usually a service). They are simple strings used for server-to-server authentication.
- **OAuth 2.0** is an authorization framework for granting limited access to resources. It does not authenticate users by itself.
- **OIDC** adds authentication to OAuth 2.0 with an ID token (JWT) containing standard user claims.
- **PKCE** is required for public clients (SPAs, mobile apps) to protect authorization codes.
- Always use the principle of least privilege: request minimum scopes, use short-lived tokens, and rotate keys.

> [!quote] The key takeaway
> Authentication is not one-size-fits-all. Use sessions for traditional web apps, JWTs for APIs, API keys for server-to-server, and OAuth 2.0 + OIDC when you need third-party identity. Each method has tradeoffs in security, complexity, and developer experience.
