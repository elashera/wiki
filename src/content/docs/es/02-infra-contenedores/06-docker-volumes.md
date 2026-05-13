---
title: "Docker volumes: persistencia de datos, named volumes, bind mounts, tmpfs y estrategias de backup"
description: "Guía completa de almacenamiento en Docker: tipos de volúmenes (named, bind mount, tmpfs), drivers de volúmenes, persistencia, backup strategies y gestión del ciclo de vida de datos."
---

# Docker volumes: persistencia de datos, named volumes, bind mounts, tmpfs y estrategias de backup

> [!tip] Volumes Docker en una frase
> Los **volúmenes Docker** son el mecanismo oficial para persistir datos entre reinicios y recreaciones de contenedores. A diferencia de los contenedores (que son efímeros), los volúmenes sobreviven a la eliminación de contenedores y pueden compartirse entre contenedores.

## ¿Por qué persistencia en contenedores?

Los contenedores Docker son **efímeros**: cuando se eliminan, todo su sistema de archivos desaparece. Para bases de datos, archivos de configuración, logs y cualquier dato que deba sobrevivir, necesitas almacenamiento persistente:

```
Sin almacenamiento persistente:
┌──────────────────────────────────────┐
│  Contenedor 1: "mi-app"              │
│  ┌────────────────────────────────┐  │
│  │  /app (código)                  │  │  ← Capa de solo lectura (imagen)
│  │  /data (archivos del usuario)   │  │  ← Capa de escritura (rw)
│  │  /logs (logs)                  │  │  ← Capa de escritura (rw)
│  └────────────────────────────────┘  │
│                                       │
│  docker rm mi-app → TODOS los datos  │
│  de /data y /logs se PIERDEN         │
└──────────────────────────────────────┘

Con volúmenes:
┌──────────────────────────────────────┐  ┌──────────────────────┐
│  Contenedor 1: "mi-app"              │  │  Volumen: app-data   │
│  ┌────────────────────────────────┐  │  │  /var/lib/docker/    │
│  │  /app (código)                  │  │  │  volumes/app-data/   │
│  │  /data (mountado al volumen)   │  │  │  - archivo1.db       │
│  └────────────────────────────────┘  │  │  - archivo2.log      │
└──────────────────────────────────────┘  └──────────────────────┘
                                               │
                                               │  Survives container
                                               │  removal!
                                               │  Shareable between
                                               │  containers!
                                               │  Backup-able!
```

## Tipos de almacenamiento Docker

Docker tiene **tres tipos principales** de almacenamiento persistente:

### 1. Named Volumes (volúmenes con nombre)

El **tipo recomendado** para persistencia de datos en contenedores Docker.

```bash
# Crear un volumen nombrado
docker volume create my-data

# Usar el volumen al crear un contenedor
docker run -d \
  --name my-app \
  -v my-data:/app/data \
  nginx:latest

# Los datos persisten incluso si eliminas el contenedor
docker rm my-app
docker ps -a    # Contenedor eliminado
docker volume ls # Volumen sigue existiendo

# Reutilizar el mismo volumen con un nuevo contenedor
docker run -d \
  --name my-app-new \
  -v my-data:/app/data \
  nginx:latest
```

```
Estructura de un volumen nombrado:
┌─────────────────────────────────────────────┐
│  /var/lib/docker/volumes/                   │
│    └── my-data/                             │
│        ├── _data/                           │
│        │   ├── archivo1.db                  │
│        │   ├── archivo2.log                 │
│        │   └── subfolder/                   │
│        │       └── dato.dat                 │
│        └── metadata.json                    │
│            (gestionado por Docker)           │
└─────────────────────────────────────────────┘

Características:
  - Gestionados por Docker (no puedes editar directamente)
  - Se crean en /var/lib/docker/volumes/
  - Pueden montarse en múltiples contenedores
  - Surviven eliminación de contenedores
  - Se pueden backup/restore fácilmente
```

