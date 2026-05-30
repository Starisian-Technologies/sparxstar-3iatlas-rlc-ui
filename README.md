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
PR #3.

## Stack

- React 19 + TypeScript
- Vite 6
- i18next + react-i18next — every student-facing string will be a localization key (extraction in PR #6)
- IndexedDB offline queue
- PWA — installs on mobile, works offline
- socket.io-client — *planned for PR #4*; not yet installed

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
# PR #3 retargets this to a Node backend URL.

npm install
npm run dev
```

**Current dev proxy:** Vite proxies `/aiwa/v1/*` to the WordPress plugin
(see `vite.config.ts`). PR #3 switches this to `/api/v1/*` against the Node
backend.

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

## v4.0 build phase status

- [x] Phase 1 of UI track — spec adoption, AGENTS.md / copilot-instructions
- [ ] PR #2 — Branch hygiene (this PR): drop unused deps, i18n stub, README refresh
- [ ] PR #3 — Backend retarget: `/aiwa/v1` → `/api/v1`, add `RLC_SCHOOL_ID` host global, dev proxy reset
- [ ] PR #4 — socket.io introduction
- [ ] PR #5 — Tier-aware S1 + failure UX
- [ ] PR #6 — Localization extraction (all strings → i18n keys)
- [ ] PR #7 — QC rewrite (audio → orthography → semantics, anonymized submitter)
- [ ] PR #8 — Polish (AccessoryBar IME, ceremony lifetime XP, screen-time, E2E)

PR #3 onward needs the Node backend at least minimally up.

## Confidential · Patent Pending · Starisian Technologies
