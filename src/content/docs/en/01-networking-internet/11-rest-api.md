---
title: "REST: Principles, Resources, HTTP Verbs, HATEOAS, GraphQL/RPC Differences"
description: "REST API design: architectural principles, resources, HTTP verbs, status codes, HATEOAS, pagination, versioning, and how REST differs from GraphQL and RPC."
---

# REST: Principles, Resources, HTTP Verbs, HATEOAS, GraphQL/RPC Differences

> [!tip] REST in a nutshell
> REST (Representational State Transfer) is an architectural style for designing networked applications. It relies on standard HTTP methods, stateless communication, and resource-based URLs. This article covers REST principles, best practices, and how it compares to GraphQL and RPC.

## What is REST?

REST is an **architectural style** defined by Roy Fielding in his 2000 PhD dissertation. It is not a protocol, not a standard — it is a set of constraints that, when followed, produce simple, scalable, and maintainable APIs.

### Roy Fielding's REST constraints

For an API to be "RESTful", it must satisfy these constraints:

1. **Client-server**: Separation of concerns (client handles UI, server handles data)
2. **Stateless**: Each request contains all information needed; server stores no client state
3. **Cacheable**: Responses must define themselves as cacheable or not
4. **Uniform interface**: Resources identified, manipulated via representations, self-descriptive messages, HATEOAS
5. **Layered system**: Client cannot tell if it is connected directly to the origin server or through intermediaries
6. **Code on demand** (optional): Servers can extend client functionality (e.g., JavaScript)

> [!note] "True REST" vs "RESTful APIs"
> Most APIs called "REST" only satisfy constraints 1, 2, 3, and 4 (without HATEOAS). True REST (with HATEOAS) is rare. Most developers use "REST" to mean "HTTP API with resources and standard HTTP methods".

## REST Resources

In REST, everything is a **resource** — a piece of data that can be identified and manipulated.

### Resource identification

Resources are identified by URIs:

```
GET /users/123          → A specific user resource
GET /users              → Collection of user resources
GET /users/123/orders   → Orders belonging to a specific user
GET /products/456/images/original.jpg  → A specific image resource
```

### Representations

Resources are represented in different formats:

```
Same resource, different representations:
GET /users/123
Accept: application/json
→ { "id": 123, "name": "John", "email": "john@example.com" }

GET /users/123
Accept: application/xml
→ <user><id>123</id><name>John</name><email>john@example.com</email></user>

GET /users/123
Accept: text/html
→ <html><body><h1>John</h1><p>john@example.com</p></body></html>
```

## HTTP Verbs in REST

REST maps CRUD operations to HTTP methods:

| CRUD | HTTP Method | RESTful endpoint | Description |
|------|-----------|-----------------|-------------|
| **Create** | POST | `/users` | Create a new user |
| **Read** | GET | `/users` | List all users |
| **Read** | GET | `/users/123` | Get user by ID |
| **Update** | PUT | `/users/123` | Replace user entirely |
| **Update** | PATCH | `/users/123` | Partially update user |
| **Delete** | DELETE | `/users/123` | Delete user |

### HTTP method properties

| Method | Safe? | Idempotent? | Cacheable? | Body allowed? |
|--------|-------|-------------|------------|---------------|
| **GET** | Yes | Yes | Yes | No (but not forbidden) |
| **HEAD** | Yes | Yes | Yes | No |
| **POST** | No | No | Rarely | Yes |
| **PUT** | No | Yes | No | Yes |
| **PATCH** | No | No | No | Yes |
| **DELETE** | No | Yes | No | No |

### Safe and Idempotent explained

| Property | Definition | Examples |
|----------|-----------|----------|
| **Safe** | Does not modify server state | GET, HEAD, OPTIONS |
| **Idempotent** | Multiple identical requests have the same effect as one | GET, PUT, DELETE, HEAD |

```
# Idempotent: calling multiple times has the same effect as calling once
PUT /users/123 { "name": "John" }
PUT /users/123 { "name": "John" }   # Same result: user named "John"

# NOT idempotent: calling multiple times has different effects
POST /users { "name": "John" }       # Creates John #1
POST /users { "name": "John" }       # Creates John #2
POST /users { "name": "John" }       # Creates John #3
```

### RESTful URL design

```
# GOOD: Noun-based, hierarchical
GET    /users              → List users
GET    /users/123          → Get user 123
POST   /users              → Create user
PUT    /users/123          → Update user 123
DELETE /users/123          → Delete user 123

GET    /users/123/orders   → Get orders for user 123
POST   /users/123/orders   → Create order for user 123

# BAD: Verb-based URLs (not RESTful)
GET    /getUsers           → Should be GET /users
GET    /getUser?id=123     → Should be GET /users/123
POST   /createUser         → Should be POST /users
POST   /deleteUser?id=123  → Should be DELETE /users/123
```

## REST API example

### Complete user management API

