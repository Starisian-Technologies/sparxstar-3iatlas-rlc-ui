# ROLE.md — SPARXSTAR 3iAtlas RLC UI (`sparxstar-3iatlas-rlc-ui`)

Boundary document. It cites platform records by number and does not restate
them — one home per fact. Written 2026-09-05 from this repo's own code; every
claim below is checkable in `src/`.

**Product group:** 3iAtlas

---

## What this repo owns

The **React client for Rapid Language Collection** — every screen a student,
teacher or QC reviewer touches during an RLC session, and nothing behind them.

- **Screens and flow.** `src/screens/` — `student/`, `teacher/`, `qc/`,
  `ceremony/`. Session join, the collection loop, QC review, the closing
  ceremony.
- **Live session transport, client side.** `src/runtime/socket.ts`,
  `src/runtime/serverEvents.ts`, and the hooks over them (`useSessionSocket`,
  `useQcSession`, `useCeremony`, `useSessionPoll`). This repo owns how the
  client *consumes* the socket contract; it does not own the contract.
- **Audio capture in the browser.** `src/components/RlcRecorder.tsx` — getting
  a recording out of the device and to the engine.
- **Localization.** `src/i18n/` and its locale bundles. Every student-facing
  string is a key (spec §1.8). The bundles are this repo's; the *policy* that
  strings are always keys is the spec's.
- **Theme and presentation.** `src/theme/`.
- **Client-side state only** — what is on screen right now, in this tab.

## What this repo does not own

- **XP, Gold, stars, badges, and any award.** The RLC Node engine alone settles
  them (**ADR-029**). This client submits results and renders what the engine
  returns; it never grants, computes or infers an award (**INV-016**). Gold is
  **earn-only in Release 1** — no shop, no wallet, no spending, no client-side
  granting. Do not build a balance a player cannot use.
- **Scoring rules.** Server-side, per manifest, in the engine.
- **Session authority.** The engine owns session lifecycle, membership and
  progression. This client reflects it.
- **The wire contract.** Endpoints, field names, status codes and payload
  shapes belong to the RLC Integration Contract. When this repo disagrees with
  it, this repo is wrong. In particular: the screen-time gate is **not** an
  account lockout — never show a lockout message or unlock path for a player
  who has simply used up the day's minutes.
- **The canonical spec.** Since **registry OQ-019** (2026-09-05) the canonical
  home for RLC-Spec-v4.0 is the **product-specification registry**. The copy in
  this repo's `.github/instructions/` is a **snapshot**, and its header lists
  exactly which sections have been synced. Where it disagrees with the
  registry, the registry wins.
- **Identity.** Authentication and credential classes are the Identity Node's
  (**ADR-020**). This client holds a token; it does not mint or validate one.
- **Dictionary content.** Words, definitions and rights come from the
  Dictionary; this repo never edits linguistic data.

## Contracts produced

None — this repo consumes contracts only.

## Consumed by

Nothing consumes this repo. It is a leaf: an end-user client, deployed as a
site rather than imported as a dependency.

---

## Open against this repo

- **No product-specification registry key.** Every other 3iAtlas product has a
  key in `MANIFEST.json` backed by a tech spec; this repo has no
  `docs/*-tech-spec.md` for a key to point at, so none was registered on
  2026-09-05. Writing that spec is the prerequisite, not the registration.
- **The snapshot is only partly synced.** See its header for the exact list.
  Re-syncing the rest is a separate task and must not be done blind.
