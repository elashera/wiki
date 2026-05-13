---
title: "Cookies and Sessions: Types, Attributes, JWT, Tokens, Stateless vs Stateful"
description: "Cookies and sessions explained: cookie types, security attributes, JWT tokens, session management, stateless vs stateful authentication, and best practices."
---

# Cookies and Sessions: Types, Attributes, JWT, Tokens, Stateless vs Stateful

> [!tip] Cookies and sessions in a nutshell
> Cookies are small pieces of data stored in the browser. Sessions are server-side data structures tied to cookies. Together, they solve HTTP's stateless nature: HTTP doesn't remember who you are between requests, but cookies + sessions make it possible to maintain a logged-in experience.

## Why do we need cookies and sessions?

HTTP is **stateless**: each request is independent. The server has no memory of previous requests from the same client.

```
Request 1: GET /login → Server: "Here's the login page"
Request 2: POST /login → Server: "I don't know who you are. Please log in again."
Request 3: GET /dashboard → Server: "You need to log in first."
```

Cookies and sessions solve this by giving the server a way to remember the client across requests.

```
Request 1: GET /login → Server: "Here's the login page" + Set-Cookie: session_id=abc123
Request 2: POST /login → Server: "Credentials validated" + Set-Cookie: session_id=xyz789
Request 3: GET /dashboard → Cookie: session_id=xyz789 → Server: "Session found → You are John"
```

## Cookies: What are they?

A cookie is a **key-value pair** sent by the server in the response and returned by the browser in subsequent requests.

### Setting a cookie

```
Server → Browser: Set-Cookie: session_id=xyz789; Path=/; HttpOnly; Secure; SameSite=Strict
```

### Browser returning a cookie

```
Browser → Server: Cookie: session_id=xyz789
```

### Cookie attributes

| Attribute | Purpose | Example |
|-----------|---------|---------|
| `Path` | URL path where the cookie is sent | `Path=/admin` → only sent to `/admin/*` |
| `Domain` | Domain the cookie is sent to | `Domain=.example.com` → sent to all subdomains |
| `Max-Age` | Lifetime in seconds | `Max-Age=3600` → expires in 1 hour |
| `Expires` | Exact expiration date | `Expires=Wed, 13 May 2026 15:00:00 GMT` |
| `Secure` | Only sent over HTTPS | `Secure` |
| `HttpOnly` | Not accessible via JavaScript | `HttpOnly` |
| `SameSite` | Cross-site request control | `SameSite=Strict`, `Lax`, `None` |

### Cookie security attributes (must-use)

| Attribute | What it does | Why it matters |
|-----------|-------------|----------------|
| **Secure** | Cookie only sent over HTTPS | Prevents cookie theft via man-in-the-middle |
| **HttpOnly** | JavaScript cannot read the cookie | Prevents XSS cookie theft |
| **SameSite** | Controls when cookies are sent with cross-site requests | Prevents CSRF attacks |

### SameSite explained

```
SameSite=Strict:
  ┌──────────┐     ┌──────────┐
  │ site-a.com│     │ site-b.com│
  │           │     │           │
  │  Cookie  │     │  Cookie   │
  │  always  │     │  never    │
  │  sent    │     │  sent     │
  │          │     │           │
  └──────────┘     └──────────┘
  Cross-site: never sent (even from link)

SameSite=Lax (default):
  ┌──────────┐     ┌──────────┐
  │ site-a.com│     │ site-b.com│
  │           │     │           │
  │  Cookie  │     │  Cookie   │
  │  sent    │     │  sent     │
  │  on top- │     │  on top-  │
  │  level   │     │  level    │
  │  GET     │     │  GET      │
  │  only    │     │  only     │
  └──────────┘     └──────────┘
  Cross-site POST: not sent

SameSite=None:
  ┌──────────┐     ┌──────────┐
  │ site-a.com│     │ site-b.com│
  │           │     │           │
  │  Cookie  │     │  Cookie   │
  │  always  │     │  always   │
  │  sent    │     │  sent     │
  └──────────┘     └──────────┘
  MUST also set Secure. Required for cross-site embedding.
```

> [!caution] SameSite=None requires Secure
> Per the specification, `SameSite=None` must be accompanied by `Secure`. Browsers will reject cookies with `SameSite=None` that are not `Secure`.

## Types of cookies

### Session cookies vs Persistent cookies

| Type | Lifetime | Example |
|------|---------|---------|
| **Session cookie** | Until browser closes | `session_id=xyz789` |
| **Persistent cookie** | Until `Expires` or `Max-Age` | `remember_token=abc123; Max-Age=2592000` (30 days) |

### First-party vs Third-party cookies

| Type | Domain | Example | Use case |
|------|--------|---------|---------|
| **First-party** | Same as the page domain | `example.com` sets cookie on `example.com` | Authentication, preferences |
| **Third-party** | Different from page domain | `ads.tracker.com` sets cookie when embedded on `example.com` | Advertising, analytics |

