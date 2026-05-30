# AGENTS.md — sparxstar-3iatlas-rlc-ui

## What This Repo Is

This is the **React 19 + TypeScript + Vite + i18next PWA frontend** for the
SPARXSTAR 3iAtlas RLC (Rapid Language Collection) Platform. It is one of three
repos in the 3iAtlas RLC system. It is a pure client. It has **no WordPress
dependency, no Node server of its own, no database, no game logic**.

It calls the `sparxstar-3iatlas-rlc-node-engine` Node backend over REST
(`/api/v1/`) and socket.io.

## The Three Repos

| Repo | Role |
| :---- | :---- |
| **`sparxstar-3iatlas-rlc-ui`** (this repo) | React frontend — all screens, all user interaction, localized |
| `sparxstar-3iatlas-rlc-node-engine` | Node + Express + PostgreSQL + socket.io — all game logic, all data, system of record |
| `sparxstar-3iatlas-rlc` | WordPress PHP plugin — orchestrator: myCred hooks, DVE promotion, WordPress page mount only |

## Canonical Spec

**The single authoritative document is `.github/instructions/SPARXSTAR-3iAtlas-RLC-Spec-v4.0.md`.** It supersedes everything prior. If anything in this AGENTS.md conflicts with the spec, the spec wins.

UI mockups live in `.github/instructions/` (`RLC-game-play.png`, `RLC-awards*.png`).

---

## Absolute Rules — Never Violate

- **UI talks to the Node backend only.** Base URL is `window.RLC_API_BASE` (injected by the orchestrator) or `/api/v1` fallback. **Never call WordPress directly.**
- **Audio never touches the UI's data layer.** Starmus widget routes audio directly to Yahura MCP. The UI never references audio files in any API call, never stores audio, never holds binary audio bytes.
- **Participant token in memory only.** Never persist to localStorage or IndexedDB.
- **Never compute XP client-side.** XP comes from the backend on the `token:submitted` socket event and the `token/save` response.
- **Token immutability.** Corrections are stored in `corrected_text` on the original token — never a new token, never overwriting `text`. UI says "correction submitted," never "word updated."
- **AccessoryBar is mandatory** on every screen with a text input. `ŋ` must be the first character. Multi-character inserts (`aa ee ii oo uu`) must bypass IME autocorrect.
- **Localization always.** Every student-facing string is an i18next localization key. No hardcoded English in any student-facing component. Launch locales: Mandinka, Wolof, Fula, English, French.
- **Submitter anonymized in QC.** The submitter's screen name is never displayed in any QC card, on student or teacher screens. Identity is revealed only during ceremony star reveals.
- **Three-step sequence** in collection: text → translation → recording. State machine enforced as pedagogical guide, not a rejection gate. Steps not required by the selected depth are **hidden entirely** — never shown disabled.
- **Keep the Starmus recorder placeholder** until the real widget is wired; do not implement audio recording inside the UI.
- **No WebSocket library beyond socket.io-client.** No custom WS protocol.
- **No WordPress packages.** No `@wordpress/*`. The orchestrator (PHP plugin) only mounts this app and injects host globals — the UI never calls WP REST directly.

---

## What the Backend Provides

REST base: `/api/v1/`. socket.io for live game state.

### Key REST endpoints (full contract in §6.3 of the spec)

| Method | Path | Auth | Purpose |
| :---- | :---- | :---- | :---- |
| POST | `/session/create` | Teacher JWT | Create session |
| POST | `/session/join` | None (tier-aware body) | Join session — see tier rules below |
| GET | `/session/:id/status` | None | Poll session metadata (real-time still via socket) |
| POST | `/session/:id/close` | Teacher JWT | End collection, trigger QC |
| GET | `/session/:id/qc-words` | None | Ordered `QcToken[]`, submitter stripped |
| GET | `/session/:id/awards` | None | Stars + leaderboards |
| POST | `/session/:id/teachers-star` | Teacher JWT | Assign Teacher's Star |
| POST | `/token/save` | Participant token | Submit word/sentence |
| POST | `/token/:id/vote` | Participant token | Cast orthography/semantics/audio vote |
| POST | `/token/:id/translate` | Participant token | QC translation |
| POST | `/token/:id/correct` | Submitter only | Submit correction |
| POST | `/token/:id/approve` | Teacher JWT | Approve for DVE promotion |
| POST | `/events/batch` | Participant token | Flush offline queue |

