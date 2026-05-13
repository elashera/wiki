---
title: "APIs REST: principios, recursos y HATEOAS"
description: "REST explicado a fondo: principios, recursos y URLs, métodos HTTP semánticos, HATEOAS, versionado, GraphQL/RPC vs REST, y errores comunes."
---

# REST: Todo sobre APIs REST

> [!tip] REST en una frase
> REST es un **estilo de arquitectura** para diseñar APIs web que usan HTTP como protocolo, con recursos identificables por URLs, métodos HTTP semánticos y respuestas en formato JSON.

## ¿Qué es REST?

REST (Representational State Transfer) es un conjunto de **principios** (no un protocolo) propuesto por Roy Fielding en 2000. Define cómo diseñar servicios web que sean:

- **Escalables**: El servidor puede manejar miles de peticiones sin colapsar
- **Stateless**: Cada petición contiene toda la información necesaria
- **Interoperable**: Cualquier cliente (navegador, móvil, IoT) puede hablar con cualquier servidor
- **Capas**: Se pueden interponer proxies y caches entre cliente y servidor

### Los 6 principios de REST

| Principio | Descripción | ¿Importante? |
|-----------|-------------|-------------|
| **1. Cliente-servidor** | Separación clara entre interfaz y datos | ✅ Siempre |
| **2. Stateless** | Cada petición es independiente | ✅ Siempre |
| **3. Cacheable** | Las respuestas pueden cachearse | ✅ Siempre |
| **4. Interfaz uniforme** | 4 restricciones: recursos, representación, auto-descripción, HATEOAS | ✅✅ Siempre |
| **5. Capas** | Arquitectura en capas (proxy, load balancer) | ✅ Siempre |
| **6. Código bajo demanda** | Opcional: el servidor puede enviar código ejecutable | ❌ Raro de usar |

### REST es un estilo, no una norma

> [!warning] "REST" es mal usado
> Muchas APIs que se llaman "REST" no son realmente RESTful. Lo común hoy en día es una API HTTP con JSON que usa métodos y status codes correctamente. Eso es lo que vamos a cubrir.

**De lo que NO trata REST:**
- No es un protocolo
- No requiere XML (aunque se podía)
- No requiere HATEOAS
- No requiere verbos custom

## Recursos y URLs

En REST, **todo es un recurso**. Un recurso es cualquier cosa que quieras exponer: usuarios, productos, artículos, etc.

### Principio de URLs

```
# Colección → GET /recursos (lista todos)
GET    /users        → Lista todos los usuarios (200)
POST   /users        → Crea un usuario (201)

# Recurso individual → GET /recursos/:id
GET    /users/42     → Obtiene el usuario con ID 42 (200)
PUT    /users/42     → Reemplaza el usuario 42 (200)
PATCH  /users/42     │ Actualiza parcialmente el usuario 42 (200)
DELETE /users/42     │ Elimina el usuario 42 (204)

# Recursos anidados → /padre/:id/hijo
GET    /users/42/posts     → Posts del usuario 42
POST   /users/42/posts     → Crea un post para el usuario 42
GET    /users/42/posts/7   → El post 7 del usuario 42

# Filtrado, paginación, ordenación
GET    /users?role=admin&status=active
GET    /users?page=2&limit=20
GET    /users?sort=-created_at    # - para descendente
```

> [!tip] URLs deben ser sustantivos, no verbos
> ```
# MALO: verbos en la URL
GET /getUsers
POST /createUser
DELETE /deleteUser/42

# BUENO: recursos + métodos HTTP
GET    /users
POST   /users
DELETE /users/42
```

### Recursos vs acciones

```
# MALO: acción en la URL
POST /users/42/disable
POST /users/42/enable

# BUENO: PATCH con campo de estado
PATCH /users/42
{ "status": "disabled" }

# MALO: acción en la URL
POST /posts/7/comments

# BUENO: recurso anidado
POST /posts/7/comments
```

> [!caution] Anidación profunda
> ```
# MALO: 3 niveles de anidación
GET /users/42/posts/7/comments/15/replies

# BUENO: máximo 1-2 niveles, o IDs directos
GET /comments/15/replies
GET /replies?comment_id=15
```

## Métodos HTTP semánticos

