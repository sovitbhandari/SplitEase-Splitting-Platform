# SplitEase — frontend (`client`)

React + TypeScript + Vite + Tailwind. This package is the browser UI for SplitEase (group expenses, balances, trips, etc.).

For **installing Postgres, env vars, migrations, and running the full stack**, start at the [**root README**](../README.md). You almost always want `npm run dev` from the repo root so the API and proxy line up.

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Vite dev server (default **port 3000**), proxies `/api` → `http://localhost:4000` |
| `npm run build` | Typecheck + production bundle to `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | ESLint |

Run from **`client/`** with `npm run <script>`, or from the root with `npm run <script> -w client`.

---

## Dev notes

- **API base URL:** In development, use relative paths like `/api/...` so Vite’s proxy reaches the Express server (see `vite.config.ts`).
- **Port:** `3000` is set in Vite config; change there if you need another port and keep `CLIENT_ORIGIN` on the server in sync if you hit CORS outside the proxy.

---

## Demo image for the main README

The screenshot for the project landing lives at the **repository root** as `demo.png`, next to the main `README.md`—not inside `client/`. Add or replace that file when you want to refresh the GitHub preview.