### 2. Bind Mounts (montajes de directorio)

Montan un **directorio específico del host** dentro del contenedor:

```bash
# Bind mount: carpeta local → contenedor
docker run -d \
  --name my-app \
  -v $(pwd)/src:/app/src \
  nginx:latest

# Bind mount con ruta absoluta
docker run -d \
  --name my-app \
  -v /home/user/data:/app/data \
  nginx:latest

# Bind mount de solo lectura
docker run -d \
  --name my-app \
  -v /home/user/config:/app/config:ro \
  nginx:latest
```

```
Bind mount vs Named volume:
┌─────────────────────┬─────────────────────┬─────────────────────┐
│  Característica     │  Named Volume       │  Bind Mount         │
├─────────────────────┼─────────────────────┼─────────────────────┤
│  Ubicación          │ /docker/volumes/    │  Ruta que tú        │
│                     │  (gestionado por    │  especifiques       │
│                     │  Docker)            │                     │
│  Control            │  Docker gestiona    │  Tú controlas       │
│                     │  la ruta            │  la ruta            │
│  Uso típico         │  Producción, BD     │  Desarrollo, conf.  │
│  Multi-plataforma   │  ✅ Sí              │  ❌ Depende del SO  │
│  Creación automática│  No (hay que crear) │  Sí (si existe)     │
│  Performance        │  Ligeramente menor  │  Nativa (sin capa)  │
│  Permisos           │  Docker gestiona    │  Host/contenedor    │
└─────────────────────┴─────────────────────┴─────────────────────┘
```

### 3. tmpfs mounts (almacenamiento temporal)

Monta un **sistema de archivos temporal en memoria RAM**:

```bash
# tmpfs mount
docker run -d \
  --name temp-app \
  -v /tmp/data:type=tmpfs \
  nginx:latest

# tmpfs con límites de tamaño
docker run -d \
  --name temp-app \
  --tmpfs /tmp/data:size=100M \
  nginx:latest
```

```
tmpfs mounts:
┌──────────────────────────────────────────┐
│  Ventajas:                              │
│  - Muy rápido (RAM, no disco)           │
│  - Datos se borran al eliminar el       │
│    contenedor                           │
│  - No ocupa espacio en disco del host   │
│  - Seguro para datos temporales/sensibles│
│                                         │
│  Desventajas:                            │
│  - Se pierden al reiniciar              │
│  - Limitado por RAM disponible          │
│  - No persiste                          │
│                                         │
│  Casos de uso:                          │
│  - Sesiones temporales                  │
│  - Tokens, credenciales en runtime      │
│  - Archivos temporales                  │
│  - Cache de alto rendimiento            │
│  - Datos sensibles que no deben ir a    │
│    disco                               │
└──────────────────────────────────────────┘
```

## Gestión de volúmenes

### Crear y gestionar volúmenes

```bash
# Crear un volumen
docker volume create my-data

# Crear con driver específico
docker volume create \
  --driver local \
  --opt type=none \
  --opt device=/mnt/data \
  --opt o=bind \
  host-backed-data

# Listar volúmenes
docker volume ls
# DRIVER    VOLUME NAME
# local     my-data
# local     pg-data
# local     redis-data

# Inspeccionar un volumen
docker volume inspect my-data
# [
#   {
#     "CreatedAt": "2024-01-15T10:30:00Z",
#     "Driver": "local",
#     "Labels": null,
#     "Mountpoint": "/var/lib/docker/volumes/my-data/_data",
#     "Name": "my-data",
#     "Options": null,
#     "Scope": "local"
#   }
# ]

# Eliminar un volumen
docker volume rm my-data

# Eliminar todos los volúmenes no usados
docker volume prune
docker volume prune -f  # Sin confirmación
```

### Mount points