Cada método tiene un significado específico. Úsalos correctamente:

| Método | Usar para | Idempotente | Seguro |
|--------|----------|-------------|--------|
| **GET** | Leer recursos | ✅ | ✅ |
| **POST** | Crear recursos, ejecutar acciones | ❌ | ❌ |
| **PUT** | Reemplazar recurso completo | ✅ | ❌ |
| **PATCH** | Actualización parcial | ❌ | ❌ |
| **DELETE** | Eliminar recurso | ✅ | ❌ |

### POST para acciones

POST no es solo para crear recursos. Úsalo para acciones que no encajan en CRUD:

```
# Acciones que no son CRUD
POST /users/42/reset-password
POST /sessions          → Login (crea una sesión)
POST /payments/process  → Procesar pago
POST /export/pdf        → Generar PDF

# Pero si la acción es un recurso en sí mismo, usa POST al recurso:
POST /payments          → Crea un nuevo pago
```

> [!tip] ¿Cuándo crear un recurso vs ejecutar una acción?
> Si la acción tiene un ID, tiene historial, o puedes listar múltiples, es un recurso:
> - "Hacer un pago" → `POST /payments` (sí, es recurso)
> - "Resetear password" → `POST /users/42/reset-password` (no es recurso, no se puede listar)
> - "Publicar un post" → `POST /posts` (sí, es recurso)
> - "Hacer logout" → `POST /sessions/current` (debatible — muchos lo tratan como recurso)

## Respuestas JSON

Las APIs modernas devuelven **JSON** como formato principal:

```json
{
    "id": 42,
    "name": "Carlos",
    "email": "carlos@email.com",
    "role": "admin",
    "created_at": "2024-01-15T10:00:00Z",
    "updated_at": "2024-01-20T15:30:00Z"
}
```

### Listas con paginación

```json
{
    "data": [
        { "id": 42, "name": "Carlos" },
        { "id": 43, "name": "Ana" },
        { "id": 44, "name": "Luis" }
    ],
    "pagination": {
        "page": 2,
        "limit": 20,
        "total": 156,
        "total_pages": 8,
        "has_next": true,
        "has_prev": true
    }
}
```

### Errores estandarizados

```json
{
    "error": {
        "code": "USER_NOT_FOUND",
        "message": "User with id 999 not found",
        "status": 404
    }
}
```

> [!tip] Estructura de error consistente
> Usa siempre la misma estructura para errores. Así el frontend puede manejarlos unificados:
> ```json
{
    "error": {
        "code": "STRING_CODE",
        "message": "Descripción legible para el usuario",
        "details": { /* campos con errores de validación */ },
        "status": 400
    }
}
```

## HATEOAS (Hypermedia as the Engine of Application State)

HATEOAS es el principio más controvertido de REST. Significa que las respuestas del servidor incluyen **links** que el cliente puede seguir:

```json
{
    "id": 42,
    "name": "Carlos",
    "email": "carlos@email.com",
    "links": {
        "self": "/users/42",
        "posts": "/users/42/posts",
        "comments": "/users/42/comments",
        "update": {
            "method": "PATCH",
            "href": "/users/42"
        },
        "delete": {
            "method": "DELETE",
            "href": "/users/42"
        }
    }
}
```

> [!note] HATEOAS en la práctica
> HATEOAS es **muy poco usado** en APIs REST modernas. La razón:
> - Agrega complejidad al servidor (generar links dinámicamente)
> - Agrega complejidad al cliente (necesita entender la estructura de links)
> - La mayoría de APIs usan OpenAPI/Swagger para documentación en lugar de HATEOAS
>
> **Veredicto**: No lo uses a menos que tengas un motivo específico. Las APIs REST modernas casi nunca lo implementan.

## GraphQL vs REST vs RPC

### Comparación

| Característica | REST | GraphQL | RPC (gRPC, JSON-RPC) |
|---------------|------|---------|----------------------|
| **Endpoint** | Varios (`/users`, `/posts`) | Uno (`/graphql`) | Varios o uno |
| **Datos** | Datos fijos por endpoint | Cliente pide exactamente lo que necesita | Datos fijos |
| **Overfetching** | Posible (recibe todos los campos) | No (piden solo lo necesario) | Depende |
| **Underfetching** | Posible (necesita múltiples llamadas) | No (todo en una llamada) | Depende |
| **Type system** | Ninguno (OpenAPI opcional) | Schema fuerte | Protocol buffers / strong typing |
| **Caching** | HTTP cache nativo | Necesita caché a nivel cliente | No (cada llamada es nueva) |
| **Learning curve** | Baja | Media-Alta | Alta |
| **Herramientas** | HTTP + JSON | GraphQL playground | gRPC tools, etc. |

