# Copilot Instructions — sparxstar-3iatlas-rlc-ui

This repository is the **React 19 + TypeScript + Vite + i18next PWA** for the
SPARXSTAR 3iAtlas RLC (Rapid Language Collection) Platform. It is the UI only. It calls
the `sparxstar-3iatlas-rlc-node-engine` Node backend over REST (`/api/v1/`) and
socket.io.

**Read `AGENTS.md` in the repo root first.** It is the canonical contract for
this repo: absolute rules, backend endpoints, UI rules, coding standards, file
structure. Everything below is supplementary.

## Authoritative spec

- **Canonical:** `.github/instructions/SPARXSTAR-3iAtlas-RLC-Spec-v4.0.md`

This document supersedes every prior spec — v1.x, v2.x, v2.1, v3.0, and any
integration-contract notes. They have been removed from this repo. If you find
another spec file anywhere, ignore it.

## The three repos

- **`sparxstar-3iatlas-rlc-ui`** (this repo) — React frontend
- `sparxstar-3iatlas-rlc-node-engine` — Node + Express + PostgreSQL + socket.io backend (system of record)
- `sparxstar-3iatlas-rlc` — WordPress PHP orchestrator (myCred + DVE + page mount only)

## Hard constraints (full list in AGENTS.md / spec §9)

- UI talks to the Node backend only. Never call WordPress directly.
- Real-time is socket.io. Use `socket.io-client`. No polling for live game state.
- Audio never touches the UI's data layer. Starmus routes directly to Yahura. Keep the Starmus placeholder until the real widget is wired.
- Every student-facing string is an i18next key. No hardcoded English.
- Submitter identity is never displayed in QC. Revealed only at ceremony.
- Participant token in memory only — never localStorage, never IndexedDB.
- AccessoryBar is mandatory on text-input screens; `ŋ` is the first character; multi-char inserts bypass IME.
- TypeScript strict. Inline styles only. Functional components.

## UI mockups

- [Game Play](./instructions/RLC-game-play.png)
- [Awards](./instructions/RLC-awards.png)
- [Awards 2](./instructions/RLC-awards-2.png)
- [Awards 3](./instructions/RLC-awards-3.png)

## Before opening a PR

Run and pass all of: `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`.

---

sparxstar-3iatlas-rlc-ui · Starisian Technologies · CONFIDENTIAL · PATENT PENDING
