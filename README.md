# sparxstar-3iatlas-rlc-ui

React 19 + TypeScript + Vite + i18next PWA frontend for the SPARXSTAR 3iAtlas
RLC (Rapid Language Collection) Platform.

> **Status: mid-migration to v4.0.** The codebase is being rewired across a
> sequence of PRs (see phase status below). The "target" architecture below
> describes where it lands; the "current" notes call out what is actually wired
> today so developers aren't misled.

**Target architecture (v4.0):** UI calls the `sparxstar-3iatlas-rlc-node-engine`
Node backend over REST (`/api/v1/`) and socket.io. The WordPress plugin
`sparxstar-3iatlas-rlc` is an **orchestrator only** (myCred hooks, DVE
promotion, page mount) — the UI never calls WordPress directly.

**Current (as of this commit):** `src/api/client.ts` still calls the WordPress
plugin at `/aiwa/v1/` via `window.RLC_API_BASE`. The backend retarget lands in
the **Backend Retarget** migration step (see below).

## Stack

- React 19 + TypeScript
- Vite 6
- i18next + react-i18next — every student-facing string will be a localization key (key extraction is the **Localization Extraction** migration step)
- IndexedDB offline queue
- PWA — installs on mobile, works offline
- socket.io-client — *planned for the **Socket Introduction** migration step; not yet installed*

## Canonical spec

`.github/instructions/SPARXSTAR-3iAtlas-RLC-Spec-v4.0.md` is the
single source of truth across all three repos. Repo-specific contract lives in
`AGENTS.md`.

## The three repos

| Repo | Role |
| :---- | :---- |
| **`sparxstar-3iatlas-rlc-ui`** (this repo) | React frontend, localized, talks to backend only |
| `sparxstar-3iatlas-rlc-node-engine` | Node + Express + PostgreSQL + socket.io — system of record |
| `sparxstar-3iatlas-rlc` | WordPress PHP orchestrator — myCred + DVE + page mount only |

## Development

```bash
cp .env.example .env.local
# Set VITE_WP_URL to your WordPress dev site (current dev setup).
# The Backend Retarget step retargets this to a Node backend URL.

npm install
npm run dev
```

**Current dev proxy:** Vite proxies `/aiwa/v1/*` to the WordPress plugin
(see `vite.config.ts`). The Backend Retarget step switches this to `/api/v1/*`
against the Node backend.

**Production:** the orchestrator host page injects `window.RLC_API_BASE`,
`window.RLC_TEACHER_TOKEN`, and `window.RLC_SCHOOL_ID` at runtime.

## Scripts

```bash
npm run dev        # Vite dev server
npm run build      # tsc -b && vite build
npm run typecheck  # tsc -b
npm run lint       # eslint .
npm run test       # vitest run
npm run smoke      # contract smoke test (set RLC_SMOKE_BASE)
```

All four (`typecheck`, `lint`, `test`, `build`) must pass before a PR opens.

## Architecture

```
sparxstar-3iatlas-rlc-ui   ← this repo (React UI)
       │
       │  REST /api/v1/ + WebSocket (socket.io)
       │
sparxstar-3iatlas-rlc-node-engine  ← Node backend (system of record)
       │
       │  HMAC-signed webhooks
       │
sparxstar-3iatlas-rlc      ← WordPress orchestrator (myCred + DVE)
```

## v4.0 migration steps (UI track)

Each step is a single PR. Numbers below are sequence within the migration,
not GitHub PR numbers (those depend on what else lands in the repo).

- [x] **Step 1 — Spec adoption.** Commit v4.0 spec; rewrite AGENTS.md and copilot-instructions
- [ ] **Step 2 — Branch hygiene (this PR).** Drop unused deps, i18n stub, README refresh
- [ ] **Step 3 — Backend Retarget.** `/aiwa/v1` → `/api/v1`; add `RLC_SCHOOL_ID` host global; dev proxy reset
- [ ] **Step 4 — Socket Introduction.** Add socket.io-client; replace `useSessionPoll`
- [ ] **Step 5 — Tier-aware Sign-in.** S1 LB/UB/SS/Adult flows + failure UX
- [ ] **Step 6 — Localization Extraction.** All student-facing strings → i18n keys
- [ ] **Step 7 — QC Rewrite.** Audio → orthography → semantics sequence; anonymized submitter
- [ ] **Step 8 — Polish.** AccessoryBar IME, ceremony lifetime XP, screen-time UI, E2E

Step 3 onward needs the Node backend at least minimally up.

## Confidential · Patent Pending · Starisian Technologies
