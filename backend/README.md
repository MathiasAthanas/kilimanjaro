# Kilimanjaro Backend

## Architecture

Backend is a Turbo monorepo with NestJS microservices and shared internal packages.
All client traffic is routed through `api-gateway`.

## Services and Ports

| Service | Port | DB Schema |
|---|---:|---|
| api-gateway | 3000 | n/a |
| auth-service | 3001 | auth |
| student-service | 3002 | students |
| academic-service | 3003 | academics |
| finance-service | 3004 | finance |
| notification-service | 3005 | notifications |
| analytics-service | 3006 | analytics |

## Backend Structure

```text
backend/
  services/
    api-gateway/
    auth-service/
    student-service/
    academic-service/
    finance-service/
    notification-service/
    analytics-service/
  shared/
    contracts/
    types/
    utils/
```

## Prerequisites

- Node.js 18+
- npm 9+
- PostgreSQL 15+
- RabbitMQ 3.12+
- Redis 7+
- PM2 (`npm i -g pm2`)

## Setup

### 1. Install dependencies

```bash
cd backend
npm install
```

### 2. Create database and schemas

```sql
CREATE DATABASE kilimanjaro;
CREATE SCHEMA auth;
CREATE SCHEMA students;
CREATE SCHEMA academics;
CREATE SCHEMA finance;
CREATE SCHEMA notifications;
CREATE SCHEMA analytics;
```

### 3. Configure environment variables

Create `.env` for each service and ensure shared secrets match across services, especially `JWT_ACCESS_SECRET`.

### 4. Run Prisma migrations

```bash
cd services/auth-service && npx prisma migrate dev --name init
cd ../student-service && npx prisma migrate dev --name init
cd ../academic-service && npx prisma migrate dev --name init
cd ../finance-service && npx prisma migrate dev --name init
cd ../notification-service && npx prisma migrate dev --name init
cd ../analytics-service && npx prisma migrate dev --name init
```

## Running

### Development (all services)

```bash
cd backend
npm run dev
```

### Development (single service)

```bash
cd backend
npm run dev:gateway
npm run dev:auth
```

### Build and PM2 run

```bash
cd backend
npm run build
pm2 start ecosystem.config.js
```

## Notes

- `api-gateway` maps routes in `services/api-gateway/src/proxy/proxy.service.ts`.
- Most services are scaffolded with Prisma and `AppModule`; `auth-service` is currently the most feature-complete.
- Invalid scaffold artifacts produced by brace-style folder commands are preserved under `backend/_invalid_scaffold/`.