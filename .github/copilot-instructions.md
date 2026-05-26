# Copilot Instructions — sparxstar-3iatlas-rlc-ui

This repository is the **React 19 + TypeScript + Vite PWA** for the SPARXSTAR
3iAtlas Rapid Language Collection (RLC) classroom game. It is the UI only. It
calls the `sparxstar-3iatlas-rlc` WordPress plugin REST API at `/aiwa/v1/`.

**Read `AGENTS.md` in the repo root first.** It is the canonical contract for
this repo: absolute rules, backend endpoints, UI rules, coding standards, file
structure, and phase status. Everything below is supplementary.

## Authoritative specs

- UI technical spec: `.github/instructions/sparxstar-3iatlas-rlc-ui-technical-spec.md`
- Game spec (most current): `.github/instructions/Sparxstar 3iatlas rlc spec v2.1 .md`
- Suite architecture: `.github/instructions/3IATLAS-SUITE-ARCHITECTURE-v1.0.md`
- RWC/RSC technical spec: `[.github/instructions/AIWA-RWC-RSC-Technical-Specification-v3.0.md](https://github.com/Starisian-Technologies/sparxstar-3iatlas-rlc-ui/blob/main/.github/instructions/SPARXSTAR-3iAtlas-RLC-Spec-v3.0.md)`

## Backend

- Game server (WordPress plugin): https://github.com/Starisian-Technologies/sparxstar-3iatlas-rlc
- Namespace `Starisian\Sparxstar\Aiwa`, REST base `/aiwa/v1/`.
- `sparxstar-3iatlas-dictionary` is a **separate** upstream lexical service — its
  PHP/WordPress conventions do **not** apply to this repo.

## Hard constraints (see AGENTS.md for the full list)

- No WordPress dependency, no Node server, no database. Static-built client only.
- No WebSocket library — use 2-second polling via `useSessionPoll`.
- Token immutability: QC corrections create new tokens; never imply the original
  was changed.
- `AccessoryBar` is mandatory on every text-input screen; `ŋ` is the first char.
- Keep the Starmus recorder placeholder; do not implement audio recording.
- Inline styles only. TypeScript strict, no `any`. Functional components only.

## UI mockups

- [Game Play](./instructions/RLC-game-play.png)
- [Awards](./instructions/RLC-awards.png)
- [Awards 2](./instructions/RLC-awards-2.png)
- [Awards 3](./instructions/RLC-awards-3.png)

## Before opening a PR

Run and pass all of: `npm run typecheck`, `npm run lint`, `npm run test`,
`npm run build`.

---

sparxstar-3iatlas-rlc-ui | Starisian Technologies | CONFIDENTIAL — PATENT PENDING
