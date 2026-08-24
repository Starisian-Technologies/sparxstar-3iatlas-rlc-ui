# sparxstar-3iatlas-rlc-ui

React 19 + TypeScript + Vite + i18next PWA frontend for the SPARXSTAR 3iAtlas
RLC (Rapid Language Collection) Platform.

> **Status: mid-migration to v4.0.** The codebase is being rewired across a
> sequence of PRs (see phase status below). For the authoritative, verified
> breakdown of what is actually shipped vs. still planned, see **Appendix A of the
> canonical spec** (`.github/instructions/SPARXSTAR-3iAtlas-RLC-Spec-v4.0.md`).
> The summary below is a pointer, not a duplicate — if the two ever disagree,
> the spec wins.

**Architecture:** this UI calls the `sparxstar-3iatlas-rlc-node-engine` Node
backend over REST (`/api/v1/`) and socket.io, and nothing else.

**RLC is entirely Node.js.** There is **no WordPress orchestrator and none is to
be created** — no WordPress runtime dependency, no page mount, no
WordPress-injected teacher token, no WordPress-owned session workflow. Canonical
spec §8 is marked superseded and kept only as a record.

**Classroom progression is teacher-driven and the server is authoritative** for
the current phase, the current QC token, QC advancement, ceremony progression,
star announcements, and ceremony completion. This client renders local
transitions only in response to authoritative server events, and hydrates from
the server on mount and reconnect. It keeps no cursor of its own.

**Real-time (current):** `src/runtime/socket.ts` + `src/hooks/useSessionSocket.ts`
connect on mount, with a REST poll as a startup/fallback safety net until the
socket confirms. All **13** events the engine emits are handled and classified in
`src/runtime/serverEvents.ts`; a test fails if the contract grows one the
inventory does not cover. Unknown events are tolerated and a throwing handler is
contained, so a newer server cannot take a screen down.

**QC and ceremony are server-driven.** `useQcSession` follows `qc:token` by
ascending sequence and hydrates from `GET /session/:id/qc-state`; the teacher's
advance is a server call whose result arrives as a broadcast. `useCeremony`
renders the server's star order from `seq` and ends on `ceremony:end`, never on a
local timer. See the engine's `docs/SOCKET-EVENTS.md` and NODE-ADR-008.

**Voting keeps three separate axes** — pronunciation (when a recording exists),
spelling, meaning — each its own vote on its own dimension, then conditional
correction and translation. Only spelling branches to correction, and only on a
strict majority No.

## Stack

- React 19 + TypeScript
- Vite 6
- i18next + react-i18next — infrastructure is wired, but only an English
  string bundle exists today; per-screen key extraction and the Mandinka /
  Wolof / Fula / French bundles are still the **Localization Extraction**
  migration step (spec Appendix A.5)
- IndexedDB offline queue
- PWA — installs on mobile, works offline
- socket.io-client — installed and wired (see above); real-time is no longer
  polling-based

## Canonical spec

`.github/instructions/SPARXSTAR-3iAtlas-RLC-Spec-v4.0.md` is the
single source of truth across the RLC repos for architecture, data model,
and API/socket design — including Appendix A, the verified current-implementation
status for this repo. The exact wire payload shapes (REST bodies, socket
event payloads) are defined byte-for-byte in
`.github/instructions/SPARXSTAR-3iAtlas-RLC-Contract-v1.0.md`, which is kept
byte-identical with its twin in the node-engine repo — treat it as the
source of truth for field names/types, not the spec's prose summaries.
Repo-specific coding rules live in `AGENTS.md`.

## The repos

| Repo | Role |
| :---- | :---- |
| **`sparxstar-3iatlas-rlc-ui`** (this repo) | React frontend, localized, talks to backend only |
| `sparxstar-3iatlas-rlc-node-engine` | Node + Express + PostgreSQL + socket.io — the shared gameplay engine for all games, and the system of record |
| `sparxstar-3iatlas-identity-node` | The sole authentication authority. Issues the tokens the engine verifies; never issues a permission |
| `sparxstar-3iatlas-dictionary-games` | Another client of the same engine |

## Development

```bash
cp .env.example .env.local
# Set VITE_RLC_BACKEND_URL to your local Node backend (default http://localhost:3001).

npm install
npm run dev
```