```bash
# mount point de un contenedor específico
docker run -d -v my-data:/app/data --name test-app nginx:latest
docker inspect test-app --format='{{range .Mounts}}{{.Name}}: {{.Destination}}\n{{end}}'
# my-data: /app/data
```

## Mount options y comportamiento

### mount propagation

```bash
# mount propagation controla cómo se propagan los mount points
# entre contenedores

# shared: los mounts creados en cualquier contenedor aparecen en todos
docker volume create shared-data
docker run -d -v shared-data:/data --mount-propagation=shared --name c1 alpine:3.19

# Bind mount con propagation
docker run -d \
  -v /mnt/data:/data:shared \
  --name c1 \
  alpine:3.19

# rshared: propagación recursiva (todo dentro se propaga)
docker run -d \
  -v /mnt/data:/data:rshared \
  --name c1 \
  alpine:3.19

# Propagación típica:
# - shared: para storage como CephFS, NFS
# - rshared: para setups complejos de clustering
# - privado (default): mounts locales, no propagan
```

### mount consistency

```bash
# Consistencia del mount:
# - delegated: el contenedor es autoridad sobre el mount (dev)
# - cached: host es autoridad, contenedor caché (prod en Docker Desktop)
# - consistent: siempre同步 (más lento pero seguro)

docker run -d \
  -v $(pwd):/app:cached \
  nginx:latest

# Por defecto: consistent
```

### Permissions en volumes

```bash
# Los permisos se controlan con USER en el Dockerfile o con --user
docker run -d \
  --user 1000:1000 \
  -v my-data:/app/data \
  nginx:latest

# Si hay problema de permisos, usar un volumen temporario para chown:
docker run --rm \
  -v my-data:/data \
  alpine:3.19 chown -R 1000:1000 /data

# o crear un contenedor helper:
docker run --rm \
  -v my-data:/data \
  -u "$(id -u):$(id -g)" \
  alpine:3.19 chmod -R 755 /data
```

## Volúmenes en Docker Compose

```yaml
# docker-compose.yml con volúmenes
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_PASSWORD: secret
    volumes:
      # Named volume (recomendado)
      - pg-data:/var/lib/postgresql/data
      # Bind mount para configuración
      - ./postgres/conf.d:/etc/postgresql/conf.d:ro
      # Bind mount para init scripts
      - ./postgres/init:/docker-entrypoint-initdb.d:ro

  redis:
    image: redis:7-alpine
    volumes:
      - redis-data:/data

  api:
    image: my-api:latest
    volumes:
      # Código en desarrollo (bind mount)
      - ./src:/app/src
      # Logs persistentes
      - api-logs:/var/log/app
      # Datos del usuario
      - user-uploads:/app/uploads
      # tmpfs para cache (en memoria)
      - type: tmpfs
        target: /app/cache
        tmpfs:
          size: 50M

volumes:
  pg-data:
    driver: local
    driver_opts:
      type: none
      device: /mnt/disks/ssd
      o: bind
  redis-data:
    driver: local
  api-logs:
  user-uploads:
```

## Drivers de volúmenes

Los drivers permiten usar almacenamiento externo o de terceros:

```bash
# Driver local (por defecto)
docker volume create my-local-volume
# driver: local

# Driver NFS
docker volume create \
  --driver local \
  --opt type=nfs \
  --opt o=nfsvers=4,addr=192.168.1.100,rw \
  --opt device=:/nfs/data \
  nfs-data

# Driver Flocker (descontinuado, solo histórico)

# Drivers de terceros:
# - rexray/ebs    → AWS EBS
# - rexray/gce    → Google Compute Engine
# - cinder        → OpenStack Cinder
# - azure         → Azure Files
# - portworx      → Portworx Volume
# - sparkfun      → AWS EBS

# Ejemplo con rexray/ebs (AWS):
docker volume create \
  --driver rexray/ebs \
  --opt type=gp2 \
  --opt size=100 \
  my-ebs-volume
```

