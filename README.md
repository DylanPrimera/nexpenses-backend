# Nexpenses Backend

Nexpenses is a NestJS API for managing personal expenses and credits, backed by PostgreSQL and Prisma.

## Run locally

Use Docker for the local PostgreSQL database; run the NestJS app locally with pnpm.

Prerequisites:

- Docker
- Node.js 20+
- pnpm

Start PostgreSQL:

```bash
docker compose up -d
```

Then set up and start the API:

```bash
cp .env.template .env
pnpm install
pnpm prisma generate
pnpm prisma migrate dev
pnpm start:dev
```

The API runs on `http://localhost:4000` by default. When the server is running, open the Swagger API documentation at:

- `http://localhost:4000/api-docs`