**Dev proxy:** Vite proxies `/api/*` to `VITE_RLC_BACKEND_URL` (see `vite.config.ts`).

**Production:** the host page injects `window.RLC_API_BASE`,
`window.RLC_TEACHER_TOKEN`, and `window.RLC_SCHOOL_ID` at runtime. See
"Runtime configuration" under Architecture below — that page is not a WordPress
plugin, and the token it supplies proves identity, not authority.

## Scripts

```bash
npm run dev        # Vite dev server
npm run build      # tsc -b && vite build
npm run typecheck  # tsc -b
npm run lint       # eslint .
npm run test       # vitest run
npm run smoke      # contract smoke test — asserts this client's side of the
                   # wire contract. Does not need a running backend; the engine
                   # repo owns the end-to-end conformance run.
```

All of `typecheck`, `lint`, `test`, `smoke`, and `build` must pass before a PR
opens — and now they are **enforced**: `.github/workflows/test.yml` runs them on
every push and pull request. Previously the requirement was documented and
nothing checked it.

## Architecture

See `.github/instructions/SPARXSTAR-3iAtlas-RLC-Spec-v4.0.md` §3.1 for the
full data-flow diagram. Short version: this repo talks to
`sparxstar-3iatlas-rlc-node-engine` over REST + socket.io **and nothing else**.
That engine is the shared gameplay engine for all games — `dictionary-games` is
another client of it — and `sparxstar-3iatlas-identity-node` is the sole
authentication authority behind both.

**Runtime configuration.** The host page supplies `window.RLC_API_BASE`,
`window.RLC_TEACHER_TOKEN`, and `window.RLC_SCHOOL_ID`. The teacher token is an
Identity-issued token held in page memory only, never persisted — and it proves
identity, not authority: what its holder may do is decided server-side against
the engine's authorization records. A reusable teacher token must never be placed
in page configuration or source.

## v4.0 migration steps (UI track)

Each step is a single PR. Numbers below are sequence within the migration,
not GitHub PR numbers (those depend on what else lands in the repo). Status
below is a summary — see spec **Appendix A.5** for the verified, code-checked detail
behind each checkbox.

- [x] **Step 1 — Spec adoption.** Commit v4.0 spec; rewrite AGENTS.md and copilot-instructions
- [x] **Step 2 — Branch hygiene.** Drop unused deps, i18n stub, README refresh
- [x] **Step 3 — Backend Retarget.** `/aiwa/v1` → `/api/v1`; add `RLC_SCHOOL_ID` host global; dev proxy reset
- [x] **Step 4 — Socket Introduction.** `socket.io-client` installed and wired; `useSessionPoll` is now a compatibility shim over `useSessionSocket`
- [x] **Step 5 — Tier-aware Sign-in.** S1 LB/UB/SS/Adult flows implemented in `JoinScreen.tsx`; `parseJoinError()` gives specific failure UX for 401 (invalid credential), 410 (session unavailable), and 423 (account locked) — 403 (unknown screen name) and 429 (rate limit) are not distinguished and currently fall back to generic error messaging
- [ ] **Step 6 — Localization Extraction.** i18next wired, but only an English bundle exists and only one screen (`CeremonyScreen`) consumes it — most student-facing strings are still hardcoded English
- [~] **Step 7 — QC Rewrite.** Submitter anonymization is done, and the three vote axes are now collected separately: pronunciation (when a recording exists) → spelling → meaning → conditional correction → translation. Outstanding: the audio panel is a placeholder because `RlcRecorder` does not record, and one-vote-per-dimension is enforced server-side rather than shown as per-axis history
- [~] **Step 8 — Polish.** PWA, offline queue, AccessoryBar IME bypass, and screen-time signal handling are done — though screen-time is **not enforced** anywhere yet, because the engine's quota client is a development stub. Ceremony lifetime XP / school standing and browser-level cross-mode E2E are not done

Step 4 requires the Node backend running socket.io; step 4 is verified wired
on the UI side of this repo (see spec Appendix A.2) but end-to-end behavior still
depends on the backend actually running socket.io in your environment.

## Confidential · Patent Pending · Starisian Technologies
