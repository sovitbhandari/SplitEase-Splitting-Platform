# SplitEase — backend (`server`)

Express + TypeScript API for SplitEase: auth, groups, expenses, balances/settlements, optional Plaid sandbox integration, and Socket.IO for live updates.

Full setup (database, `.env`, migrations, running with the React app) is documented in the [**root README**](../README.md).

---

## Requirements

- **Node.js 20+**
- **PostgreSQL** (connection via `DATABASE_URL` in `server/.env`)

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | `nodemon` + `ts-node` — API on `PORT` (default **4000**) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Jest |

Run from **`server/`**, or from the monorepo root: `npm run <script> -w server`.

---

## Configuration

1. Copy **`server/.env.example`** → **`server/.env`**.
2. Fill **`DATABASE_URL`**, **`JWT_SECRET`**, **`JWT_REFRESH_SECRET`**, **`ENCRYPTION_KEY`** (see `.env.example` for length rules).
3. Optional: **Plaid** keys for sandbox bank flows (`PLAID_*` in `.env`). Step-by-step for testers is in the [**root README** § Testing Plaid Sandbox](../README.md#testing-plaid-sandbox-optional).

**`CLIENT_ORIGIN`** should match your Vite dev URL (default `http://localhost:3000`) for cookie/CORS behavior.

---

## Migrations

Schema changes live under **`../db/migrations/`** and are applied from the **repo root** with:

```bash
npm run db:migrate
```

That reads `DATABASE_URL` from `server/.env`.