```
Comparación de drivers:
┌─────────────────────┬──────────────┬──────────────┬──────────────┐
│  Driver             │  Local       │  NFS         │  AWS EBS     │
├─────────────────────┼──────────────┼──────────────┼──────────────┤
│  Performance        │  Nativa      │  Red (lento) │  SSD (rápido)│
│  Persistencia       │  Disco local │  NFS server  │  EBS vol.    │
│  Multi-host         │  ❌           │  ✅           │  ✅           │
│  Backup             │  Manual      │  rsync       │  Snapshot    │
│  Costo              │  Gratis      │  Servidor    │  $/GB/mes    │
│  Caso de uso        │  Single-host │  Compartido  │  AWS cloud   │
└─────────────────────┴──────────────┴──────────────┴──────────────┘
```

## Estrategias de backup

### Backup de volúmenes

```bash
# Backup de un volumen usando un contenedor temporal
docker run --rm \
  -v my-data:/source:ro \
  -v $(pwd):/backup \
  alpine:3.19 \
  tar czf /backup/my-data-backup-$(date +%Y%m%d).tar.gz -C /source .

# Restore de un backup
docker run --rm \
  -v my-data:/destination \
  -v $(pwd):/backup \
  alpine:3.19 \
  tar xzf /backup/my-data-backup-20240115.tar.gz -C /destination

# Backup con rsync (para backups incrementales)
docker run --rm \
  -v my-data:/source:ro \
  -v backup-data:/backup \
  alpine:3.19 \
  rsync -av /source/ /backup/my-data/
```

### Backup con contenedor helper

```bash
# Crear un contenedor helper para backups
docker run -d \
  --name backup-helper \
  -v my-data:/data:ro \
  -v /backup:/backup \
  alpine:3.19 tail -f /dev/null

# Ejecutar backup
docker exec backup-helper \
  sh -c "tar czf /backup/my-data-$(date +%Y%m%d).tar.gz -C /data ."

# Backup PostgreSQL específico
docker run --rm \
  --volumes-from postgres-container \
  -v $(pwd):/backup \
  postgres:16 \
  pg_dumpall -U appuser > /backup/pg-full-$(date +%Y%m%d).sql

# Backup MySQL específico
docker run --rm \
  --volumes-from mysql-container \
  -v $(pwd):/backup \
  mysql:8.0 \
  mysqldump -u root -p\$MYSQL_ROOT_PASSWORD --all-databases > /backup/mysql-full.sql
```

### Automatizar backups con cron

```bash
# Script de backup
# /opt/scripts/docker-backup.sh
#!/bin/bash
DATE=$(date +%Y%m%d)
VOLUME="my-data"
BACKUP_DIR="/backups"

# Crear volumen temporal
TEMP_VOL=$(docker volume create)

# Copiar datos del volumen al temporal
docker run --rm \
  -v $VOLUME:/source:ro \
  -v $TEMP_VOL:/dest \
  alpine:3.19 \
  cp -a /source/. /dest/

# Comprimir
docker run --rm \
  -v $TEMP_VOL:/data \
  -v $BACKUP_DIR:/backup \
  alpine:3.19 \
  tar czf /backup/$VOLUME-$DATE.tar.gz -C /data .

# Limpiar volumen temporal
docker volume rm $TEMP_VOL

# Mantener solo últimos 7 backups
ls -t $BACKUP_DIR/$VOLUME-*.tar.gz | tail -n +8 | xargs -r rm
```

### Estrategia de backup en producción

