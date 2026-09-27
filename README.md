# Nexpenses Backend

NestJS + Prisma + PostgreSQL API for the [Nexpenses](../../NextJS/nexpenses) personal COP budget app.

- **No auth** — identify the user with header `X-User-Id` (UUID)
- Global prefix: `/api/v1`
- Swagger: `/api-docs`
- Product docs: [`docs/PRD.md`](./docs/PRD.md)

## Database

**Neon** (hosted PostgreSQL) is the intended database. Prisma reads `DATABASE_URL` only — no Supabase client.

Keep `docker-compose.yaml` only as an optional local Postgres fallback for offline work.

## Prerequisites

- Node.js 20+
- pnpm
- A [Neon](https://neon.tech) Postgres database (recommended)

Optional: Docker, only if you prefer local Postgres instead of Neon.

## Setup

```bash
cd NestJS/nexpenses-backend
cp .env.template .env
# Set DATABASE_URL to your Neon connection string (sslmode=require).
# Use the pooled connection string from the Neon console for the API.

# Generate client + apply schema against Neon
pnpm prisma generate
pnpm prisma migrate deploy
# or during first local schema work: pnpm prisma migrate dev --name init

pnpm start:dev
```

### Optional: local Docker Postgres

If you are not using Neon yet:

```bash
# Uncomment the local DATABASE_URL and DB_* vars in .env
unset DOCKER_HOST
docker context use desktop-linux   # if using Docker Desktop
docker compose up -d               # container: nexpensesdb
pnpm prisma migrate dev
```

API: `http://localhost:4000/api/v1`  
Swagger: `http://localhost:4000/api-docs`

## First visit flow

1. `POST /api/v1/users` with `{ "name": "Dylan", "budget": 2000000 }` (no header). Optional: `email`, `emailAppToken`.
2. Store returned `id` on the client
3. Send `X-User-Id: <id>` on all other requests

`User.email` and `User.emailAppToken` are optional/nullable. Email is unique when set. Treat `emailAppToken` as sensitive (stored, never logged).

## Main endpoints

| Method           | Path                      | Header    | Notes                                   |
| ---------------- | ------------------------- | --------- | --------------------------------------- |
| POST             | /users                    | —         | Create user (10 req/min)                |
| GET              | /users                    | X-User-Id | List all users (**testing only**; no `emailAppToken`) |
| GET              | /users/me                 | X-User-Id | Current user                            |
| PATCH            | /users/me                 | X-User-Id | Update name/budget/email/emailAppToken  |
| GET/POST         | /categories               | X-User-Id | List / create                           |
| POST             | /categories/get-or-create | X-User-Id | Normalize + upsert                      |
| GET/PATCH        | /categories/:id           | X-User-Id | Get / rename or edit                    |
| GET/POST         | /expenses                 | X-User-Id | List (filters: year, month, …) / create |
| GET/PATCH/DELETE | /expenses/:id             | X-User-Id | CRUD                                    |
| DELETE           | /expenses                 | X-User-Id | **Optional/manual** wipe all (danger)   |
| GET              | /summary                  | X-User-Id | Cycle summary (`?year=&month=`)         |
| GET              | /history/yearly           | X-User-Id | Yearly monthly breakdown (`?year=`)     |
| GET              | /health                   | —         | Health check (not rate-limited)         |
| POST             | /email-inbound/sync       | X-User-Id | Sync manual de gastos desde correos reenviados |

Categories can be listed, created, fetched, updated, and accessed via get-or-create. After creation, edit/rename is the only category mutation; category deletion is not offered in v1.

## Standard response envelope

Every JSON response (success and error) uses:

```json
{
  "success": true,
  "data": {},
  "message": "OK"
}
```

| Case | Shape |
| ---- | ----- |
| Success (2xx) | `{ success: true, data, message }` — `data` may be `null` (e.g. some DELETEs) |
| Error (4xx/5xx) | `{ success: false, data: null, message, error: { statusCode, code, details? } }` |
| Paginated lists | `data: { items, total, limit, offset }` (not top-level `data` array) |

Default success messages by method: GET → `OK`, POST → `Creado correctamente`, PATCH/PUT → `Actualizado correctamente`, DELETE → `Eliminado correctamente`. Handlers may override with `@ResponseMessage('...')`.

Error `code` values include `VALIDATION_ERROR`, `NOT_FOUND`, `CONFLICT`, `UNAUTHORIZED`, `FORBIDDEN`, `RATE_LIMIT`, `BAD_REQUEST`, `INTERNAL_ERROR`. Validation failures include field-level `error.details`.

Opt out of wrapping with `@SkipEnvelope()` when needed.

## Rate limiting

Global `@nestjs/throttler` guard:

| Scope                | Limit                           |
| -------------------- | ------------------------------- |
| Default (all routes) | **60 requests / minute** per IP |
| `POST /users`        | **10 requests / minute**        |
| `GET /health`        | Skipped                         |

Exceeded → HTTP `429 Too Many Requests`.

## CORS

Configured in `src/main.ts`. `credentials: false` (no cookies). Methods: `GET,POST,PUT,PATCH,DELETE,OPTIONS`. Allowed headers: `Content-Type`, `Accept`, `Authorization`, `X-User-Id`.

`CORS_ORIGINS` is a comma-separated list (useful for LAN IPs during device testing).

| `STAGE`         | Behavior                                                                                                                                 |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `dev` (default) | Always allows web + Capacitor defaults (`http://localhost:3000`, `http://127.0.0.1:3000`, `capacitor://localhost`, `http://localhost`, `ionic://localhost`), merged with `CORS_ORIGINS` |
| `prod`          | **Requires** explicit `CORS_ORIGINS` — empty or `*` rejects boot                                                                         |

Listen port comes from `PORT` (default **4000**).

## History model

Expenses are **kept across months** by default (year-long history).  
`DELETE /expenses` remains available as an **optional manual wipe** only — not called automatically on month change.

- `GET /expenses?year=2026&month=9` — filter by calendar period (UTC)
- `GET /summary?year=2026&month=9` — spent / remaining / % / byCategory / byPaymentType
- `GET /history/yearly?year=2026` — 12-month breakdown vs monthly budget

**Budget semantics:** `user.budget` is the **monthly** amount.  
For year scope, summary also returns `budgetMonthly` and `projectedAnnualBudget` (`budget × 12`); remaining/% are vs annual.


## Postman

Collection and environment for importing into [Postman](https://www.postman.com/) (Collection Format v2.1):

| File | Path |
| ---- | ---- |
| Collection | [`postman/nexpenses-api.postman_collection.json`](./postman/nexpenses-api.postman_collection.json) |
| Environment | [`postman/nexpenses-api.postman_environment.json`](./postman/nexpenses-api.postman_environment.json) |

### Import

1. Open Postman → **Import** → select both JSON files (or drag the `postman/` folder).
2. Select environment **Nexpenses Local** (top-right).
3. Start the API (`pnpm start:dev`), then run **Health → Health Check**.
4. Run **Users → Create User** — a test script saves the returned `id` into the collection variable `userId` (used as `X-User-Id` on protected routes).
5. Create a category, then an expense; scripts also set `categoryId` / `expenseId` for path params.

Collection variables: `baseUrl` (`http://localhost:4000/api/v1`), `userId`, `categoryId`, `expenseId`.  
Auth is collection-level API key header `X-User-Id: {{userId}}`; **Create User** and **Health** use no auth. **List Users** (`GET /users`) is for Postman/manual testing only (requires `X-User-Id`; omits `emailAppToken`).


## Gastos por correo (IMAP inbound)

Inbox compartido: `nexpensesdev@gmail.com`. Cada usuario reenvía avisos bancarios a `nexpensesdev+{userId}@gmail.com` (o incluye `nexpenses:{userId}` / `[nexpenses:{userId}]` en el asunto).

- **Endpoint:** `POST /api/v1/email-inbound/sync` con header `X-User-Id` (solo procesa correos de ese usuario).
- **Respuesta `data`:** `{ created, skipped, deleted, errors }`.
- **Env:** `IMAP_HOST`, `IMAP_PORT`, `IMAP_USER`, `IMAP_APP_PASSWORD` (App Password de Gmail; no commitear), `EMAIL_INBOUND_DELETE_AFTER_MS` (default 3600000 = 1h).
- Tras crear un gasto se guarda el `Message-ID` (idempotencia). Los mails procesados se borran del buzón ~1h después (cleanup en cada sync). Sin monto → no crea ni borra.

## Scripts

| Script                 | Description            |
| ---------------------- | ---------------------- |
| `pnpm start:dev`       | Watch mode             |
| `pnpm build`           | Production build       |
| `pnpm prisma:generate` | Generate Prisma Client |
| `pnpm prisma:migrate`  | `prisma migrate dev`   |
| `pnpm prisma:push`     | `prisma db push`       |

## Env vars

See `.env.template`. Do not commit secrets.
