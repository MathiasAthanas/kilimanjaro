# Kilimanjaro Backend

## Architecture

Backend is a Turbo monorepo with NestJS microservices and shared internal packages. All client traffic should enter through `api-gateway`; downstream services should stay private on the VPS/internal network.

## Services And Ports

| Service | Port | DB Schema |
|---|---:|---|
| api-gateway | 3000 | n/a |
| auth-service | 3001 | auth |
| student-service | 3002 | students |
| academic-service | 3003 | academics |
| finance-service | 3004 | finance |
| notification-service | 3005 | notifications |
| analytics-service | 3006 | analytics |

## Production Baseline

- `npm run build` must pass from `backend`.
- Prisma services generate isolated clients into `services/<service>/generated/prisma` during `prebuild`.
- Production migrations use `prisma migrate deploy`; do not use `db push` or `migrate dev` on the VPS.
- Gateway defaults, service defaults, PM2 configs, and `.env.example` files use the same `3000-3006` port map.
- Swagger is disabled when `NODE_ENV=production`.

## Prerequisites

- Node.js 22 LTS or 20 LTS
- npm matching the root `packageManager`
- PostgreSQL 15+
- Redis 7+
- RabbitMQ 3.12+
- PM2

## Setup

```bash
cd backend
npm install
npm run build
```

For local development, use the shared local environment and infrastructure stack. This creates ignored local-only credentials, starts PostgreSQL, Redis, and RabbitMQ, then applies every service migration:

```bash
npm run local:env
npm run local:infra
npm run local:migrate
npm run local:start
```

Use `pm2 logs ks-api-gateway --lines 100` and `curl http://127.0.0.1:3000/health` to confirm the gateway is actually listening before starting the dashboard. PM2's `online` state alone only means it has started a process; it does not mean Nest completed startup.

For production, create secrets-managed `.env` files or inject the same values through the process manager. Ensure `INTERNAL_API_KEY` matches across gateway and downstream services, and configure matching RSA JWT keys for auth/gateway.

## Migrations

Run migrations from each service before starting PM2:

```bash
cd backend/services/auth-service && npm run prisma:migrate
cd ../student-service && npm run prisma:migrate
cd ../academic-service && npm run prisma:migrate
cd ../finance-service && npm run prisma:migrate
cd ../notification-service && npm run prisma:migrate
cd ../analytics-service && npm run prisma:migrate
```

## Running

```bash
cd backend
npm run dev
```

Single service examples:

```bash
npm run dev:gateway
npm run dev:auth
```

Production with PM2:

```bash
cd backend
npm run build
pm2 start ecosystem.config.js
pm2 save
```

## Remaining Risks

- `npm run test` currently verifies test-script wiring only; meaningful Jest coverage is still required before live production data.
- Dependency audit still reports vulnerabilities; review with `npm audit` before deployment.
- Integration contracts with the mobile app still need to be frozen endpoint-by-endpoint.
