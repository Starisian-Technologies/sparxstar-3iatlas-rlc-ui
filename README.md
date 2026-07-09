# sparxstar-3iatlas-rlc-ui

React 19 + TypeScript + Vite + i18next PWA frontend for the SPARXSTAR 3iAtlas
RLC (Rapid Language Collection) Platform.

> **Status: mid-migration to v4.0.** The codebase is being rewired across a
> sequence of PRs (see phase status below). For the authoritative, verified
> breakdown of what is actually shipped vs. still planned, see **§11 of the
> canonical spec** (`.github/instructions/SPARXSTAR-3iAtlas-RLC-Spec-v4.0.md`).
> The summary below is a pointer, not a duplicate — if the two ever disagree,
> the spec wins.

**Target architecture (v4.0):** UI calls the `sparxstar-3iatlas-rlc-node-engine`
Node backend over REST (`/api/v1/`) and socket.io. The WordPress plugin
`sparxstar-3iatlas-rlc` is an **orchestrator only** (myCred hooks, DVE
promotion, page mount) — the UI never calls WordPress directly.

**Current (as of this commit):** `src/api/client.ts` calls the Node backend at
`/api/v1/` via `window.RLC_API_BASE`. Real-time state is socket.io-driven —
`src/runtime/socket.ts` + `src/hooks/useSessionSocket.ts` connect on mount,
with a 5s REST poll used only as a startup/fallback safety net until the
socket confirms connection. `useSessionPoll` is now a thin compatibility
re-export of `useSessionSocket`, not independent polling logic. Full detail:
spec §11.2.

## Stack

- React 19 + TypeScript
- Vite 6
- i18next + react-i18next — infrastructure is wired, but only an English
  string bundle exists today; per-screen key extraction and the Mandinka /
  Wolof / Fula / French bundles are still the **Localization Extraction**
  migration step (spec §11.5)
- IndexedDB offline queue
- PWA — installs on mobile, works offline
- socket.io-client — installed and wired (see above); real-time is no longer
  polling-based

## Canonical spec

`.github/instructions/SPARXSTAR-3iAtlas-RLC-Spec-v4.0.md` is the
single source of truth across all three repos for architecture, data model,
and API/socket design — including §11, the verified current-implementation
status for this repo. The exact wire payload shapes (REST bodies, socket
event payloads) are defined byte-for-byte in
`.github/instructions/SPARXSTAR-3iAtlas-RLC-Contract-v1.0.md`, which is kept
byte-identical with its twin in the node-engine repo — treat it as the
source of truth for field names/types, not the spec's prose summaries.
Repo-specific coding rules live in `AGENTS.md`.

## The three repos

| Repo | Role |
| :---- | :---- |
| **`sparxstar-3iatlas-rlc-ui`** (this repo) | React frontend, localized, talks to backend only |
| `sparxstar-3iatlas-rlc-node-engine` | Node + Express + PostgreSQL + socket.io — system of record |
| `sparxstar-3iatlas-rlc` | WordPress PHP orchestrator — myCred + DVE + page mount only |

## Development

```bash
cp .env.example .env.local
# Set VITE_RLC_BACKEND_URL to your local Node backend (default http://localhost:3001).

npm install
npm run dev
```

**Dev proxy:** Vite proxies `/api/*` to `VITE_RLC_BACKEND_URL` (see `vite.config.ts`).

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

See `.github/instructions/SPARXSTAR-3iAtlas-RLC-Spec-v4.0.md` §3.1 for the
full data-flow diagram across all three repos. Short version: this repo talks
to `sparxstar-3iatlas-rlc-node-engine` over REST + socket.io only; the
`sparxstar-3iatlas-rlc` WordPress plugin is an orchestrator the UI never
calls directly.

## v4.0 migration steps (UI track)

Each step is a single PR. Numbers below are sequence within the migration,
not GitHub PR numbers (those depend on what else lands in the repo). Status
below is a summary — see spec **§11.5** for the verified, code-checked detail
behind each checkbox.

- [x] **Step 1 — Spec adoption.** Commit v4.0 spec; rewrite AGENTS.md and copilot-instructions
- [x] **Step 2 — Branch hygiene.** Drop unused deps, i18n stub, README refresh
- [x] **Step 3 — Backend Retarget.** `/aiwa/v1` → `/api/v1`; add `RLC_SCHOOL_ID` host global; dev proxy reset
- [x] **Step 4 — Socket Introduction.** `socket.io-client` installed and wired; `useSessionPoll` is now a compatibility shim over `useSessionSocket`
- [x] **Step 5 — Tier-aware Sign-in.** S1 LB/UB/SS/Adult flows implemented in `JoinScreen.tsx`; `parseJoinError()` gives specific failure UX for 401 (invalid credential), 410 (session unavailable), and 423 (account locked) — 403 (unknown screen name) and 429 (rate limit) are not distinguished and currently fall back to generic error messaging
- [ ] **Step 6 — Localization Extraction.** i18next wired, but only an English bundle exists and only one screen (`CeremonyScreen`) consumes it — most student-facing strings are still hardcoded English
- [ ] **Step 7 — QC Rewrite.** Submitter anonymization is done; the full Audio → Orthography → Semantics → Correction → Translation sequence is not — `QcScreen` currently runs a single combined vote step per token
- [ ] **Step 8 — Polish.** PWA, offline queue, and AccessoryBar IME bypass are done; screen-time limit UI, ceremony lifetime XP / school standing, and cross-mode E2E tests are not

Step 4 requires the Node backend running socket.io; step 4 is verified wired
on the UI side of this repo (see spec §11.2) but end-to-end behavior still
depends on the backend actually running socket.io in your environment.

## Confidential · Patent Pending · Starisian Technologies