### ¿Cuándo usar cada uno?

| Escenario | Recomendación | Por qué |
|-----------|--------------|---------|
| **API pública** | REST | Simple, estandarizado, cachéable |
| **App móvil** | REST o GraphQL | REST si la API es simple, GraphQL si necesitas flexibilidad |
| **Dashboard interno** | GraphQL | Equipo pequeño, muchos tipos de datos diferentes |
| **Microservicios** | gRPC | Alta performance, strong typing |
| **Pocos endpoints** | REST | Simple, rápido de implementar |
| **Muchas variantes de datos** | GraphQL | Un endpoint, datos flexibles |

> [!tip] REST y GraphQL no son mutuamente excluyentes
> Muchos proyectos usan ambos: REST para la API pública, GraphQL para el dashboard interno. O viceversa.

## Versionado de APIs

```
# Versionado en la URL (más común)
/api/v1/users
/api/v2/users

# Versionado en header
Accept: application/vnd.ejemplo.v1+json

# Versionado en query param
/users?version=1
```

> [!tip] Versionado en URL es lo más práctico
> - `GET /api/v1/users` → fácil de debuggear, fácil de entender
> - `Accept: application/vnd.ejemplo.v1+json` → más REST puro pero más complejo
> - **Nunca hagas breaking changes** en la misma versión

## Documentación de APIs

```
# OpenAPI / Swagger (REST)
https://editor.swagger.io/
Genera documentación interactiva desde un archivo YAML/JSON

# GraphQL
GraphQL tiene introspection integrada
http://localhost:4000/graphql → Playground automático

# Postman Collections
Colecciones de peticiones que se pueden ejecutar directamente
```

## Errores comunes en APIs REST

| Error | Correcto | Incorrecto |
|-------|----------|-----------|
| **Verbos en URLs** | `DELETE /users/42` | `DELETE /users/42/delete` |
| **Colecciones en singular** | `GET /users` | `GET /user` |
| **No usar 404** | `GET /users/999 → 404` | `GET /users/999 → 200 { "null" }` |
| **No usar 405** | `POST /users/42 → 405` | `POST /users/42 → 200 con mensaje de error` |
| **JSON dentro de array innecesario** | `{ "data": [...] }` | `[{...}, {...}]` (sin wrapper) |
| **Campos camelCase vs snake_case** | `user_id` o `userId` (consistente) | Mezclar ambos |
| **Fechas sin ISO 8601** | `"2024-01-15T10:00:00Z"` | `"15/01/2024"` o timestamp |
| **No paginar listas largas** | `?page=1&limit=20` | `GET /users → [10000 elementos]` |

## Resumen

- REST se basa en recursos identificados por URLs + métodos HTTP semánticos
- GET=Leer, POST=Crear, PUT=Reemplazar, PATCH=Actualizar, DELETE=Eliminar
- Las URLs son sustantivos, no verbos
- Las respuestas son JSON con estructura consistente
- HATEOAS es un principio REST pero casi nunca se usa en la práctica
- Versionado en URL (`/api/v1/`) es el enfoque más práctico
- OpenAPI/Swagger es el estándar para documentación de APIs REST

> [!quote] La clave
> REST no es una norma estricta, es un conjunto de principios. Las APIs modernas que llaman "REST" suelen ser APIs HTTP con JSON que siguen los principios básicos (recursos + métodos + status codes) sin llegar a ser "puros" REST.

## Conexión con el resto de la wiki

| Concepto tocado | Artículo en profundidad |
|-----------------|------------------------|
| HTTP métodos y headers | [[05-http-profundo]] |
| Status codes | [[06-status-codes]] |
| Autenticación (JWT, tokens) | [[10-autenticacion-api-keys-tokens]] |
| Cookies/Sesiones | [[09-cookies-sesiones]] |
