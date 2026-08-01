# Seeker AI — Roadmap

> Living document. ✅ = shipped & verified · 🔄 = in progress · ⬜ = planned.
> Live: **web** https://seeker-ai-web.vercel.app · **API** https://seeker-api-hg8h.onrender.com · **Android** `Seeker-v1.apk` (Capacitor) · **iPhone** via PWA (Add to Home Screen).
> Detailed session-by-session history: `TERMINALCHAT.md`. Architecture: `ARCHITECTURE.md` §9.

---

## ✅ Shipped

### The guarded AI advisor (Phases 0–5 of the intelligence rebuild)
- [x] **Phase 0 — LLM Analyst**: provider-agnostic LLM layer (Groq/Ollama/OpenAI/Anthropic/Gemini), grounded in engine + live market data, schema-validated with repair, deterministic rule-engine fallback (works with zero keys)
- [x] **Phase 1 — Numeric verifier**: every number in an advisory reconciled against source data (key ratios, prose ratios, allocation arithmetic); targeted repair → fallback; audit report in `meta.verification`
- [x] **Phase 2 — Knowledge base**: "distill, don't dump" pipeline (chunk → LLM-distill → embed → store); curated ingest manifest (Varsity tier 1, classics tier 2, TA tier 3; duplicates/forex disabled); resume-safe rate-limited ingest CLI
- [x] **Phase 3 — Playbook grounding**: retrieval (semantic via Ollama locally / keyword in cloud) → cited `[K#]` ADVISOR PLAYBOOK block in the prompt; citations in `meta.knowledge`
- [x] **Phase 4 — Compliance + framework verifier**: deterministic SEBI-language scan (guaranteed/risk-free/promised returns → rewrite → fallback); opt-in LLM framework-grounding check (advisory-only for now)
- [x] **Phase 5 scaffolds**: per-user memory store (read into prompt; manual writes), eval harness (`eval:advisor`), web-search interface (unwired by design)
- [x] First live E2E advisory passing all guards (numeric 100/100, compliance clean, 6 playbook citations)

### Product & app surfaces
- [x] Light/dark theme with system-follow + persistence
- [x] Skippable onboarding → neutral **MEDIUM-risk** default profile + "Personalize now" dashboard banner
- [x] Mobile responsiveness audit (tables wrapped, responsive grids)
- [x] PWA: manifest, branded icons, service worker (API never cached) — installable on iPhone & Android
- [x] **Native Android app**: Capacitor shell, web UI bundled in-binary, branded icons/splash (100 assets), `Seeker-v1.apk` built & distributed to the team

### Deployment (live since 2026-08-01)
- [x] DB: Supabase (ap-south-1, session pooler), schema + seed
- [x] API: Render blueprint (`render.yaml`), devDeps build fix, CORS normalizer + boot logging, dual-origin CORS (web + native)
- [x] Web: Vercel (`apps/web`, Vite preset, SPA rewrites)
- [x] Production knowledge: `cards-lite.json` (236 cards, embedding-free) served via `KNOWLEDGE_STORE_PATH`; keyword retrieval in cloud
- [x] Keep-warm + uptime alerts: UptimeRobot on `/health`
- [x] Corpus safety: 2 GB copyrighted book library hard-excluded from git; only distilled original-wording cards ship

---

## 🔵 Phase A — Launch (remainder)
- [x] A1 Supabase · A2 Render · A3 Vercel
- [🔄] **A4** Phone QA of the APK (user testing now — report anything cramped/broken)
- [🔄] **A5** Team distribution (APK + intro note sent)
- [ ] **A6** Feedback round → triage into fixes

## 🟢 Universe expansion: 43 → 503 stocks ✅ (shipped 2026-08-01)
- [x] **U1** NIFTY 500 universe generated from NSE's official constituent lists (`scripts/generate-universe.mjs` + committed CSV snapshots); industry → sector mapping with bank/pharma/defence name refinement; 43 curated + 460 extension, deduped
- [x] **U2** Procedural seeded sample fundamentals for demo mode (internally consistent: eps = price/pe; ranges by mcap class)
- [x] **U3** Rate-limit protection: snapshot bulk-fetch bounded to the curated set (`SNAPSHOT_UNIVERSE`); the 460 fetch per-symbol on demand
- [x] **U4** Engine picks + screener stay curated (`curated` flag); search/quotes/detail/watchlist cover all 503
- [x] **U5** Advisor symbol detection verified at 503 (IRCTC/ADANIGREEN/IDFCFIRSTB…); typecheck 0 errors; engine tests pass
- [ ] Minor tune: "adani" matches sibling Adani entities (capped at 4, correct one included)
- [ ] *(Later, paid provider)* True full-market (~2,000 NSE) coverage with bulk fundamentals

## 🟡 Phase B — Finish the brain (background, resumable)
- [🔄] **B1** Ingest the corpus: 236 cards done; ~2,900 chunks enabled total → chained runs (`--limit`, resume-safe) on Groq free, or ~$5 once on paid tier
- [ ] **B2** Cadence: after each milestone `knowledge:export` → commit → push (production playbook updates with zero redeploys)
- [ ] **B3** Enable deferred big books (Innerworth, Murphy TA)
- [ ] **B4** PDF→markdown ingestion step (worthwhile PDFs only; corpus stays local)
- [ ] **B5** Chunker: skip table-of-contents sections (kills thin cards)

## 🟠 Phase C — Advisor quality
- [ ] **C1** `[K#]` citations written in answer text + validate each maps to a retrieved card
- [ ] **C2** Framework-verifier enforcement (a "contradicts" verdict triggers repair/fallback, like the numeric guard)
- [ ] **C3** Eval golden set: grow cases, independent re-score, run before every deploy
- [ ] **C4** Memory auto-writer: post-session extractor persists durable user facts (completes the MAG loop)
- [ ] **C5** Web search wired with intent gating (current-events only; cite, don't assert)
- [ ] **C6** Card consolidation over time (merge/update cards as new sources arrive)

## 🔴 Phase D — Ready for strangers (before public promotion)
- [ ] **D1** Password reset + email verification
- [ ] **D2** Prisma migrations replace `db:push`
- [ ] **D3** → pulled forward as the 🟢 Universe track above
- [ ] **D4** Surface the guards in the UI: verification score, playbook citations, compliance badge (make trust visible)
- [ ] **D5** Housekeeping: watchlist latent type fix (TS-version drift) · PWA manifest polish (screenshots/categories/shortcuts) · signed release APK + Play Store ($25) · port permanence (hireflow owns :4000)

## 🟣 Phase E — Scale when users arrive
- [ ] **E1** pgvector on Supabase via the `KnowledgeStore` seam (semantic retrieval in production)
- [ ] **E2** Redis shared cache + background market refresher
- [ ] **E3** Paid Groq (~$5/mo at current scale — removes all rate-limit ceilings; also finishes the full ingest overnight)
- [ ] **E4** iOS native + TestFlight (needs Apple Developer $99/yr + ~35 GB disk for Xcode) · Electron DMG (Mac desktop) · Play Store listing

---

## Deferred decisions (visit when relevant)
- Groq paid tier — when free-tier fallbacks annoy or the ingest should finish overnight
- Apple Developer Program — when iPhone-native/TestFlight matters (PWA covers iPhone users today)
- Paid market-data provider — when full-market coverage or bulk fundamentals are needed
- Rotate the Groq API key (it appeared in a chat transcript once) — 2-minute task at console.groq.com
