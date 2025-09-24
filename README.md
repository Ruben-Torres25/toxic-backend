
# Toxic Backend (NestJS + Postgres)

Ahora configurado para **PostgreSQL** por defecto.

## Variables de entorno
Crea un `.env` (ya incluido) con:
```
PORT=3000
PG_HOST=localhost
PG_PORT=5432
PG_USER=postgres
PG_PASSWORD=postgres
PG_DATABASE=toxicdb
# PG_SSL=true  # si usas Neon/Render/etc
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

## Levantar Postgres con Docker (recomendado)
```
docker compose up -d
```

## Instalar y correr
```
npm i
npm run seed
npm run start:dev
```

## Endpoints
- Productos: `/products` (CRUD + `PATCH /:id/stock`)
- Clientes: `/customers` (CRUD + `/balance`, `/adjust`)
- Pedidos: `/orders` (CRUD + `/confirm`, `/cancel`)
- Caja: `/cash` (`current`, `open`, `close`, `movement`, `report`, `movements`)

> `synchronize: true` estÃ¡ activo solo para desarrollo. En producciÃ³n usar **migraciones**.
