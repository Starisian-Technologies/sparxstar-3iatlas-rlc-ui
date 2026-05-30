# sparxstar-3iatlas-rlc-ui

React 19 + TypeScript + Vite + i18next PWA frontend for the AIWA Rapid Word &
Sentence Collection Platform.

Calls the `sparxstar-3iatlas-rlc-node-engine` Node backend over REST
(`/api/v1/`) and socket.io. The WordPress plugin `sparxstar-3iatlas-rlc` is an
**orchestrator only** (myCred hooks, DVE promotion, page mount) — the UI never
calls WordPress directly.

## Stack

- React 19 + TypeScript
- Vite 6
- i18next + react-i18next — every student-facing string is a localization key
- socket.io-client — real-time game state (REST is catch-up only)
- IndexedDB offline queue
- PWA — installs on mobile, works offline

## Canonical spec

`.github/instructions/AIWA-RWC-RSC-Technical-Specification-v4.0.md` is the
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
# Set VITE_AIWA_BACKEND_URL to your Node backend (e.g. http://localhost:3001)
# Optionally set RLC_TEACHER_TOKEN / RLC_API_BASE locally via the browser
# console for tier-aware sign-in.

npm install
npm run dev
```

The Vite dev server proxies `/api/v1/*` to the Node backend. The orchestrator
host page injects `window.AIWA_API_BASE`, `window.AIWA_TEACHER_TOKEN`, and
`window.AIWA_SCHOOL_ID` at runtime in production.

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
- [ ] PR #3 — Backend retarget: `/aiwa/v1` → `/api/v1`, `RLC_*` → `AIWA_*`, dev proxy
- [ ] PR #4 — socket.io introduction
- [ ] PR #5 — Tier-aware S1 + failure UX
- [ ] PR #6 — Localization extraction (all strings → i18n keys)
- [ ] PR #7 — QC rewrite (audio → orthography → semantics, anonymized submitter)
- [ ] PR #8 — Polish (AccessoryBar IME, ceremony lifetime XP, screen-time, E2E)

PR #3 onward needs the Node backend at least minimally up.

## Confidential · Patent Pending · Starisian Technologies