### Key socket events

`session:joined` · `session:left` · `token:submitted` · `saturation:signal` · `session:status` · `qc:token` · `qc:audio-ready` · `qc:vote` · `qc:translation` · `qc:correction` · `ceremony:star` · `ceremony:end` · `screentime:limit-reached`

### Session statuses

`open | qc | ceremony | closed | archived` (monotonic forward; UI routes on the observed status — `qc`/`closed` → QC, `ceremony`/`archived` → ceremony).

---

## Tier-aware Login (S1)

| Tier | Credential |
| :---- | :---- |
| Lower Basic (grades 1–6) | Join code → tap your screen name from a roster. No credential, no typing. |
| Upper Basic (grades 7–9) | Join code + screen name + 4-digit PIN (`inputmode="numeric"`, masked, auto-advance). |
| Senior Secondary (grades 10–12) | Join code + screen name + password (`type="password"`, 12-char min, show/hide). |
| Adult | Same as Senior Secondary. |

School ID is injected by the orchestrator host page as `window.RLC_SCHOOL_ID` — never entered by the student. Three failed attempts locks the account; teacher unlocks via T2 monitor.

### Join failure responses (handle in UI with localized error UX)

| Code | Meaning |
| :---- | :---- |
| 401 | Wrong PIN/password (returns `remaining_attempts`) |
| 403 | Screen name not registered for this school |
| 410 | Join code expired or session closed |
| 423 | Account locked |
| 429 | Rate limit exceeded |
| 451 | Screen-time limit exceeded |

---

## Vote Dimensions — Locked

| Dimension | API string | UI label (localized) | Question (localized) |
| :---- | :---- | :---- | :---- |
| Orthography | `orthography` | Spelling | Is this word spelled correctly? |
| Semantics | `semantics` | Meaning | Does this make sense? Is the grammar correct? |
| Audio | `audio` | Pronunciation | Can you hear the word said properly? |

API/DB always uses the linguistic terms. UI labels are localization keys. **Never swap the API strings.**

QC sequence per token: Audio Vote (skipped if no transcription) → Orthography Vote → Semantics Vote → Correction (submitter only, if orthography majority No) → Translation. Only orthography drives correction; semantics and audio are signals to Behistun and Yahura respectively.

---

## Non-Negotiable UI Rules

- **Mobile first** — 360px viewport. Min 44px touch targets. Min 16px input/body font (prevents iOS auto-zoom).
- **Saturation signal** — when `saturation_signal === 'saturated'`, show a gentle "try a different one" redirect. Never an error, never a block.
- **One vote per participant per dimension per token** — disable vote buttons immediately after voting; never re-enable. Backend returns 409 on duplicate.
- **Community validation** — show live vote counts as they arrive; never hide or delay.
- **Screen-time enforcement** — on 423 at join or `screentime:limit-reached` mid-session, show a localized "Daily limit reached" screen and disconnect gracefully.
- **Rights confirmation on T1** — teacher confirms each rights field; no forced defaults; `ai_training` never defaulted true.

---

## Coding Standards

- **TypeScript:** strict mode. No `any`. No `@ts-ignore`. All props explicitly typed. All API responses typed against `src/types/index.ts`.
- **React:** functional components only. Use `useCallback` when needed (stable dependencies, memoized children), not by default. `void` prefix on async in event handlers: `onClick={() => void handleJoin()}`.
- **Accessibility:** `aria-label` where text isn't self-describing. `role="status"` / `aria-live="polite"` for live vote counts. `aria-busy="true"` on loading. Decorative glyphs `aria-hidden`.
- **Styling:** inline styles only — no CSS modules, Tailwind, styled-components. Brand blue `#1B3A6B`, gold `#C9A84C`, background `#f4f4f4`, text `#1a1a1a`. Radii: 8px inputs, 10px buttons, 12px cards. Never `position: fixed` for content — use `sticky` or flex.
- **Error handling:** every API call wrapped in try/catch. Plain-language localized errors — never raw API responses or stack traces. Network failures must not lose typed input.
- **Imports:** `@/` alias for `src/` (configured in `vite.config.ts`).