> [!caution] Third-party cookie deprecation
> Chrome, Firefox, Safari, and Edge are all deprecating or have deprecated third-party cookies. Chrome has begun blocking them in 2024–2025. Plan for first-party alternatives (First-Party IDs, Google's Privacy Sandbox, etc.).

### Technical cookies by function

| Function | Description | Example |
|----------|-------------|---------|
| **Strictly necessary** | Required for the site to function | `session_id`, `csrf_token` |
| **Preferences** | Remember user settings | `theme=dark`, `language=en` |
| **Analytics** | Collect usage data | `_ga=GA1.2.123456` (Google Analytics) |
| **Marketing** | Track users for advertising | `ad_id=xyz` (ad networks) |

## Sessions: Server-side state

A session is a **server-side data structure** that stores information about a user. The session ID is stored as a cookie in the browser.

### Session storage backends

| Backend | Description | Pros | Cons |
|---------|-------------|------|------|
| **In-memory** | Stored in server RAM | Fastest | Lost on restart, not distributed |
| **Redis** | Key-value store | Distributed, fast, persistent | Requires Redis server |
| **Database** | SQL/NoSQL database | Persistent, queryable | Slower, DB load |
| **File system** | Serialized files | Simple | Slow, file locking issues |

### Session lifecycle

```
1. User logs in → Server creates session
2. Session data stored (in Redis, DB, etc.)
3. Session ID sent to browser as cookie
4. Subsequent requests include session ID cookie
5. Server looks up session ID → finds user data
6. User logs out → Server destroys session
```

### Session management in Node.js (Express + express-session + Redis)

```javascript
const session = require('express-session');
const RedisStore = require('connect-redis').default;
const redis = require('redis');

const redisClient = redis.createClient({ url: 'redis://localhost:6379' });

app.use(session({
  store: new RedisStore({ client: redisClient }),
  secret: 'your-secret-key-change-in-production',
  resave: false,        // Don't save session if unmodified
  saveUninitialized: false, // Don't save uninitialized sessions
  cookie: {
    secure: true,       // HTTPS only
    httpOnly: true,     // No JavaScript access
    sameSite: 'strict', // CSRF protection
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  },
  name: 'sessionId'     // Cookie name
}));

// Setting session data
app.post('/login', (req, res) => {
  // Authenticate user...
  req.session.userId = user.id;
  req.session.role = user.role;
  req.session.username = user.username;
  res.json({ success: true });
});

// Accessing session data
app.get('/profile', (req, res) => {
  const userId = req.session.userId;
  // Fetch user profile from database...
});

// Destroying session
app.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    res.json({ success: true });
  });
});
```

## JWT (JSON Web Tokens)

JWT is an alternative to sessions. Instead of storing state on the server, the token itself contains the user data.

### JWT structure

A JWT has three parts separated by dots:

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.              ← Header (Base64URL)
eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4iLCJpYXQiOjE1MTYyMzkwMjJ9.  ← Payload (Base64URL)
SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c   ← Signature
```

### JWT parts decoded

```
Header (decoded):
{
  "alg": "HS256",
  "typ": "JWT"
}

Payload (decoded):
{
  "sub": "1234567890",
  "name": "John",
  "role": "user",
  "iat": 1516239022,      // Issued at (Unix timestamp)
  "exp": 1516242622       // Expiration (1 hour from now)
}

Signature:
HMACSHA256(
  base64UrlEncode(header) + "." + base64UrlEncode(payload),
  "your-256-bit-secret"
)
```

### JWT usage

```javascript
// Creating a JWT (Node.js with jsonwebtoken)
const jwt = require('jsonwebtoken');

const token = jwt.sign(
  {
    sub: user.id,
    role: user.role,
    name: user.username
  },
  process.env.JWT_SECRET,
  { expiresIn: '1h' }
);

// Verifying a JWT
const decoded = jwt.verify(token, process.env.JWT_SECRET);
// { sub: '1234567890', role: 'user', name: 'John', iat: 1516239022, exp: 1516242622 }
```

### JWT in HTTP headers

```
GET /api/profile HTTP/1.1
Host: api.example.com
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### JWT vs Session comparison

| Aspect | Sessions (server-side) | JWT (stateless) |
|--------|----------------------|-----------------|
| **State location** | Server (Redis, DB) | Embedded in token |
| **Server load** | Lookup by session ID | No lookup needed |
| **Scalability** | Need shared store (Redis) | Stateless, scales easily |
| **Revocation** | Immediate (delete session) | Must wait for token to expire (or use blacklist) |
| **Token size** | Small (session ID, e.g., 32 bytes) | Larger (header + payload + signature) |
| **Storage** | Server-side | Client-side (cookie or localStorage) |
| **Best for** | Traditional web apps, microservices with shared store | APIs, SPAs, mobile apps, distributed systems |

### JWT security best practices

```javascript
// GOOD: Short expiration, secure secret
const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '15m' });

// GOOD: Verify signature and expiration
const decoded = jwt.verify(token, process.env.JWT_SECRET);

// BAD: Weak secret (DO NOT DO THIS)
const token = jwt.sign(payload, 'secret');

// BAD: No expiration
const token = jwt.sign(payload, secret, { expiresIn: '9999d' });

// GOOD: Use RS256 for better security (asymmetric)
const token = jwt.sign(payload, privateKey, { algorithm: 'RS256', expiresIn: '15m' });
```

## Stateless vs Stateful Authentication

### Stateful (Session-based)

```
Client                          Server (with Redis)
   │─── POST /login ────────────→│
   │   { username, password }    │
   │                           │
   │                           │ 1. Validate credentials
   │                           │ 2. Create session { userId, role, ... }
   │                           │ 3. Store in Redis with random key
   │                           │ 4. Return session ID
   │←── Set-Cookie: sid=abc ───│
   │                           │
   │─── GET /profile ──────────→│
   │   Cookie: sid=abc         │ 1. Look up sid=abc in Redis
   │                           │ 2. Found! Return user data
   │←── 200 OK (user data) ────│
   │                           │
   │─── GET /dashboard ────────→│
   │   Cookie: sid=abc         │ 1. Look up sid=abc in Redis
   │                           │ 2. Found! Return data
   │←── 200 OK (dashboard) ────│
```

### Stateless (JWT-based)

```
Client                          Server (no session store)
   │─── POST /login ────────────→│
   │   { username, password }    │
   │                           │
   │                           │ 1. Validate credentials
   │                           │ 2. Sign JWT with private key
   │                           │ 3. Return JWT
   │←── { token: "eyJ..." } ───│
   │                           │
   │─── GET /profile ──────────→│
   │   Authorization: Bearer ...│ 1. Verify JWT signature
   │                           │ 2. Extract userId from payload
   │                           │ 3. Return user data
   │←── 200 OK (user data) ────│
   │                           │
   │─── GET /dashboard ────────→│
   │   Authorization: Bearer ...│ 1. Verify JWT signature
   │                           │ 2. Extract userId from payload
   │                           │ 3. Return data
   │←── 200 OK (dashboard) ────│
```

### When to choose which

| Scenario | Recommended | Why |
|----------|------------|-----|
| Traditional web app (server-rendered) | Sessions | Easier revocation, simpler |
| SPA / Mobile app / Microservices | JWT | Stateless, no shared session store |
| API with third-party clients | JWT | No session management overhead |
| Need immediate logout/revocation | Sessions | Delete session = instant |
| JWT with immediate revocation | JWT + blacklist | Extra complexity, Redis needed |
| Long-lived authenticated sessions | Sessions (Redis) | Easy to manage, low client storage |

## Refresh tokens

JWT access tokens expire quickly (15 minutes). Refresh tokens allow the client to get a new access token without re-authenticating:

```
1. Login → Access Token (15 min) + Refresh Token (7 days)
2. Access Token expires → Client uses Refresh Token to get new Access Token
3. Refresh Token expires → User must log in again
```

```javascript
// Login response
{
  "accessToken": "eyJ...",        // Expires in 15 minutes
  "refreshToken": "dGhpcyBpcyBh..." // Expires in 7 days, stored server-side
}

// Access token expired → refresh
POST /api/auth/refresh
{
  "refreshToken": "dGhpcyBpcyBh..."
}

// Response
{
  "accessToken": "eyJ..."  // New access token
}

// If refresh token is invalid or expired
{
  "error": "Unauthorized",
  "message": "Please log in again"
}
```

## Cookie-based authentication vs Token-based authentication

| Aspect | Cookie (Session) | Token (JWT) |
|--------|-----------------|-------------|
| **Storage** | Cookie (httpOnly + Secure) | Cookie or localStorage |
| **CSRF** | Protected by SameSite cookie attribute | Not vulnerable (but origin check needed) |
| **XSS** | Protected by HttpOnly flag | Vulnerable if stored in localStorage |
| **Server load** | Requires session store lookup | No lookup needed |
| **Scalability** | Shared store needed | Stateless, any server can verify |
| **CORS** | Not applicable (same origin cookies) | CORS headers needed |
| **Mobile** | Native apps cannot easily use cookies | Works well on mobile |
| **Revocation** | Easy (delete session) | Hard (need blacklist or wait for expiry) |

## Connection with the rest of the wiki

| Concept | In-depth article |
|---------|-----------------|
| Authentication types | [[10-authentication-api-keys-tokens]] |
| HTTP methods | [[05-http-deep-dive]] |
| REST APIs | [[11-rest-api]] |

## Summary

- HTTP is stateless — cookies and sessions add state to HTTP.
- **Cookies** are small key-value pairs stored in the browser with security attributes: `Secure`, `HttpOnly`, `SameSite`.
- **Sessions** store state server-side; the session ID is sent as a cookie.
- **JWT** is a stateless alternative: the token contains the user data and is self-contained.
- **Stateful** (sessions) is better for traditional web apps; **stateless** (JWT) is better for APIs and distributed systems.
- Always use `Secure`, `HttpOnly`, and `SameSite` attributes on authentication cookies.
- Short-lived access tokens with refresh tokens is the recommended pattern for API authentication.

> [!quote] The key takeaway
> There is no single best approach. Sessions are simpler and easier to revoke. JWTs are more scalable and better suited for distributed systems. Choose based on your architecture, not trends.