```
Estrategia de backup recomendada:

┌─────────────────────────────────────────────────────┐
│  Daily full backup (completo)                        │
│  ├── Lunes a Domingo: backup completo del volumen   │
│  └── Almacenar en:                                   │
│      - Disco local (para restauración rápida)        │
│      - S3/GCS (para disaster recovery)              │
│      - Tape/Blu-ray (para compliance)               │
│                                                     │
│  Retención:                                          │
│  ├── Últimos 7 días: daily backup                   │
│  ├── Últimas 4 semanas: weekly backup               │
│  └── Últimos 12 meses: monthly backup               │
│                                                     │
│  Verificación:                                      │
│  ├── Cada backup: verificar integridad (checksum)   │
│  ├── Mensualmente: probar restore                   │
│  └── Anualmente: drill completo de disaster recovery│
└─────────────────────────────────────────────────────┘
```

## Patrones de uso de volúmenes

### Patrón 1: Base de datos con data volumen

```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:16-alpine
    volumes:
      - pg-data:/var/lib/postgresql/data
    environment:
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    restart: unless-stopped

volumes:
  pg-data:
    driver: local
```

```bash
# Backup periódico
docker run --rm \
  --volumes-from postgres \
  -v /backup:/backup \
  postgres:16 \
  pg_dumpall -U appuser > /backup/pg-$(date +%Y%m%d).sql

# Restaurar
docker run --rm \
  --volumes-from postgres \
  -v /backup:/backup \
  postgres:16 \
  sh -c "cat /backup/pg-20240115.sql | psql -U appuser"
```

### Patrón 2: Datos de usuario con volumen dedicado

```yaml
services:
  webapp:
    image: my-webapp:latest
    volumes:
      - user-uploads:/app/uploads
      - user-avatars:/app/avatars

volumes:
  user-uploads:
  user-avatars:
```

```
Escalando con volumen compartido:

┌─────────────────────────────────────────────┐
│  3 instancias de la app                     │
│                                             │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐     │
│  │ Web-1   │  │ Web-2   │  │ Web-3   │     │
│  │ :8001   │  │ :8002   │  │ :8003   │     │
│  └────┬────┘  └────┬────┘  └────┬────┘     │
│       │             │             │           │
│       └─────────────┼─────────────┘           │
│                     │                         │
│              ┌──────▼──────┐                  │
│              │  user-uploads│                  │
│              │  (volumen    │                  │
│              │   compartido)│                  │
│              └─────────────┘                  │
│                                             │
│  ↑ Todos acceden al mismo volumen            │
│  ↑ Los archivos subidos por Web-1            │
│    son visibles para Web-2 y Web-3           │
└─────────────────────────────────────────────┘
```

### Patrón 3: Separar datos de configuración

```yaml
services:
  nginx:
    image: nginx:latest
    volumes:
      # Config: bind mount (cambios instantáneos)
      - ./nginx/conf.d:/etc/nginx/conf.d:ro
      # SSL certs: bind mount (archivos sensibles)
      - ./ssl:/etc/nginx/ssl:ro
      # Logs: named volume (persistencia)
      - nginx-logs:/var/log/nginx
      # Web content: bind mount (fácil actualización)
      - ./html:/usr/share/nginx/html:ro

volumes:
  nginx-logs:
```

### Patrón 4: Desarrollo con hot-reload

```yaml
services:
  api:
    build: .
    volumes:
      # Código fuente: bind mount para hot-reload
      - ./src:/app/src
      # node_modules: volume para evitar conflictos
      - /app/node_modules
      # Archivos generados: named volume
      - uploads:/app/uploads
    environment:
      - NODE_ENV=development

  # ⚠️ El volumen /app/node_modules previene que
  #    el bind mount de ./src sobrescriba node_modules
```

## Comparación completa de tipos de almacenamiento