---

## File Structure

```
src/
  screens/
    teacher/   ← SetupScreen (T1), MonitorScreen (T2), QcTeacherScreen (T3), TeacherStarScreen (T4)
    student/   ← JoinScreen variants (LB / UB / SS / Adult), LobbyScreen, RwcCollectionScreen (S2),
                 RscCollectionScreen (S3), RoundCompleteScreen, RscCompleteScreen,
                 ScreenTimeExceededScreen, AccountLockedScreen
    qc/        ← QcScreen (shared S4–S7 walk-through, anonymized submitter)
    ceremony/  ← CeremonyScreen (S8 / T5)
  components/  ← AccessoryBar, SyncStatusIndicator, Fireworks, ContinuityBanner, etc.
  hooks/       ← useSocket, useScreenTime, useAccountSession, useSubmissionQueue, useNetworkStatus
  api/         ← client.ts only — do not add API files
  i18n/        ← i18next init + locale bundles (en, mn, wo, ff, fr)
  runtime/     ← offline queue, screen-time tracking, RLC event emitters
  services/    ← auth helpers (JWT role parsing, participant token), drafts handler
  types/       ← index.ts only — add types here, do not create new type files
  App.tsx      ← top-level screen router + game state
```

One screen per file. One hook per file. No barrel files.

---

## Host-Page Injection

The orchestrator (`sparxstar-3iatlas-rlc`) injects on the WordPress page where the app mounts:

```
window.RLC_API_BASE      = "https://backend.example/api/v1"
window.RLC_TEACHER_TOKEN = "<backend-issued JWT, present only for teacher sessions>"
window.RLC_SCHOOL_ID     = "<UUID of the school for this deployment>"
```

In dev these are set via `.env.local` (see `.env.example`) and the Vite proxy.

---

## Scripts

```bash
npm run dev        # Vite dev server
npm run build      # tsc -b && vite build
npm run typecheck  # tsc -b
npm run lint       # eslint .
npm run test       # vitest run
npm run smoke      # contract smoke test (set RLC_SMOKE_BASE)
```

Before opening a PR, `typecheck`, `lint`, `test`, and `build` must all pass.

---

## Build Order (this repo's slice of v4.0 §10)

| Phase | UI work in this repo |
| :---- | :---- |
| 1 — Scaffold | (backend phase) |
| 2 — Accounts & Schools | Small: types + `useAccountSession` hook + smoke test shapes |
| 3 — Session core | **Big.** Tier-aware S1, T1 with rights confirmation, T2 with LB roster panel and locked-account list, socket.io connect, i18next wired (English), RLC_* host-global injection path, replace polling with sockets |
| 4 — RWC | S2 already mostly done. Add AccessoryBar IME bypass + long vowels, drive XP from socket, Starmus mount |
| 5 — RSC | S3 already mostly done. Add tri-state `focus_detected`, localize prompts |
| 6 — QC | **Heavy.** Rewrite QcScreen for audio → orthography → semantics → correction → translation sequence. Anonymize submitter. Offline queue for vote/translate/correct. |
| 7 — Awards | Extend CeremonyScreen with lifetime XP + school standing. Extract T4 from QcScreen. Localize star names. |
| 8 — Orchestrator | (orchestrator phase) |
| 9 — Polish | PWA, all-action offline queue, screen-time enforcement UI, E2E tests both modes |

---

## What Not To Do

- Do not add WordPress dependencies, REST calls to `/wp-json`, or `@wordpress/*` packages
- Do not add a Node server or database to this repo
- Do not call Yahura, Behistun, ESU, DVE, or any SPARXSTAR pipeline component directly — backend handles all downstream. There is no external identity provider; the backend mints its own JWTs and HMAC participant tokens.
- Do not implement reward logic, XP calculation, or badge awards — myCred owns reward logic
- Do not store plaintext writing or audio anywhere — all server-side at rest is encrypted, audio never reaches us
- Do not show productivity metrics (word count, time on task, typing speed) anywhere
- Do not hardcode English in student-facing strings — every string is a localization key
- Do not show submitter identity in QC — anonymization is non-negotiable
