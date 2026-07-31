# Seeker AI — Go-Live Guide (few-users launch)

The bootstrap deployment: **web on Vercel · API on Render · Postgres on Neon · phones via PWA · Android APK via PWABuilder**. Everything on free tiers. Files that drive it: `render.yaml` (API blueprint), `apps/web/vercel.json` (SPA config), `apps/web/public/manifest.webmanifest` + `sw.js` (PWA).

> You create the accounts and paste the secrets — keys never go through anyone else. Each step below says exactly which values to paste where.

---

## Step 0 — one-time prep (local)

```bash
# Export the deploy copy of the knowledge base (no embeddings — small, committable)
npm run knowledge:export -w @seeker/api
# → writes apps/api/knowledge/cards-lite.json  (tracked in git; production reads THIS)
```

Re-run this + commit whenever you've ingested more cards and want production updated.

## Step 1 — Database: Supabase or Neon (free Postgres — either works)

**Supabase** (chosen for this project — its Postgres is standard, and pgvector is one `CREATE EXTENSION` away for the future knowledge-store upgrade):
1. Create a project at supabase.com → *Connect* dialog → copy the **Session pooler** connection string (`…pooler.supabase.com:5432/postgres`). ⚠️ Use the *pooler* string, not "Direct" — direct is IPv6-only on the free tier and unreachable from Render.
2. Free-tier note: projects pause after ~1 week of inactivity — one-click restore in the dashboard.

*(Neon alternative: neon.tech → copy the connection string — steps below are identical.)*

Push the schema and seed from your machine:
   ```bash
   cd apps/api
   DATABASE_URL="<pooler-connection-string>" npx prisma db push
   DATABASE_URL="<pooler-connection-string>" npm run db:seed   # optional demo user
   ```

## Step 2 — API: Render (free web service)

1. Push the repo to GitHub (private is fine).
2. render.com → **New → Blueprint** → pick the repo — it reads `render.yaml` automatically.
3. In the dashboard fill the `sync: false` vars: **DATABASE_URL** (Neon), **CORS_ORIGIN** (your Vercel URL — add after Step 3), **GROQ_API_KEY**. JWT secrets are auto-generated.
4. Deploy → verify `https://<your-api>.onrender.com/health` returns `{"ok":true…}`.

## Step 3 — Web: Vercel

1. vercel.com → **Add New Project** → same repo → set **Root Directory = `apps/web`** (build/output auto-detected: `npm run build` → `dist`; note: Vercel runs the workspace install from the repo root, so `@seeker/shared` builds via `postinstall`).
2. Environment variables: `VITE_API_URL = https://<your-api>.onrender.com/api` (+ `VITE_GOOGLE_CLIENT_ID` if using Google sign-in).
3. Deploy → note the URL → go back to Render and set `CORS_ORIGIN` to it.

## Step 4 — Phones (both platforms, instantly): the PWA

The site is already an installable app once deployed:
- **iPhone:** open the Vercel URL in **Safari** → Share → **Add to Home Screen**. Runs full-screen with the Seeker icon.
- **Android:** open in **Chrome** → the **Install app** prompt (or ⋮ → Add to Home screen).

This is the recommended "app" for your first users — zero stores, zero accounts, updates ship instantly with each deploy.

## Step 5 — Android APK (a real installable file)

Use **PWABuilder** (free, no Android SDK needed): pwabuilder.com → paste your Vercel URL → **Package for Android** → download the APK/AAB. Share the APK directly with your users (they enable "install from unknown sources"). For the Play Store later, the same AAB + a one-time $25 Play Console account.

*Alternative (native shell, more control):* Capacitor — `npx cap add android` + Android Studio build. Do this only when you outgrow PWABuilder.

## Step 6 — Apple users

- **iPhone (recommended now):** the PWA from Step 4 — free, no Apple account.
- **iPhone via TestFlight/App Store:** requires an Apple Developer account (**$99/yr**) + an Xcode/Capacitor build. Do when you have real traction.
- **Mac desktop (.dmg):** an Electron/Tauri wrap of the web app. Possible anytime; unsigned builds show a Gatekeeper warning (signing needs the same $99 account). Lowest priority.

---

## Go-live checklist

- [ ] `knowledge:export` run + `cards-lite.json` committed
- [ ] Neon: schema pushed (+ seed if wanted)
- [ ] Render: `/health` green, env vars set (incl. `KNOWLEDGE_STORE_PATH`)
- [ ] Vercel: site loads, login works, advisor answers (check `meta.provider: groq`)
- [ ] `CORS_ORIGIN` = exact Vercel URL (no trailing slash)
- [ ] PWA installs on one iPhone + one Android
- [ ] APK generated via PWABuilder + tested on one device

## Honest caveats at this scale

- **Render free tier sleeps** — first request after idle takes ~30–60s (cold start). Fine for a few users; the paid tier ($7/mo) removes it.
- **No password reset / email verification yet** — okay for a few known users, build before strangers sign up (`FUTURE_CHANGES.md` §4).
- **Production retrieval is keyword-based** (no Ollama in the cloud) — playbook grounding still works, slightly less clever matching. A hosted embedder can upgrade this later.
- **Groq free tier** — 12K tokens/min shared across all users' advisories; heavy simultaneous use falls back to the rule engine (by design). Paid Groq removes the ceiling for pennies.
- **43-stock universe** — expansion to ~100–150 names is a constants-file task on the backlog.
- **File-backed knowledge/memory stores are per-instance** — fine on one Render instance; move to Postgres (pgvector) before scaling out.
