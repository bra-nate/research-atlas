# Deploy

The product ships as two separately-hosted pieces (see CLAUDE.md):

- **Frontend** — the static Vite SPA in `apps/web`, hosted on Vercel.
- **API** — the Express service in `apps/api`, hosted on a Node host
  (Render / Railway / Fly). Supabase hosts Postgres.

The browser only ever calls the API; it never touches Postgres directly.

## Frontend → Vercel

`apps/web/vercel.json` is committed: it builds the shared types, runs the Vite
build, serves `dist/`, and rewrites all paths to `index.html` so client-side
routes (e.g. `/people/:id`) survive a hard refresh.

**One required env var** — the SPA calls `/api` relatively in dev (Vite proxies
to the local API). In production, point it at the deployed API:

```
VITE_API_BASE = https://<your-api-host>/api
```

Set that in the Vercel project (Settings → Environment Variables), then from
`apps/web`:

```bash
vercel            # first run links/creates the project
vercel --prod     # promote a production deploy
```

(Vercel auth is account-specific, so run these yourself — everything else is
committed.)

## API → Node host

The API needs `DATABASE_URL` (Supabase Postgres) and `WEB_ORIGIN` (the Vercel
domain, for CORS). Build/start:

```bash
pnpm --filter @research-atlas/types build
pnpm --filter @research-atlas/api build   # if a build step is configured
DATABASE_URL=... WEB_ORIGIN=https://<your-vercel-domain> pnpm --filter @research-atlas/api start
```

Apply migrations in `supabase/migrations/` (0001 → 0003) before first boot, then
run the ingest adapters (`pnpm ingest seed-consortia`, `dsi-africa`, `deltas`,
`enrich`) to populate the graph.

## Checklist

- [ ] API deployed, migrations applied, ingests run, `/health` green.
- [ ] `WEB_ORIGIN` on the API matches the Vercel domain.
- [ ] `VITE_API_BASE` on Vercel points at the API's public `/api`.
- [ ] Hard-refresh a deep link (a person profile) — no 404.
- [ ] Hero person view (with publications) reads cleanly at phone width.