```
Comparación final de tipos de almacenamiento Docker:

┌──────────────────┬───────────────┬───────────────┬───────────────┐
│                  │  Named Vol.   │  Bind Mount   │  tmpfs        │
├──────────────────┼───────────────┼───────────────┼───────────────┤
│  Persistencia    │  ✅ Sí         │  ✅ Sí         │  ❌ No         │
│  Ubicación       │ /docker/      │  Tu ruta      │  RAM          │
│  Performance     │  Buena        │  Nativa       │  Excelente    │
│  Multi-host      │  ❌*          │  ✅*          │  N/A          │
│  Permisos        │  Docker       │  Host         │  Contenedor   │
│  Backup          │  Docker CLI   │  cp/rsync     │  No aplica    │
│  Creación        │  docker vol   │  Crear dir    │  Implícito    │
│  Usar en prod    │  ✅✅✅        │  ✅✅          │  ✅ (temp)    │
│  Usar en dev     │  ✅           │  ✅✅✅        │  ✅           │
├──────────────────┼───────────────┼───────────────┼───────────────┤
│  Recomendación   │  BDD, datos   │  Código, conf │  Cache,       │
│                  │  permanentes  │  desarrollo   │  sesiones     │
└──────────────────┴───────────────┴───────────────┴───────────────┘

* NFS y drivers externos permiten multi-host para named volumes y bind mounts
```

## Problemas comunes y soluciones

| Problema | Causa | Solución |
|----------|-------|----------|
| `permission denied` al escribir en volumen | UID/GID mismatch | Usar `--user` o `chown` en el volumen |
| Volúmenes no se comparten entre hosts | Local driver | Usar NFS, EBS, o Ceph |
| Sin espacio en disco | Volúmenes acumulados | `docker system prune -a` |
| Datos corruptos tras crash | FS sync | Usar `sync` en mount options |
| Backup lento de BD | I/O intenso | Backup en contenedor separado, no en producción |
| Dificultad para encontrar archivos | Ruta desconocida | `docker volume inspect <name>` |

## Debug de volúmenes

```bash
# Ver dónde está mounted un volumen
docker inspect --format='{{range .Mounts}}{{.Name}} → {{.Destination}} (type: {{.Type}})\n{{end}}' container-name

# Ver espacio usado por volúmenes
docker system df -v | grep "Volumes"

# Ver volúmenes huérfanos (sin contenedor)
docker volume ls -f dangling=true

# Limpiar volúmenes no usados
docker volume prune

# Verificar integridad de un volumen
docker run --rm -v my-data:/data alpine:3.19 du -sh /data

# Backup de un volumen específico
docker run --rm -v my-data:/source -v $(pwd):/backup alpine:3.19 tar czf /backup/my-data-backup.tar.gz -C /source .
```

## Resumen

- **Named volumes**: recomendados para persistencia de datos (BDD, archivos)
- **Bind mounts**: ideales para desarrollo (código, configuración)
- **tmpfs mounts**: para datos temporales en RAM (cache, sesiones)
- **Drivers de volúmenes**: permiten almacenamiento externo (NFS, AWS EBS, GCE)
- **Backup**: usar contenedores temporales con `docker run --rm` para tar/zip
- **Multi-contenedor**: un volumen puede montarse en múltiples contenedores simultáneamente
- **Seguridad**: usar `:ro` para archivos de solo lectura
- **Gestión**: `docker volume ls`, `docker volume inspect`, `docker volume prune`

> [!quote] La clave
> En Docker, los contenedores son **desechables** pero los datos **no lo son**. Usa named volumes para datos que importan (bases de datos, archivos de usuario), bind mounts para cosas que cambian constantemente (código fuente, configuración en desarrollo), y tmpfs para datos temporales que no necesitas persistir. La separación clara entre datos y contenedores es la base de cualquier infraestructura Docker sólida.

## Conexión con el resto de la wiki

| Concepto tocado | Artículo en profundidad |
|-----------------|------------------------|
| Introducción a Docker | [[02-infra-contenedores/01-docker-intro]] |
| Imágenes Docker | [[02-infra-contenedores/02-docker-images]] |
| Contenedores | [[02-infra-contenedores/03-docker-containers]] |
| Docker Compose | [[02-infra-contenedores/04-docker-compose]] |
| Networking Docker | [[02-infra-contenedores/05-docker-networking]] |
