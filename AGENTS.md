# AGENTS.md — sparxstar-3iatlas-rlc-ui

## What This Repo Is

This is the **React 19 + TypeScript + Vite PWA frontend** for the 3iAtlas Rapid
Language Collection (RLC) classroom game. It is a pure client. It has **no
WordPress, Node server, or database dependency**.

It calls the `sparxstar-3iatlas-rlc` WordPress plugin REST API at `/aiwa/v1/`.
The plugin is the server; this repo is the UI.

- **Backend repo (game server):** https://github.com/Starisian-Technologies/sparxstar-3iatlas-rlc
- **Authoritative UI spec:** `docs/specs/sparxstar-3iatlas-rlc-ui-technical-spec.md`
- **Game spec (most current):** `docs/specs/Sparxstar 3iatlas rlc spec v2.1 .md`
- **Suite architecture:** `docs/specs/3IATLAS-SUITE-ARCHITECTURE-v1.0.md`

> Note: `sparxstar-3iatlas-dictionary` is a **separate** upstream lexical service,
> not this repo and not the RLC game server. Do not apply its PHP/WordPress
> conventions here.

---

## Absolute Rules — Never Violate

- **No WordPress dependency.** No `@wordpress/*` packages. No WP REST calls
  outside `/aiwa/v1/`. No WordPress authentication — session identity is
  `participant_id` only.
- **No Node server, no database.** This is a static-built client.
- **No direct downstream integrations.** The UI never calls DVE, Mḗh₁n̥s,
  Dheghom, Helios, or Sirus directly. It calls `/aiwa/v1/` only; the plugin
  handles downstream.
- **No WebSocket library** (no socket.io). Real-time updates use 2-second
  polling via `useSessionPoll`. WebSockets are a future phase.
- **Token immutability.** QC corrections create new tokens; the original is
  never overwritten. The UI must say "correction submitted" — never "word
  updated" / "word changed".
- **AccessoryBar is mandatory** on every screen with word/sentence text input.
  Import from `src/components/AccessoryBar.tsx`. `ŋ` must be the first character.
- **Do not implement audio recording.** Keep the Starmus recorder placeholder.
  `@sparxstar/starmus-audio` is wired in as a separate task.

---

## Backend — What the Plugin Provides

Repo: `sparxstar-3iatlas-rlc` · Namespace: `Starisian\Sparxstar\Aiwa` · REST base: `/aiwa/v1/`

Session statuses: `open | closed | qc | ceremony | archived` (see `SessionStatus`
in `src/types/index.ts`).

Key endpoints (all under `/aiwa/v1/`):

| Method | Path | Purpose |
|---|---|---|
| POST | `/session/create` | Create session → `{ session_id, join_code }` |
| POST | `/session/join` | Join → `{ session_id, participant_id, language, mode, collection_depth }` |
| GET | `/session/{id}/status` | Poll → `{ status, participant_count, token_count, time_remaining_seconds, leaderboard[] }` |
| POST | `/session/{id}/close` | End collection phase |
| GET | `/session/{id}/qc-words` | Ordered `QcToken[]` for QC |
| GET | `/session/{id}/awards` | `{ stars[], leaderboard[], total_tokens, discovery_count }` |
| POST | `/session/{id}/teachers-star` | Assign Teacher's Star — `{ participant_id }` |
| POST | `/token/save` | Submit word/sentence → `{ token_id, spelling_signal, saturation_signal, spelling_score, xp_awarded }` |
| POST | `/token/{id}/vote` | Cast vote — `{ dimension, vote_yes }` |
| POST | `/token/{id}/translate` | QC translation — `{ translation }` |
| POST | `/token/{id}/correct` | Correction — `{ corrected_text }` |

The full REST client lives in `src/api/client.ts` — **do not create additional
API files**.

---

## Non-Negotiable UI Rules (Spec §10)

- **Mobile first** — design for a 360px viewport first; desktop is secondary.
- **Touch targets** — minimum 44px height on every interactive element.
- **Font size** — minimum 16px on inputs and body text (prevents iOS auto-zoom).
- **Three-step sequence** — collection is `text → translation → recording`. The
  submit button stays disabled until the steps required by `collection_depth`
  are met: `basic` = text only; `translation_only` = text + translation;
  `full` = all three.
- **Saturation signal** — when `saturation_signal === 'saturated'`, show a gentle
  redirect ("try a different one"). Never an error, never a block.
- **One vote per participant per dimension per token** — disable vote buttons
  immediately after voting; never re-enable.
- **Community validation** — show live vote counts as they arrive; never hide or
  delay results.

---

## Coding Standards

- **TypeScript:** strict mode. No `any`. No `@ts-ignore`. All props interfaces
  explicitly typed. All API responses typed against `src/types/index.ts`.
- **React:** functional components only. `useCallback` on handlers passed as
  props. `void` prefix on async calls in event handlers
  (`onClick={() => void handleJoin()}`).
- **Accessibility:** `aria-label` on any control whose text isn't
  self-describing. `role="status"` / `aria-live="polite"` for live vote counts.
  `aria-busy="true"` on loading elements. Mark decorative glyphs `aria-hidden`.
- **Styling:** inline styles only — no CSS modules, Tailwind, or
  styled-components. Brand blue `#1B3A6B`, gold `#C9A84C`, background `#f4f4f4`,
  text `#1a1a1a`. Radii: 8px inputs, 10px buttons, 12px cards. Never
  `position: fixed` for content — use `sticky` or flex.
- **Error handling:** every API call wrapped in try/catch. Show plain-language
  errors — never raw API responses or stack traces. Network failures must not
  lose the student's typed input (keep it in React state).
- **Imports:** use the `@/` alias for `src/` (configured in `vite.config.ts`).

---

## File Structure

```
src/
  screens/
    teacher/   ← SetupScreen, MonitorScreen, QcTeacherScreen
    student/   ← JoinScreen, LobbyScreen, RwcCollectionScreen,
                 RscCollectionScreen, RoundCompleteScreen
    qc/        ← QcScreen (shared)
    ceremony/  ← CeremonyScreen
  components/  ← AccessoryBar, SyncStatusIndicator, Fireworks, etc.
  hooks/       ← useSessionPoll, useQcSession, useSubmissionQueue, ...
  api/         ← client.ts only — do not add API files
  runtime/     ← offline queue + RLC event emitters
  types/       ← index.ts only — add types here, no new type files
  App.tsx      ← top-level screen router + game state
```

One screen per file. One hook per file. No barrel files.

---

## Scripts

```bash
npm run dev        # Vite dev server
npm run build      # tsc -b && vite build
npm run typecheck  # tsc -b
npm run lint       # eslint .
npm run test       # vitest run
```

Before opening a PR, all of `typecheck`, `lint`, `test`, and `build` must pass.

---

## Phase Status

- Phases 1–2 — scaffold, types, API client, routing, session core (done)
- Phases 4–6 — RSC collection, QC phase, awards ceremony (done)
- Phases 7–8 — PWA, offline queue, canonical RLC events, sync indicators,
  dynamic session setup (done)
- Phase 9 — RSC complete screen, auto-routing to QC, session cleanup (in
  progress)

Build features in the order defined per phase in the authoritative UI spec; do
not jump ahead (e.g. ceremony before QC works).