```
# List all users
GET /api/v1/users
Authorization: Bearer token
Accept: application/json

→ 200 OK
{
  "data": [
    { "id": 1, "name": "Alice", "email": "alice@example.com" },
    { "id": 2, "name": "Bob", "email": "bob@example.com" }
  ],
  "meta": { "total": 42, "page": 1, "per_page": 20 }
}

# Get a single user
GET /api/v1/users/123
Authorization: Bearer token

→ 200 OK
{
  "data": {
    "id": 123,
    "name": "John Doe",
    "email": "john@example.com",
    "created_at": "2026-01-15T10:30:00Z",
    "links": {
      "self": "/api/v1/users/123",
      "orders": "/api/v1/users/123/orders"
    }
  }
}

# Create a new user
POST /api/v1/users
Authorization: Bearer token
Content-Type: application/json

{ "name": "John Doe", "email": "john@example.com" }

→ 201 Created
{
  "data": {
    "id": 124,
    "name": "John Doe",
    "email": "john@example.com"
  }
}

# Update a user (replace)
PUT /api/v1/users/123
Authorization: Bearer token
Content-Type: application/json

{ "name": "John Smith", "email": "john.smith@example.com" }

→ 200 OK
{ "data": { "id": 123, "name": "John Smith", "email": "john.smith@example.com" } }

# Partially update a user
PATCH /api/v1/users/123
Authorization: Bearer token
Content-Type: application/json

{ "name": "John Smith Jr." }

→ 200 OK
{ "data": { "id": 123, "name": "John Smith Jr.", "email": "john.smith@example.com" } }

# Delete a user
DELETE /api/v1/users/123
Authorization: Bearer token

→ 204 No Content

# Validation error
POST /api/v1/users
Authorization: Bearer token
Content-Type: application/json

{ "name": "", "email": "not-an-email" }

→ 422 Unprocessable Entity
{
  "errors": {
    "name": "Name cannot be empty",
    "email": "Invalid email format"
  }
}
```

## REST Best Practices

### 1. Versioning

```
# URI versioning (most common)
/api/v1/users
/api/v2/users

# Header versioning
Accept: application/vnd.api.v1+json

# Query parameter versioning
/api/users?version=1

# URI versioning is the most common and easiest to debug
```

### 2. Pagination

```
GET /api/v1/users?page=2&limit=20

→ 200 OK
{
  "data": [ ... 20 users ... ],
  "meta": {
    "total": 420,
    "page": 2,
    "per_page": 20,
    "last_page": 21
  },
  "links": {
    "first": "/api/v1/users?page=1",
    "last": "/api/v1/users?page=21",
    "prev": "/api/v1/users?page=1",
    "next": "/api/v1/users?page=3"
  }
}
```

### 3. Filtering and sorting

```
# Filtering
GET /api/v1/users?role=admin&status=active
GET /api/v1/products?category=electronics&min_price=10&max_price=100

# Sorting
GET /api/v1/users?sort=created_at:desc
GET /api/v1/products?sort=name:asc

# Field selection
GET /api/v1/users/123?fields=id,name,email
→ { "id": 123, "name": "John", "email": "john@example.com" }
```

### 4. HATEOAS (Hypermedia as the Engine of Application State)

HATEOAS means responses include links to related resources, allowing clients to navigate the API without hardcoding URLs:

```
GET /api/v1/users/123

→ 200 OK
{
  "id": 123,
  "name": "John Doe",
  "email": "john@example.com",
  "_links": {
    "self": { "href": "/api/v1/users/123" },
    "orders": { "href": "/api/v1/users/123/orders" },
    "update": { "href": "/api/v1/users/123", "method": "PUT" },
    "delete": { "href": "/api/v1/users/123", "method": "DELETE" },
    "owner": { "href": "/api/v1/organizations/456" }
  }
}
```

> [!note] HATEOAS in practice
> While HATEOAS is a core REST constraint, most real-world APIs skip it. The trade-off: HATEOAS makes APIs more discoverable but adds complexity. Popular formats that support HATEOAS include HAL, JSON:API, and Siren.

### 5. Error handling

```
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request contains invalid data",
    "details": [
      { "field": "email", "message": "Invalid email format" }
    ],
    "status": 422,
    "trace_id": "req-abc-123"
  }
}
```

## REST vs GraphQL

### REST

```
# Multiple endpoints for different data needs
GET /users/123          → Returns user + related data
GET /users/123/orders   → Returns only orders
GET /users/123/posts    → Returns only posts

# Over-fetching: getting data you don't need
GET /users/123
→ { "id": 1, "name": "John", "email": "j@e.com", "password_hash": "...", "ssn": "...", ... }

# Under-fetching: needing multiple requests
GET /users/123        → Get user
GET /users/123/orders → Get orders
GET /users/123/posts  → Get posts
```

### GraphQL

```
# Single endpoint, flexible queries
POST /graphql
{
  "query": "{ user(id: 123) { name email orders { id total } } }"
}

# Exactly the data you ask for, no more, no less
→ {
  "data": {
    "user": {
      "name": "John",
      "email": "john@example.com",
      "orders": [
        { "id": 1, "total": 99.99 },
        { "id": 2, "total": 49.50 }
      ]
    }
  }
}
```

### REST vs GraphQL comparison

