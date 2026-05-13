---
title: "HTTP Status Codes: 1xx through 5xx, When They're Used, Common Errors"
description: "HTTP status codes explained in detail: 1xx informational, 2xx success, 3xx redirection, 4xx client errors, 5xx server errors, when they're used, and common errors."
---

# HTTP Status Codes: 1xx through 5xx, When They're Used, Common Errors

> [!tip] Status codes in a nutshell
> HTTP status codes are 3-digit numbers that tell you whether a request succeeded, failed, or needs further action. They are divided into five categories: 1xx, 2xx, 3xx, 4xx, and 5xx.

## What are HTTP status codes?

HTTP status codes are **3-digit numbers** returned by a server in response to a client request. They are defined in [RFC 7231](https://datatracker.ietf.org/doc/html/rfc7231) and subsequent RFCs.

```
HTTP/1.1 200 OK
Content-Type: text/html
Content-Length: 4832

<html>...</html>
```

The status code is part of the **status line** in an HTTP response. The first digit defines the category:

| First digit | Category | Meaning |
|-------------|----------|---------|
| **1** | Informational | Request received, continuing process |
| **2** | Success | Request successfully received, understood, accepted |
| **3** | Redirection | Further action needed to complete the request |
| **4** | Client Error | The request contains bad syntax or cannot be fulfilled |
| **5** | Server Error | The server failed to fulfill a valid request |

## 1xx: Informational

Informational responses indicate that the request was received and processing continues. They are rare in practice.

| Code | Name | Meaning |
|------|------|---------|
| **100** | Continue | The server has received the headers; client should send the body |
| **101** | Switching Protocols | The server agrees to upgrade to a different protocol (e.g., WebSocket) |
| **103** | Early Hints | Used with `Link: rel=preconnect` to preload resources before the response body |

### 100 Continue

Used in a two-step request:

```
# Step 1: Send headers only
POST /api/upload HTTP/1.1
Host: example.com
Content-Type: multipart/form-data
Content-Length: 999999

# Server responds:
100 Continue

# Step 2: Client sends the body
[... file upload data ...]
```

This is useful for large uploads: the server can reject before the client transfers the entire body.

### 101 Switching Protocols

Used to upgrade from HTTP to another protocol:

```
# WebSocket upgrade request
GET /ws HTTP/1.1
Host: example.com
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Key: <client-generated-key>
Sec-WebSocket-Version: 13

# Server response
HTTP/1.1 101 Switching Protocols
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Accept: s3pPLMBiTxaQ9kYGzzhZRbK+xOo=

# Now WebSocket protocol takes over
```

### 103 Early Hints

A modern feature for performance optimization:

```
# Server sends hints before the full response is ready
HTTP/1.1 103 Early Hints
Link: </style.css>; rel=preload; as=style
Link: </app.js>; rel=preload; as=script

# ... later, the full response ...
HTTP/1.1 200 OK
Content-Type: text/html
```

This allows browsers to start loading resources before the HTML is even fully processed.

## 2xx: Success

Success codes mean the request was received, understood, and accepted.

### 200 OK

The standard success response. The request succeeded and the response body contains the result.

```
HTTP/1.1 200 OK
Content-Type: application/json

{
  "id": 123,
  "name": "John Doe",
  "email": "john@example.com"
}
```

### 201 Created

Returned when a new resource is created (typically after a POST request):

```
# Request
POST /api/users HTTP/1.1
Host: example.com
Content-Type: application/json

{"name": "John Doe", "email": "john@example.com"}

# Response
HTTP/1.1 201 Created
Location: /api/users/123
Content-Type: application/json

{"id": 123, "name": "John Doe", "email": "john@example.com"}
```

The `Location` header points to the newly created resource.

### 204 No Content

The request succeeded, but there is no body to return. Common for DELETE requests:

```
# Request
DELETE /api/users/123 HTTP/1.1

# Response
HTTP/1.1 204 No Content
```

### 206 Partial Content

Used for range requests (e.g., resuming a download or streaming video):

```
# Request
GET /video.mp4 HTTP/1.1
Range: bytes=1000-1999

# Response
HTTP/1.1 206 Partial Content
Content-Range: bytes 1000-1999/1000000
Content-Length: 1000
Content-Type: video/mp4

[... next 1000 bytes of the video file ...]
```

### 207 Multi-Status

Used with WebDAV: the response contains multiple status codes for multiple operations:

```
HTTP/1.1 207 Multi-Status
Content-Type: application/xml

<DAV:multistatus>
  <D:response>
    <D:href>/file1.txt</D:href>
    <D:status>HTTP/1.1 200 OK</D:status>
  </D:response>
  <D:response>
    <D:href>/file2.txt</D:href>
    <D:status>HTTP/1.1 404 Not Found</D:status>
  </D:response>
</DAV:multistatus>
```

## 3xx: Redirection

Redirection codes tell the client to take further action to complete the request, usually at a different URI.

### 301 Moved Permanently

The resource has permanently moved to a new location. Browsers cache this redirect:

```
# Old URL
GET /old-page HTTP/1.1

# Response
HTTP/1.1 301 Moved Permanently
Location: /new-page
Cache-Control: max-age=31536000

# Browser automatically follows to /new-page
```

Search engines transfer PageRank from the old URL to the new one. Use this for permanent moves.

### 302 Found (formerly "Moved Temporarily")

The resource temporarily resides at a different location. The browser should use the original method (GET or POST):

```
# Response
HTTP/1.1 302 Found
Location: /maintenance-page
```

> [!tip] 302 vs 307 and 308
> | Code | Name | Preserves method? |
> |------|------|--------------------|
> | 302 | Found | Sometimes (browsers change POST to GET) |
> | 307 | Temporary Redirect | ✅ Always |
> | 301 | Moved Permanently | Sometimes (browsers change POST to GET) |
> | 308 | Permanent Redirect | ✅ Always |
>
> Use 307/308 when you need to guarantee the HTTP method is preserved.

### 304 Not Modified

Used with conditional requests (If-None-Match / If-Modified-Since). Tells the browser to use its cached version:

```
# Client: "Do you have a new version since ETag abc123?"
GET /api/data HTTP/1.1
If-None-Match: "abc123"

# Server: "No, your cached version is still valid"
HTTP/1.1 304 Not Modified
ETag: "abc123"

# Client uses cached data, no body transferred
```

### 307 Temporary Redirect

Same as 302, but explicitly preserves the HTTP method:

```
POST /api/submit
→ 307 Temporary Redirect
→ Location: /api/new-endpoint

# Browser resends as POST to /api/new-endpoint (not GET!)
```

### 308 Permanent Redirect

Same as 301, but explicitly preserves the HTTP method:

```
POST /api/old-endpoint
→ 308 Permanent Redirect
→ Location: /api/new-endpoint

# Browser resends as POST to /api/new-endpoint
```

### 301 vs 302 vs 307 vs 308 comparison

| Code | Permanent? | Preserves POST? | Use when |
|------|-----------|-----------------|----------|
| **301** | Yes | No (browsers change to GET) | Resource moved permanently |
| **302** | No | Not guaranteed | Resource temporarily moved |
| **307** | No | Yes | Temporary redirect, POST must be preserved |
| **308** | Yes | Yes | Permanent redirect, POST must be preserved |

### Common redirect patterns

```nginx
# Nginx: 301 permanent redirect
location /old-path {
    return 301 /new-path;
}

# Nginx: 302 temporary redirect
location /temp-path {
    return 302 /temporary-destination;
}

# Nginx: Redirect HTTP to HTTPS
server {
    listen 80;
    server_name example.com;
    return 301 https://$host$request_uri;
}
```

## 4xx: Client Errors

Client error codes mean the request contains bad syntax, is missing required information, or cannot be fulfilled by the client.

### 400 Bad Request

The server cannot understand the request due to malformed syntax:

```
# Sending malformed JSON
POST /api/users HTTP/1.1
Content-Type: application/json

{invalid json

# Response
HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "error": "Invalid JSON: Unexpected token i at position 0"
}
```

### 401 Unauthorized

Authentication is required. The client must provide valid credentials:

```
# Request without credentials
GET /api/admin HTTP/1.1

# Response
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer realm="api"

{
  "error": "Authentication required"
}
```

> [!note] 401 vs 403
> - **401 Unauthorized**: You are not logged in (or credentials are missing/invalid).
> - **403 Forbidden**: You are logged in, but you do not have permission for this resource.

### 403 Forbidden

The server understood the request but refuses to authorize it. The client is authenticated but lacks permissions:

```
# Logged in as regular user, trying to access admin page
GET /api/admin HTTP/1.1
Authorization: Bearer user-token

# Response
HTTP/1.1 403 Forbidden
{
  "error": "Insufficient permissions. Admin role required."
}
```

### 404 Not Found

The requested resource does not exist:

```
# Request
GET /api/users/999999

# Response
HTTP/1.1 404 Not Found
Content-Type: application/json

{
  "error": "User not found"
}
```

> [!tip] 404 vs 410
> | Code | Meaning | When to use |
> |------|---------|-------------|
> | **404** | Not found (temporarily or permanently) | Resource may come back |
> | **410** | Gone (permanently removed) | Resource deleted, should not be retried |

### 405 Method Not Allowed

The HTTP method is not supported for this resource:

```
# Only GET and POST allowed for this endpoint
POST /api/users/123

# Response
HTTP/1.1 405 Method Not Allowed
Allow: GET, POST, PUT, DELETE

{
  "error": "Method DELETE is not allowed for this endpoint"
}
```

### 408 Request Timeout

The server timed out waiting for the client's request:

```
# Client sends request but takes too long to send the body
POST /api/upload
Host: example.com
Content-Length: 999999
[... client pauses for 30 seconds before sending body ...]

# Response
HTTP/1.1 408 Request Timeout
Connection: close

{
  "error": "Request timeout. Please retry."
}
```

### 409 Conflict

The request conflicts with the current state of the server:

```
# Trying to create a user that already exists
POST /api/users
{"email": "john@example.com", "name": "John"}

# Response
HTTP/1.1 409 Conflict
{
  "error": "A user with email john@example.com already exists"
}
```

### 410 Gone

The resource has been permanently removed and will not return:

```
# Request to an old API endpoint that was removed
GET /api/v1/users

# Response
HTTP/1.1 410 Gone
{
  "error": "API v1 has been deprecated. Use /api/v2/users instead.",
  "documentation": "https://example.com/api/v2/docs"
}
```

### 413 Payload Too Large

The request body exceeds the server's size limit:

```
# Uploading a 500MB file when max is 10MB
POST /api/upload
Content-Type: multipart/form-data
Content-Length: 524288000

# Response
HTTP/1.1 413 Payload Too Large
Content-Type: application/json

{
  "error": "File too large. Maximum upload size is 10MB.",
  "max_size": "10MB"
}
```

### 415 Unsupported Media Type

The Content-Type is not supported:

```
# Server expects JSON but receives XML
POST /api/users
Content-Type: application/xml

<?xml version="1.0"?>
<user><name>John</name></user>

# Response
HTTP/1.1 415 Unsupported Media Type
{
  "error": "Unsupported content type. Expected: application/json"
}
```

### 418 I'm a Teapot

A famous Easter egg from RFC 2324 (Hyper Text Coffee Pot Control Protocol). The server refuses to brew coffee because it is a teapot:

```
HTTP/1.1 418 I'm a teapot
Allow: HEAD

<body>
<h1>I'm a teapot!</h1>
</body>
```

This is sometimes used as a honeypot to detect bots (legitimate clients should never send this request).

### 429 Too Many Requests

Rate limiting has been exceeded:

```
# Making too many API requests
GET /api/data HTTP/1.1
Authorization: Bearer token

# Response
HTTP/1.1 429 Too Many Requests
Retry-After: 60
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1684000000

{
  "error": "Rate limit exceeded. Please retry after 60 seconds."
}
```

### 422 Unprocessable Entity

The request is well-formed but contains semantic errors (commonly used in REST APIs):

```
# Creating a user with invalid data
POST /api/users
{"name": "", "email": "not-an-email", "age": -5}

# Response
HTTP/1.1 422 Unprocessable Entity
{
  "errors": {
    "name": "Name cannot be empty",
    "email": "Invalid email format",
    "age": "Age must be a positive number"
  }
}
```

### 451 Unavailable For Legal Reasons

The resource is unavailable due to legal reasons (copyright, government request):

```
HTTP/1.1 451 Unavailable For Legal Reasons
Link: <http://example.com/legal>; rel="described-by"

{
  "error": "This content is unavailable in your jurisdiction due to legal restrictions."
}
```

## 5xx: Server Errors

Server error codes mean the server failed to fulfill a valid request. These are server-side problems.

### 500 Internal Server Error

A generic error when the server encounters an unexpected condition:

```
# Server-side exception
POST /api/users
{"name": "John", "email": "john@example.com"}

# Response (in production, the message is usually generic)
HTTP/1.1 500 Internal Server Error
Content-Type: application/json

{
  "error": "An unexpected error occurred"
}

# In development, you might see:
{
  "error": "TypeError: Cannot read property 'name' of undefined at createUser (/app/routes/users.js:15:12)"
}
```

> [!caution] Never expose internal error details in production
> Stack traces and internal error messages reveal your code structure and can be exploited by attackers.

### 501 Not Implemented

The server does not support the functionality required to fulfill the request:

```
# Requesting a method the server doesn't support
PROPFIND /webdav/ HTTP/1.1
Host: example.com

# Response
HTTP/1.1 501 Not Implemented

{
  "error": "The PROPFIND method is not supported on this server."
}
```

### 502 Bad Gateway

The server, acting as a gateway or proxy, received an invalid response from an upstream server:

```
# Cloudflare (proxy) → Nginx (origin)
# Nginx crashes or returns malformed data

Cloudflare response:
HTTP/1.1 502 Bad Gateway
Content-Type: text/html

<html>
<body>
<h1>502 Bad Gateway</h1>
<p>The server received an invalid response from the upstream server.</p>
</body>
</html>
```

Common causes: upstream server crash, timeout, or misconfiguration.

### 503 Service Unavailable

The server is temporarily unable to handle the request. Often used during maintenance or when overloaded:

```
# During maintenance
HTTP/1.1 503 Service Unavailable
Retry-After: 3600
Content-Type: text/html

<html>
<body>
<h1>Maintenance in progress</h1>
<p>We expect to be back online in 1 hour.</p>
<p>Retry-After: 3600</p>
</body>
</html>
```

### 504 Gateway Timeout

The server, acting as a gateway or proxy, did not receive a timely response from an upstream server:

```
# Cloudflare → Nginx → Node.js
# Node.js takes 120 seconds to respond, but Cloudflare timeout is 100 seconds

Cloudflare response:
HTTP/1.1 504 Gateway Timeout
```

> [!tip] Fixing 504 timeouts
> 1. Optimize the backend (database queries, caching)
> 2. Increase upstream timeout (Nginx `proxy_read_timeout`)
> 3. Increase Cloudflare timeout (requires Business/Enterprise plan)
> 4. Add a loading state on the frontend

## Common HTTP errors and their fixes

| Error | Code | Common cause | Fix |
|-------|------|-------------|-----|
| **Bad Request** | 400 | Malformed JSON, missing fields | Validate input before sending |
| **Unauthorized** | 401 | Missing or invalid auth token | Check credentials, refresh token |
| **Forbidden** | 403 | Insufficient permissions | Check user roles, ACLs |
| **Not Found** | 404 | Wrong URL, deleted resource | Check URL, verify route exists |
| **Method Not Allowed** | 405 | Wrong HTTP method | Use correct method (GET, POST, etc.) |
| **Unsupported Media Type** | 415 | Wrong Content-Type header | Set `Content-Type: application/json` |
| **Payload Too Large** | 413 | File exceeds size limit | Compress, split, or increase limit |
| **Internal Server Error** | 500 | Unhandled server exception | Check server logs |
| **Bad Gateway** | 502 | Upstream server down/malformed | Check origin server |
| **Service Unavailable** | 503 | Server overloaded/maintenance | Check server health, retry later |
| **Gateway Timeout** | 504 | Upstream server too slow | Optimize backend, increase timeout |

## Status code best practices

### Choosing the right status code

| Situation | Status Code |
|-----------|-------------|
| Resource created successfully | **201 Created** |
| Resource updated successfully | **200 OK** |
| Resource deleted successfully | **204 No Content** |
| Resource not found | **404 Not Found** |
| Authentication required | **401 Unauthorized** |
| Permission denied | **403 Forbidden** |
| Validation error | **422 Unprocessable Entity** |
| Rate limit exceeded | **429 Too Many Requests** |
| Server crash | **500 Internal Server Error** |
| Upstream server error | **502 Bad Gateway** |
| Overloaded / maintenance | **503 Service Unavailable** |
| Upstream timeout | **504 Gateway Timeout** |

### Error response format

REST APIs commonly return structured error responses:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request contains invalid data",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format",
        "value": "not-an-email"
      },
      {
        "field": "name",
        "message": "Name is required",
        "value": ""
      }
    ]
  }
}
```

### Status codes in middleware chains

```javascript
// Express.js error handling middleware
app.use((err, req, res, next) => {
  // Default to 500
  let statusCode = 500;
  let message = 'Internal Server Error';

  if (err.name === 'ValidationError') {
    statusCode = 422;
    message = err.message;
  } else if (err.name === 'UnauthorizedError') {
    statusCode = 401;
    message = 'Invalid or expired token';
  } else if (err.name === 'NotFoundError') {
    statusCode = 404;
    message = err.message;
  }

  res.status(statusCode).json({
    error: {
      code: err.name,
      message: message
    }
  });
});
```

## Connection with the rest of the wiki

| Concept | In-depth article |
|---------|-----------------|
| HTTP methods | [[05-http-deep-dive]] |
| Client-server model | [[01-what-is-internet]] |
| Authentication | [[10-authentication-api-keys-tokens]] |
| REST APIs | [[11-rest-api]] |

## Summary

- **1xx** responses are informational (Continue, Switching Protocols, Early Hints).
- **2xx** responses indicate success (200 OK, 201 Created, 204 No Content).
- **3xx** responses are redirections (301 Permanent, 302 Temporary, 304 Not Modified).
- **4xx** responses are client errors (400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found, 429 Too Many Requests).
- **5xx** responses are server errors (500 Internal Server Error, 502 Bad Gateway, 503 Service Unavailable, 504 Gateway Timeout).
- Always use the **most specific** status code possible. 422 is more informative than 400; 502 is more informative than 500.
- Never expose internal error details in production responses.

> [!quote] The key takeaway
> Status codes are a contract between client and server. Using them correctly makes APIs predictable, debuggable, and professional. Each code has a specific meaning — pick the right one.