| Aspect | REST | GraphQL |
|--------|------|---------|
| **Endpoints** | Multiple (one per resource) | Single (`/graphql`) |
| **Data shape** | Fixed by server | Flexible (client requests what it needs) |
| **Over-fetching** | Possible | Impossible |
| **Under-fetching** | Requires multiple requests | Single query can include nested data |
| **Caching** | HTTP caching (easy) | Requires application-level caching |
| **Learning curve** | Simple (HTTP methods) | Steep (schema, queries, mutations) |
| **Tooling** | Built into HTTP | Custom (GraphiQL, Apollo, etc.) |
| **Versioning** | Required (API changes) | Schema evolution (add fields, deprecate) |
| **Complexity** | Low | Medium to high |
| **Best for** | Simple APIs, CRUD apps | Complex data requirements, mobile apps |

## REST vs RPC (JSON-RPC / XML-RPC)

### RPC-style API

```
# RPC: Function calls over HTTP
POST /rpc
{
  "method": "getUser",
  "params": { "id": 123 }
}

→ {
  "result": { "id": 123, "name": "John", "email": "john@example.com" }
}

POST /rpc
{
  "method": "createUser",
  "params": { "name": "John", "email": "john@example.com" }
}

→ {
  "result": { "id": 124, "name": "John", "email": "john@example.com" }
}
```

### REST vs RPC comparison

| Aspect | REST | RPC |
|--------|------|-----|
| **Focus** | Resources (data) | Actions (functions) |
| **URLs** | Nouns (`/users/123`) | Verbs (`/getUser`) |
| **Methods** | HTTP methods (GET, POST, PUT, DELETE) | Usually POST for everything |
| **State** | Stateless | Can be stateful |
| **Discoverability** | URLs are self-documenting | Method names must be documented |
| **Caching** | HTTP cache-friendly | Not cache-friendly (always POST) |
| **Flexibility** | Standardized (HTTP methods) | Custom (each service defines its own) |

## gRPC

gRPC is Google's RPC framework using HTTP/2 and Protocol Buffers:

```
// proto file
service UserService {
  rpc GetUser (GetUserRequest) returns (User);
  rpc ListUsers (ListUsersRequest) returns (UserList);
}

message GetUserRequest {
  string id = 1;
}

message User {
  string id = 1;
  string name = 2;
  string email = 3;
}
```

### REST vs gRPC comparison

| Aspect | REST | gRPC |
|--------|------|------|
| **Data format** | JSON (text) | Protocol Buffers (binary) |
| **Transport** | HTTP/1.1, HTTP/2, HTTP/3 | HTTP/2 |
| **Performance** | Good | Better (binary, compressed) |
| **Human readable** | Yes (JSON) | No (binary protobuf) |
| **Language support** | Any (HTTP) | Generated from proto files |
| **Streaming** | Limited (WebSocket) | Built-in (server, client, bidirectional) |
| **Best for** | Public APIs, web | Internal microservices, high-performance |

## REST API design checklist

- [ ] Use **nouns** for resource names (`/users`, not `/getUsers`)
- [ ] Use **HTTP methods** correctly (GET for reads, POST for create, PUT for replace, PATCH for update, DELETE for remove)
- [ ] Use **HTTP status codes** appropriately (200, 201, 204, 400, 401, 403, 404, 422, 500)
- [ ] Use **plural nouns** for collections (`/users`, not `/user`)
- [ ] Use **nested resources** for relationships (`/users/123/orders`)
- [ ] Support **pagination**, **filtering**, and **sorting** for collections
- [ ] Use **consistent error format** across all endpoints
- [ ] Version your API (`/api/v1/...`)
- [ ] Use **HTTPS** for all endpoints
- [ ] Document your API (OpenAPI/Swagger specification)

## Connection with the rest of the wiki

| Concept | In-depth article |
|---------|-----------------|
| HTTP methods and semantics | [[05-http-deep-dive]] |
| Status codes | [[06-status-codes]] |
| Authentication | [[10-authentication-api-keys-tokens]] |
| GraphQL | [[11-rest-api]] (this article) |

## Summary

- REST is an **architectural style** with 6 constraints (client-server, stateless, cacheable, uniform interface, layered system, HATEOAS).
- Resources are identified by **URIs** and manipulated using **HTTP methods**.
- **POST** (create), **GET** (read), **PUT** (replace), **PATCH** (update), **DELETE** (remove) map to CRUD operations.
- **Idempotent** methods (GET, PUT, DELETE) can be retried safely.
- **HATEOAS** adds hypermedia links to responses, enabling client navigation.
- **REST vs GraphQL**: REST has fixed endpoints and data shapes; GraphQL has a single endpoint and flexible queries.
- **REST vs RPC**: REST is resource-oriented; RPC is action-oriented.
- gRPC uses Protocol Buffers over HTTP/2 for high-performance internal communication.

> [!quote] The key takeaway
> REST is about modeling your API around **resources** using standard **HTTP methods**. It is simple, scalable, and works with the existing HTTP infrastructure. Whether to use REST, GraphQL, or gRPC depends on your data complexity, performance needs, and client requirements.
