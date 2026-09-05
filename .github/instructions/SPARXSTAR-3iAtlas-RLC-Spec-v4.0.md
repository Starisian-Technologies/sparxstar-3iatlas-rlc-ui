# 3iAtlas Rapid Language Collection Platform
## Technical Specification v4.0
### Starisian Technologies / AI West Africa · Confidential · May 2026
### Corrected 2026-07 — doc-vs-code verification pass (see §3.10, §11)

> **Status: `snapshot`** — a DOWNSTREAM COPY, corrected 2026-09.
>
> This file previously declared itself `canonical`, as does
> `sparxstar-3iatlas-rlc-node-engine/.github/instructions/sparxstar-3iatlas-rlc-spec-v4.0.md`
> — two files each claiming to be "the single source of truth", which is exactly
> the duplicate-home problem the Status-field system exists to prevent. The two
> had also **already diverged** in content, so a reader could not tell which
> statement to trust.
>
> The engine repo's `AGENTS.md` §2 names its copy as canonical, and the engine
> is where the behaviour being described is implemented. **This copy is a
> snapshot. On any conflict the engine repo's copy is authoritative and this one
> is wrong.**
>
> **What has been synced from the engine's copy, and nothing else:**
>
> - **§1.6** — reward ownership in full (engine-authoritative XP and ledger, the
>   two manifest registries, badges undefined, the myCred product boundary).
> - **§1.7** — the screen-time rejection sentence only. It claimed 423 and
>   contradicted §11's own error table; it now states the behaviour and defers
>   the wire shape to §11 and the Integration Contract.
> - **§6.5 / §6.6** — the six reward rows that read "Gold badge", plus the note
>   defining Gold as a currency.
>
> Every other section is **unsynced** and may still drift. Re-syncing them is a
> separate task; doing it blind here would risk overwriting UI-specific
> corrections that have not been verified against the engine.
>
> **2026-07 correction note:** this revision consolidates and corrects
> doc-vs-code drift found by direct inspection of `src/` (not by re-describing
> what other documents claim). §3.10 corrects how several already-shipped
> mechanisms actually behave (`/events/batch` gating, XP settlement, webhook
> fan-out, CORS single-origin, `gameType` registration). §11 inventories
> surfaces that `docs/PLATFORM-PLAN.md` and companion ADRs describe as future
> work and are **not implemented** — most importantly the tenant API and the
> dictionary-games integration path. No REST/socket contract shape changed;
> this pass corrected descriptions, not behavior.

---

| ⚠️ SUPERSEDED BANNER — this file is a SNAPSHOT |
| :---- |
| **The banner below is legacy.** It predates the 2026-09 correction in this file's header and is kept only so the diff against the engine's copy stays readable. This file is NOT canonical; the engine repo's copy is. Historic text follows. |
| ~~This is the single authoritative specification for:~~ |
| `sparxstar-3iatlas-rlc-ui` · `sparxstar-3iatlas-rlc-node-engine` · `sparxstar-3iatlas-rlc` |
| ~~It supersedes every prior document without exception.~~ |
| ~~If another document conflicts with this one — **this document wins**.~~ **Superseded:** this file is a snapshot and the engine repo's copy wins. `supporting` docs (see this repo's `AGENTS.md` for the Status-field system) may be read but never override v4.0; `superseded` docs are ignored. |
| **Wire surface delegated:** exact endpoints, field names, encodings, and status codes live in the Integration Contract (`SPARXSTAR-3iAtlas-RLC-Contract-v1.0.md`, `supporting`). This spec governs **behavior** and does not define wire encoding; the two never claim the same fact. |
| Do not deviate without explicit written approval from Max Barrett. |
| If a rule blocks your approach — change the approach, not the rule. |

---

# 1. Governing Principles

## 1.1 Data Ethics — Primary Source Always Destroyed

**All primary source data submitted by students through 3iAtlas products is destroyed after processing. What is retained is derived, inferenced, and secondary — the structured linguistic signal extracted from the submission, not the submission itself.**

This is the only architecture that meets data privacy law across all jurisdictions where this product operates — Gambia, EU, US, and California. It is not a compliance choice. It is the only legally viable architecture for a product collecting data from minors.

| Data type | What happens |
| :---- | :---- |
| **Audio recording** | Captured → routed directly by Starmus to Yahura MCP → transcribed → destroyed. No audio file persists after Yahura processing completes. Never stored. Never enters DVE. Starmus does not persist audio between capture and Yahura routing — no retry buffer, no cache, no local copy. If routing fails, the student is prompted to re-record. |
| **Typed text** | Encrypted at rest. Retained as structured linguistic signal — spelling confidence, domain classification, vote outcome. Not retained as a child's personal record. |
| **Translation** | Encrypted at rest. Retained as derived parallel corpus signal. |
| **Student identity** | Screen name only. No PII stored by AIWA. School holds the mapping between screen name and real student. AIWA never does. |

> **Verification note, 2026-08-23.** The engine's
> `docs/PRIVACY-LIFECYCLE.md` documents the **implemented** lifecycle of each row
> in the table above — where readable material exists, for how long, and what
> deletion actually removes — and reports three places where the claims in this
> section are stronger than the implementation can currently support: the
> headline "primary source is destroyed" sentence versus this table's own
> "retained, encrypted" entry for typed text; the audio-destruction claim, which
> concerns components outside these repositories and has never run end to end;
> and erasure completeness against a strict Article 17 reading. Those are
> escalated for owner and legal ruling. **No claim in this section was weakened
> to accommodate them**, and no encryption or erasure behaviour was changed.

## 1.2 All Writing Is Encrypted At Rest — All Users, All Tiers

Every character a student or adult types in any 3iAtlas product is encrypted at rest. This is architectural — not a policy, not a configuration option, not defeatable.

The reason: writing content is unpredictable. A student could write a class list, a phone number, a home address, a family situation. Any of that leaking is a PII incident regardless of the student's age. The only safe assumption is that writing contains PII. Therefore it is always encrypted.

**Key model:** AES-256-GCM. Per-account data encryption key (DEK), wrapped by a per-school key-encryption key (KEK), wrapped by a backend master key in an external KMS. Article 17 erasure is a single DEK destruction. Key rotation is performed at the KEK level — no row rewrites required.

Teacher visibility of content is governed by tier (§1.5). Encryption does not change — only the key access model changes by tier.

## 1.3 The Audio Quality Standard

**If children can hear a word said properly from a recording made in a crowded, loud classroom full of kids shouting — the AI must have the same ears. That is the quality threshold.**

This is the governing standard for all speech technology in the AIWA platform. The community sets the bar by voting. The AI must meet it.

Every classroom audio vote is simultaneously:

- A pronunciation validation for the dictionary
- A real-world TTS/STT feasibility signal for West African languages in actual classroom acoustic conditions
- Ground truth feedback to Yahura on whether its transcription was accurate
- A pronunciation variance model — thirty speakers, different ages, different accents, same word

The game is the data collection mechanism. The audio vote is how the community tells the AI whether it got the word right. The audio vote result feeds back to Yahura as a correction signal — community No flags the transcription as low confidence.

**Audio vote question shown to students (localized):** "Can you hear the word said properly?"

- **Yes** — pronunciation confirmed, recording quality acceptable, Yahura transcription reinforced
- **No** — mispronounced or recording too poor — Yahura transcription flagged as low confidence

One vote covers both pronunciation accuracy and recording quality simultaneously.

## 1.4 Never Block — Always Flag

**No submission is ever rejected at intake.**

A 91-year-old woman telling the creation myth of her people is the highest-value data this system will ever receive. That recording happens once. If metadata is incomplete — the recording is accepted unconditionally. The system flags it. The system finds a way.

The classroom student flow enforces the three-step state machine as a pedagogical guide — not as a rejection gate. The elder/field recording flow has no gate at all.

Flags are not penalties. They are signals that drive enrichment, human review, and retroactive reward settlement.

## 1.5 User Tiers — Gambian Education Structure

**Research gap acknowledged.** Existing digital literacy and credential management research is drawn from Western contexts (US, EU, South Africa). No equivalent peer-reviewed research exists for Gambian or broader West African classroom contexts. The tier boundaries below follow the Gambian national education structure as the most contextually appropriate boundary available. These should be reviewed and adjusted as real-world usage data from Gambian classrooms is collected.

| Tier | Gambia level | Grades | Login model | Teacher visibility | Writing privacy | Screen time |
| :---- | :---- | :---- | :---- | :---- | :---- | :---- |
| **Lower Basic** | Lower Basic | 1–6 | Teacher-managed class code. No individual login. Screen names assigned by teacher. | Full — teacher sees all activity and submitted content | Encrypted at rest. Teacher can read submitted work. | Grade-level enforced |
| **Upper Basic** | Upper Basic | 7–9 | School-issued screen name + 4-digit PIN. Student owns the PIN. Shared device safe. | Activity signals only — last active, submitted/not submitted. Content visible only on submission. | Encrypted at rest. Teacher reads on submission. | Age-appropriate ceiling |
| **Senior Secondary** | Senior Secondary | 10–12 | Screen name + password. Student controls. Shared device safe. | Activity signals only — last active, submitted/not submitted. Content never visible before submission. | Encrypted at rest. Teacher reads only submitted work. Unsubmitted drafts inaccessible to all parties including AIWA. | Age-appropriate ceiling |
| **Adult** | Post-secondary | — | Full account. Own credentials. May join a teacher-created session, **and may also play individually** — see the amendment below. | N/A — no school context | Encrypted at rest. Full ownership. | None |

**Amendment 2026-08-23 — adult individual play is in scope.** This row
previously ended *"adult solo collection is out of scope for v4.0"*, which was
true when written and is now misleading. Two things changed:

- **§3.11 (amended 2026-08-21)** admits authenticated adult single-player
  **game results** — which is what Release 1 actually serves. Results are not
  writing, so this is narrower than it sounds, but the flat "out of scope"
  reading was wrong.
- **RLC supports individual gameplay as a first-class mode** (owner ruling,
  2026-08-23), on the same engine as classroom play.

What remains out of scope is adult solo **writing collection** — the RWC/RSC
surface requires a session, and Release 1 stores game results rather than
writing. Read this row together with §3.11 rather than on its own.

**Credential rules:**

- **PIN (Upper Basic):** 4 digits, numeric only. Three failed attempts locks the account — teacher unlocks via T2 monitor. Reset path: teacher issues a new PIN; old PIN invalidated.
- **Password (Senior Secondary, Adult):** Minimum 12 characters. At least one letter and one digit. No complexity beyond that — usability over theatre. Three failed attempts locks the account. Reset path: SS via teacher; Adult via password reset email (the only optional-PII field on adult accounts).
- **Storage:** PIN and password are hashed with Argon2id. Plaintext never written to disk, never logged, never returned in API responses.

**Teacher dashboard shows for all tiers:**

- Student active / not active
- Assignment submitted / not submitted
- Last active timestamp (defined as `MAX(last_socket_heartbeat, last_submission_at)`; never keystroke or typing telemetry)

**Teacher dashboard never shows for any tier:**

- Word count
- Time on task
- Typing speed
- Any productivity metric

This is grounded in educational research consensus (Google Classroom, Canvas, Seesaw standard) and the principle that handwriting studies show productivity metrics are a poor proxy for language learning. A student composing a Mandinka sentence in their head before typing a single character is doing the most important cognitive work in the session.

## 1.6 Rewards — Engine-Authoritative XP; Stars and Badges Undefined

**Corrected 2026-09.** This section previously read "Rewards — myCred Hooks
Only" and stated that *"AIWA does not implement reward logic, tiers, or
redemption"* and that *"XP, Gold, stars, and badges are all myCred entities."*
Both sentences contradicted **the Node engine's code** — the engine is where
this behaviour is implemented — and the locked Node-only product boundary. Under **code wins**, the code is the truth and the spec is
corrected — not the reverse.

**What the engine's code does.** Every path below is in
`sparxstar-3iatlas-rlc-node-engine`, NOT in this repository; they are cited so a
reader can check the claim at its source:

- `src/services/xp.ts` maintains lifetime, class and school XP counters and
  **dual-writes every grant to an append-only `reward_ledger`** in the same
  transaction (`src/models/ledger.ts`, NODE-ADR-004). `src/services/ledger.ts`
  reads it back. That is reward logic, implemented **in the Node engine**.
- `src/games/manifests.ts` (in the engine) resolves scoring from **two**
  registries, and they are not interchangeable: `GameManifest` is keyed by the
  closed RLC `Mode` union and carries `stars`/`star_xp`; `GameResultManifest`
  is keyed by `game_type` for non-RLC games and has **no star fields at all**.
  `dictionaryQuizManifest` is a `GameResultManifest`.
- `src/clients/mycred.ts` exports **`StubMyCredClient`** — `getRemainingScreenTime`
  returns the local tier limit and `sessionStarted`/`sessionEnded` only log.
  **There is no live myCred integration.** Nothing external owns rewards today.

**The ruling, and what is authoritative:**

| Concern | Owner |
| :---- | :---- |
| XP and its ledger | **This engine.** Node, server-authoritative. |
| Scoring, RLC modes | The registered `GameManifest` for that `mode`. |
| Scoring, non-RLC games (incl. Dictionary) | The registered `GameResultManifest` for that `game_type`. |
| Stars | Defined per manifest (`stars`, `star_xp`) for `rwc`/`rsc` **only**. |
| Badges | **Undefined.** No inventory and no thresholds exist in any repo. |
| Screen-time ledger | Still attributed to myCred — see §1.7 and the note below. |

**Stars and badges are blocked, not delegated.** `dictionaryQuizManifest`
carries `scoring_xp` and no `stars`/`star_xp`, so the dictionary games have no
star rule at all. Before either ships, a canonical formula, inventory,
ownership, settlement contract and display contract must be approved and added
to a server-authoritative Node contract. A client may **render settled results
and must never invent an award.**

**No WordPress and no myCred in Dictionary Games** — the boundary is the
product, not the platform. Nothing in the Dictionary Games client, its BFF or
its data path may call WordPress or myCred. That does not reach the engine's
own outbox: `dictionary_quiz` settles through the generic `game.result` seam,
which emits `game.result.settled`, and §6.6 routes that to a myCred hook. That
mirror is engine-mediated, one-way, and predates the ruling.

**Screen-time is a separate, still-open question.** myCred is named as the
screen-time ledger in §1.7 and `src/services/sessions.ts` calls the stub for it.
That reference is left standing deliberately rather than deleted with the reward
claims: removing it would put this spec *ahead* of the code in the opposite
direction, which is the same drift being corrected here. Whether screen-time
also moves to Node is not decided by this correction.

## 1.7 Screen Time Limits

Screen time is tracked per account per day across all 3iAtlas products combined — not per product separately.

| Tier | Daily limit |
| :---- | :---- |
| Lower Basic | 45–60 minutes |
| Upper Basic | 90 minutes |
| Senior Secondary | 120 minutes |
| Adult | No limit |

These are defaults. School admin can adjust within a configurable range via myCred / school dashboard. Hard ceiling cannot be removed — the system enforces it regardless of admin configuration.

**Central ledger:** The screen-time ledger lives in myCred (as it spans all 3iAtlas products and myCred already holds per-account state). On `POST /api/v1/session/join`, the backend queries myCred for remaining daily quota. **If the quota is exhausted the join is rejected, and that rejection is NOT an
account lockout** — a player who has used up the day's minutes must never be
shown a lockout message or offered an unlock path. This snapshot deliberately
does not restate the status code or body: §11's error table below and the
Integration Contract are the home for the wire shape. (Corrected 2026-09: this
sentence read "423 Locked + localized 'Daily limit reached'", which contradicted
this same document's §11 table — 423 is `account_locked`, 451 is
`screen_time_exceeded` — and the backend never sends localized strings.) Successful joins emit `screentime.session.started` to myCred; session close emits `screentime.session.ended` with elapsed minutes.

When a student hits their limit mid-session, the session ends gracefully — not a hard crash. Teacher is notified so they can manage the classroom.

## 1.8 Localization — Always

Every student-facing string is a localization key. Always. From day one. Not deferred. The product mission is to honor mother tongue — English-only interface contradicts the mission.

Supported at launch: Mandinka, Wolof, Fula, English, French. Grammar domain prompts, vote questions, button labels, error messages, ceremony text, example interjections ("Kai!" localizes per session language) — all localized. No hardcoded English in any student-facing component.

## 1.9 3iAtlas Governance Boundary

3iAtlas is a governance boundary within the SPARXSTAR platform. DVE governance principles apply — immutability, rights, provenance, community validation, human approval before promotion — but the storage model is different. Tokens are not DVE artifacts. They enter DVE only when promoted, teacher-approved, and ESU-enriched to DVE quality. Audio never enters DVE.

## 1.10 Rights on Every Token

Set at session creation. Teacher confirms each field — suggested presets, never forced.

| Field | Meaning |
| :---- | :---- |
| `license` | License under which derived data may be used |
| `ai_training` | Consent to use derived signal for AI model training — never defaulted true without confirmation |
| `commercial` | Consent to commercial use of derived data |

Rights travel with every token through every downstream system. Never stripped.

---

# 2. System Overview

## 2.1 Platform Position

| Downstream | What it receives |
| :---- | :---- |
| **Yahura MCP** | Audio routed directly from Starmus — transcribed, source destroyed, confidence returned |
| **Behistun MCP** | Text and student translation — enriched asynchronously post-save, per target language |
| **Sky ESU** | Near real-time learning loop — words, implied meanings, consistency signals |
| **myCred (via Rewards MCP)** | Quality signals → points, stars, badges. Also: screen-time ledger across all 3iAtlas products. |
| **DVE** | Promoted, teacher-approved, ESU-enriched tokens only — via orchestrator |

## 2.2 The Repos

**Amended 2026-08-23 (owner architectural ruling).** RLC is **entirely
Node.js/JavaScript**. It began as a WordPress-integrated system and is not one
now: **there is no WordPress RLC orchestrator, and none is to be created.** No
WordPress runtime dependency, no WordPress page mount, no WordPress-injected
teacher token, no WordPress-owned session workflow. Section 8 below is retained
as a record of the superseded design and is marked accordingly.

| Repo | Language | Responsibility |
| :---- | :---- | :---- |
| `sparxstar-3iatlas-rlc-ui` | React 19 + TypeScript + Vite + i18next | All classroom screens. All user interaction. Localized. Talks to the engine only. |
| `sparxstar-3iatlas-rlc-node-engine` | Node.js + Express + PostgreSQL + socket.io | The **shared gameplay engine for all games**. All game logic, all data, all real-time. System of record. |
| `sparxstar-3iatlas-identity-node` | Node.js | The suite's **sole authentication authority**. Issues the identity tokens the engine verifies. It never issues a permission. |
| `sparxstar-3iatlas-dictionary-games` | — | **A client** of the shared engine, not a separate competing architecture. |

RLC supports **both individual gameplay and teacher-led classroom gameplay** on
that one engine.

## 2.3 Repo Boundaries — Absolute

| Rule | Detail |
| :---- | :---- |
| UI talks to backend only | React never calls WordPress directly. |
| Backend owns all game state | Sessions, tokens, votes, XP, leaderboard — all in PostgreSQL. |
| Orchestrator is event-driven | Backend fires webhooks. Orchestrator listens. Never initiates game logic. |
| No game logic in orchestrator | PHP handles myCred hooks, DVE promotion, WordPress mount only. |
| Audio never touches the backend | Starmus routes audio directly to Yahura MCP. Backend receives completion signal only. |
| All writing encrypted at rest | No plaintext token text, translation, or corrected_text in the database. |

---

# 3. Architecture

## 3.1 Data Flow

```
TEACHER BROWSER                STUDENT BROWSERS (30x)
      │                               │
      └──── sparxstar-3iatlas-rlc-ui ─┘
                      │
               REST + WebSocket
                      │
                      ▼
         sparxstar-3iatlas-rlc-node-engine
         (Node + Express + PostgreSQL)
                      │
         ┌────────────┼──────────────────────┐
         │            │                      │
         ▼            ▼                      ▼
  sparxstar-      Yahura MCP ◄── Starmus  Behistun MCP
  3iatlas-rlc     (transcribe →           (translation
  (webhooks)       destroy →              enrichment,
         │         signal backend)        async post-save)
    ┌────┴────┐         │                      │
    │         │         └──────────────────────┘
  myCred   DVE                           Sky ESU
  hooks    promotion                     (learning loop →
           pipeline                       feeds DVE
                                          progressively)
```

## 3.2 Real-Time — WebSocket Events

socket.io handles all real-time game communication. No polling for game state.

**WebSocket / REST reconciliation:** WebSocket state wins for live game events. `POST /api/v1/events/batch` is catch-up only. Batch events carry sequence numbers — server applies in order, never conflicts.

**Participant token TTL:** Expires at session close. Auto-refreshed within 10 minutes of expiry — backend issues refreshed token on `GET /session/:id/status`. Client replaces silently.

**Per-event validation:** HMAC verification cached per socket connection after first successful handshake. Re-validated on reconnect only — not on every event.

**Page reload recovery:** Student rejoins via join code. Backend re-issues participant token for same `screen_name + session_id`. Offline-queued submissions flushed on reconnect.

| Event | Direction | Purpose |
| :---- | :---- | :---- |
| `session:joined` | Server → teacher | New participant joined |
| `session:left` | Server → teacher | Participant disconnect detected |
| `token:submitted` | Server → teacher + student | New submission — includes current XP |
| `saturation:signal` | Server → submitting student | Word saturated — redirect |
| `session:status` | Server → all | Phase transition |
| `qc:token` | Server → all | The AUTHORITATIVE current token for QC — includes Yahura transcription if available. Carries `seq` (added 2026-08-23): a monotonic advance counter. A client applies the event only when `seq` exceeds the last it applied, which is what makes duplicate, late, and reordered delivery safe and lets a client hold no cursor of its own. |
| `qc:audio-ready` | Server → all | Yahura transcription arrived for a token already in QC |
| `qc:vote` | Server → all | Live vote tallies after a vote lands: `{ token_id, dimension, vote_counts }`, emitted by `castVote` (`src/services/qc.ts`). **Clarified 2026-08-23:** this name exists TWICE in `src/contract.ts` — as this server→client broadcast, which is real and handled, and separately in `ClientToServerEvents` as a **reserved** client→server path with no server handler. The action itself travels over REST (`POST /token/:id/vote`), where its idempotency and authorization live; the socket carries only the resulting tallies outward. The old row read `Client → Server → all`, which described the round trip accurately but obscured that the inbound half is unhandled — hence two rows' worth of fact in one line. There is no socket path by which a student could vote twice or advance QC. |
| `qc:translation` | Server → all | `{ token_id }` after a translation lands, emitted by `submitQcTranslation`; clients re-read. Same two-events-one-name shape as `qc:vote`: the inbound `ClientToServerEvents` entry is reserved and unhandled, and the action goes over REST (`POST /token/:id/translate`). Clarified 2026-08-23. |
| `qc:correction` | Server → all | Correction submitted |
| `ceremony:star` | Server → all | Star awarded, in the SERVER's order. Carries `seq` + `total` (added 2026-08-23) — position in the run and the run length. `seq: null` marks the immediate announcement fired when a teacher assigns the Teacher's Star, which is not a step in the run; the run re-emits that star numbered. Clients dedupe by star kind and order by `seq`. **Ordering rule for the null (clarified 2026-08-23):** sort the numbered stars ascending by `seq`, then append any null-`seq` star after them — never interleave, and never coerce null to a number. Sorting a mixed set on `seq` alone is undefined, so the rule is stated rather than left to each client to guess. **When the same kind arrives twice, the numbered entry wins** (added 2026-08-24) — not last-write-wins: a reconnect replay delivering the null announcement after the numbered run star would otherwise drop that star from the numbered count, and a complete reveal is decided by comparing numbered stars to `stars_total`, so the ceremony would report itself unfinished forever. Implemented in `sparxstar-3iatlas-rlc-ui/src/hooks/useCeremony.ts`. |
| `ceremony:end` | Server → all | Session complete, and the AUTHORITATIVE end of the ceremony — a client timer may pace the reveal but may not decide it is over. Carries `stars_total` (added 2026-08-23): the number of stars in the numbered run, **excluding** any out-of-sequence announcement, so a client can tell a complete reveal from a truncated one. **How many `ceremony:star` emissions to expect (clarified 2026-08-23):** `stars_total` numbered ones, plus one extra null-`seq` announcement if a teacher assigned the Teacher's Star during the session — so the count of received events is not by itself comparable to `stars_total`. Compare only the numbered ones: a reveal is complete when the deduped numbered stars reach `stars_total`. |
| `screentime:limit-reached` | Server → student + teacher | Student's daily screen-time exhausted — graceful disconnect |

## 3.3 WebSocket Authentication

- **Teacher:** Helios JWT in socket handshake auth. Verified via JWKS endpoint. Invalid JWT closes connection immediately.
- **Student:** HMAC-signed participant token issued at `POST /api/v1/session/join`. Contains `{ session_id, participant_id, account_id, issued_at }`. Expires at session close.
- **Cached:** Verification result cached per socket connection after handshake. Re-validated on reconnect only.

## 3.4 Inbound Service Authentication

All inbound calls from Yahura MCP, Behistun MCP, and ESU MCP to the backend use HMAC-SHA256 signed request bodies with a shared secret per service. Same pattern as outbound webhooks. The backend verifies the signature before processing any inbound service call. Unsigned or incorrectly signed requests return 401 and are logged.

**Helios JWT scopes:**

| Scope | Granted to | Endpoints |
| :---- | :---- | :---- |
| `rlc:teacher` | Classroom teachers | Session create/close/approve, teacher's star, class leaderboard |
| `rlc:school_admin` | School administrators | Account create, school leaderboard, screen-time configuration |
| `rlc:adult` | Adult tier accounts | Self-managed session join (read-only otherwise) |

"School admin JWT" and "Teacher JWT" referenced elsewhere in this spec are shorthand for Helios JWTs carrying the corresponding scope claim.

**A Helios JWT is the ONLY credential that carries any scope in this table.** A
second, separate credential — the 3iAtlas Identity *suite token* — exists for
authenticated adult solo play and carries no scope at all. It is specified in
**§3.11**, and it authorizes exactly one event type and nothing else. It is
never a substitute for a Helios JWT on any endpoint above.

## 3.5 ESU Consistency Interface

RLC presents signals to Sky ESU. The algorithms that process them are ESU's responsibility and are specified in the ESU spec — not here.

| Signal | When emitted | What it carries |
| :---- | :---- | :---- |
| `token.created` | On every `POST /token/save` | text, translation, language, domain, collection_mode, session_id |
| `vote.orthography.result` | On QC orthography vote consensus | token_id, final vote counts, corrected_text if any |
| `vote.semantics.result` | On QC semantics vote consensus | token_id, final vote counts — feeds Behistun translation enrichment priority |
| `vote.audio.result` | On QC audio vote consensus | token_id, yes/no counts — feeds Yahura confidence score |
| `token.promoted` | On teacher approval | Full token envelope for DVE pipeline |

When ESU enriches a token and advances its completeness signal, ESU calls `POST /api/v1/token/:id/completeness` on the backend. The backend settles the retroactive reward and fires the myCred hook in the same handler — no cron, no eventual consistency.

**Corrected-token path:** ESU may inspect tokens with `orthography_state = 'corrected'`, recompute confidence against the dictionary using the `corrected_text` value, and (when confidence threshold met) advance the token via `POST /token/:id/completeness` to `verified`. This is the only path by which a corrected token reaches `verified` without going through teacher approval.

## 3.6 Audio Routing Signal

Starmus routes audio directly to Yahura MCP. After Yahura completes transcription, Yahura calls:

`POST /api/v1/token/:id/audio-routed`

Auth: HMAC-SHA256 signed (see §3.4)
Body: `{ yahura_transcription: string, yahura_confidence: float }`

The backend:

1. Stores `yahura_transcription` (encrypted) and `yahura_confidence` on the token
2. Sets `audio_routed_at` timestamp
3. Advances `completeness_signal` from `partial` → `complete`
4. Fires `audio.routed` myCred hook via orchestrator webhook
5. Emits `qc:audio-ready` socket event if session is in QC phase

Audio is destroyed by Yahura after this call. The backend never held it.

**Yahura backlog at QC start:** If Yahura has not returned a transcription by the time QC reaches a token, the audio vote step is skipped for that token. QC proceeds directly to orthography vote. No QC session is held waiting for Yahura. If Yahura returns later while QC is still on the same token, the backend emits `qc:audio-ready` and the UI offers a one-tap "play and vote" insertion.

## 3.7 Behistun Enrichment Signal

Behistun enriches translations asynchronously after token save. Behistun calls:

`POST /api/v1/token/:id/translation-enriched`

Auth: HMAC-SHA256 signed (see §3.4)
Body: `{ enriched_translation: string, confidence: float, target_language: string }`

The backend stores the enriched translation in `token_translations` table (one record per target language). The student's original `translation` field is never overwritten.

## 3.8 Completeness Signal — State Machine

| Signal | Transition condition |
| :---- | :---- |
| `basic` | Set at token creation in `basic` depth |
| `partial` | Set at token creation in `translation_only` or `full` depth |
| `complete` | Set when Yahura signals `audio-routed` |
| `verified` | Set when `vote_orthography.yes / total >= 0.8` AND `total >= floor(session.participant_count / 2)` |
| `promoted` | Set when teacher calls `POST /token/:id/approve`. **The gate is real; what follows it is not built** (noted 2026-08-24): the state transition and its teacher-approval requirement are implemented and enforced, so nothing auto-promotes and nothing leaks — but no code in either repository then submits the derived envelope to `sparxstar-dheghom-dve-core`. A promoted token currently goes nowhere. See `OQ-NODE-008-A` in §8. |

Transitions are monotonic — forward only. Backward transitions rejected with 409.

**Audio and semantics votes do not affect `completeness_signal`.** Only orthography drives state. Audio and semantics are recorded, exported to ESU (§3.5), and surfaced in T3, but never gate the token's state machine.

**Corrected tokens:** After `corrected_text` is submitted, the token's `orthography_state` is marked `corrected`. No re-vote. The token does not auto-advance to `verified` — it remains at `complete`. ESU may advance it later via `POST /token/:id/completeness` (see §3.5).

**Limbo tokens:** Tokens with 50–79% yes on orthography vote are neither corrected nor verified. They sit at `complete` permanently unless ESU advances them. This is intentional — the human gate (teacher approval) and ESU enrichment are the paths forward.

## 3.9 AI Facilitator — DEFERRED; the ordering invariant is implemented server-side

**Corrected 2026-08-23 to describe the implementation that exists.**

The original text specified LibreChat with a locked post-submission call
sequence: `check_saturation` → `analyze_spelling` → `save_token`, never out of
order. **No AI facilitator is implemented, and none is planned in this release.**
LibreChat is not integrated and must not be added merely to satisfy this section.

**The invariant that mattered is implemented, and better placed.** The reason for
the locked order was that saturation and spelling had to be resolved as part of
saving rather than after it. That now happens *inside* `saveToken` on the server,
in one transaction. A client cannot get the order wrong because a client is not
orchestrating it. That is a stronger guarantee than a documented call sequence,
and it is why this section is corrected rather than scheduled.

**Neither check ever rejects a submission** (§1.4, never block — always flag).
This must not be misread: the token is written, `token:submitted` is emitted, and
only *then* is `saturation:signal` sent to the submitter if the word is saturated.
Saturation is a redirect offered to the student, not a gate in front of the
insert; a saturated word is saved like any other. Spelling likewise classifies
(`confirmed` / `variant` / `discovery`) and never refuses — `discovery` is the
most valuable outcome, not a failure. Any future change that makes either check
able to reject a save would violate §1.4.

**What was removed from the UI (2026-08-23):** a panel of three "Eshu" ability
buttons — translate, pronounce, semantic hint — that returned hardcoded
placeholder strings. Presenting placeholder text as AI guidance is worse than
offering nothing, so the controls and their module are gone.

**Deferred, explicitly:** any future facilitator is new work with its own
decision record. It must not reintroduce client-orchestrated ordering around
saving, and the game must continue to work without it (which today it does, by
construction).

## 3.10 Shipped vs. Planned — Correction Notes (verification pass, 2026-07)

This subsection records doc-vs-code corrections confirmed by direct inspection
of the running source (not inferred from other documents), so this canonical
spec stops silently drifting from what actually ships. Genuinely-unbuilt
future surfaces are inventoried in full in §11 — this subsection is about
correcting how the *shipped* mechanisms actually behave.

**`/api/v1/events/batch` is not a generic event sink.** `src/services/batch.ts`
gates every incoming event through a hardcoded allowlist. **Corrected
2026-08 (GAME-SERVICE-INTAKE-SPEC-v1.0 Phase 2):** the allowlist is now
`QUEUEABLE = {token.save, token.vote, token.translate, token.correct,
game.result}` — `game.result` landed as a fifth, additive entry; the
original four are unchanged. Anything outside that set is rejected
synchronously, per event, with `failed: [{event_id, reason:
'unsupported_event_type'}]` — **but only when the event carries an
`event_id`; an event with no `event_id` is silently dropped** (reported in
neither `accepted` nor `failed`), rather than rejected — never persisted,
never dispatched to a domain service, no XP, no ledger entry, no webhook
side effect. There is no opaque-passthrough or generic-storage path
anywhere downstream. `src/contract.ts`'s `BatchEventType` union is a **compile-time-only**
mirror of this list; the `QUEUEABLE` Set in `src/services/batch.ts` is the
actual **runtime** enforcement. Both files were updated together for
`game.result`, proving the "both or neither" rule this note originally
stated as a requirement — see NODE-ADR-003's 2026-08-01 addendum (§11.4)
for the vocabulary ruling this landed against.

**XP is never generic or automatic from `event_type`.** Each queueable event
type dispatches to its own hand-written service function (`saveToken`,
`castVote`, `submitQcTranslation`, `correctToken` in
`src/services/tokens.ts`/`qc.ts`; **`settleGameResult` in the new
`src/services/gameResults.ts`, added 2026-08**), which computes its own XP —
the four RLC event types via `scoringXp()` sourced from the per-`gameType`
manifest in `src/games/manifests.ts` (PLATFORM-PLAN P2, already shipped —
see below); `game.result` via the new, separate `scoringXpForOutcome()`
(see the P2 manifest note below for why it's a different registry) — and
calls `grantXp()` with its own `reason` string, independent of the raw
client `event_type` string. A brand-new event type still needs its own new
service function; there is no default/fallback XP path.

**Webhook fan-out is a separate hardcoded union, decoupled from incoming
`event_type`.** `src/webhooks/outbound.ts` declares its own `WebhookEvent`
union (`token.submitted`, `audio.routed`, `qc.round.completed`,
`consensus.reached`, `discovery.found`, `rsc.completed`,
`settlement.retroactive`, `token.promoted`, and **`game.result.settled`,
added 2026-08**) fired explicitly via `fireWebhook(...)` calls placed inside
domain service functions. A new event namespace gets zero webhook behavior
unless new code explicitly calls `fireWebhook` with a new hardcoded kind.

**PLATFORM-PLAN P1 (Reward Ledger) and P2 (manifest/`gameType` registry) are
already implemented**, even though `docs/PLATFORM-PLAN.md`'s top banner reads
"Implementation status: Not implemented" for the plan as a whole. That banner
is accurate starting at P3 (tenant API, multi-tenant CORS, candidate-staging
generalization — see §11) but is stale for P1/P2 specifically:

- **P1 — Reward Ledger:** `reward_ledger` table (migration
  `1716000008000_reward-ledger.js`), append-only, amount-positive-constrained;
  `POST /ledger/totals` (orchestrator reconciliation pull) and
  `GET /account/:id/ledger` (participant-owned history) are live — see §6.3.
- **P2 — Manifest / `gameType` registry:** `src/games/registry.ts` +
  `src/games/manifests.ts` — services resolve scoring/star XP through a
  registered `GameManifest` keyed by `mode`, not hardcoded constants. Two
  manifests are registered this way — `rwc` and `rsc` — both under
  `game_type: 'rlc'`; that part is unchanged since the 2026-07 pass.
  **Corrected 2026-08 (GAME-SERVICE-INTAKE-SPEC-v1.0 Phase 2):** a
  `dictionary_quiz` manifest now exists, but **not** as a third `GameManifest`
  under this same `mode`-keyed registry — `Mode` (`src/types.ts`) is a closed
  `'rwc' | 'rsc'` union and widening it would ripple into RLC's session/token
  DB constraints, and `GameManifest.tunables` (saturation threshold, consensus
  ratio, QC cap) has no meaning for a quiz. Instead `src/games/registry.ts`
  now also carries a second, `game_type`-keyed map (`GameResultManifest`,
  `registerGameResultManifest`/`gameResultManifestFor`/`scoringXpForOutcome`)
  for the generic `game.result` seam — deliberately separate from, and not a
  generalization of, the `mode`-keyed `GameManifest` machinery, which is
  unchanged. `game_type: 'dictionary_quiz'` and its XP amounts are working
  defaults (see `src/games/manifests.ts`'s own comment) pending the
  dictionary repo's own naming decision and a real myCred/product
  configuration pass — not settled product numbers.

**CORS and socket.io are multi-origin as of 2026-08 (GAME-SERVICE-INTAKE-SPEC-v1.0
Phase 2) — corrects the single-origin note above.** `config.uiOrigins`
(`src/config/index.ts`) is now an allowlist: `UI_ORIGINS` (comma-separated)
is additive to the existing `UI_ORIGIN`, applied in **both** Express CORS
(`src/app.ts`) and socket.io CORS (`src/index.ts`) together, per the "both or
neither" rule this correction pass established. Single-origin deployments
that never set `UI_ORIGINS` are unaffected — `uiOrigins` degrades to a
one-element array identical to the prior `uiOrigin` string behavior. **What
this does not mean:** no operator has actually added a second origin (e.g.
dictionary-games' deployed URL) to any real deployment's `UI_ORIGINS` yet —
this is the code capability landing, not a live second consumer (see §11.2,
also corrected).

**Vote/event vocabulary reconciliation is an open question, not a decision —
except for the game-results seam, ruled 2026-08-01.** `NODE-ADR-003` records
that the engine's shipped `event_type` vocabulary is dotted, RLC-namespaced
(`token.save`, `token.vote`, …) while the cited-but-never-adopted "3iAtlas
Event Contract v0.1" proposal uses flat snake_case verbs (`word_correct`,
`word_missed`, …). The ADR defers the per-`event_type` registry that would
reconcile the two generally to "P3" — future work, not yet built. Treat the
two vocabularies as coexisting and unreconciled for that general question,
not as one having superseded the other (see §11.4). **Narrow exception:**
`NODE-ADR-003`'s 2026-08-01 addendum resolves this specifically for
game-results events (dictionary-games, WordPad, and future non-RLC
clients) — the wire type is dotted `game.result`; each client translates
its own vocabulary to that at its own boundary. See the ADR addendum for
the full ruling; this does not resolve the broader contract-vs-engine
question.

**Four additional shipped-response-shape corrections**, verified directly
against source and folded into §6.3 but not previously called out here:

- **`POST /session/:id/ceremony`** returns `{ success }` only — the awards
  data itself (`AwardsResult`) is not in this response; read it via
  `GET /session/:id/awards` or the `ceremony:*` socket events
  (`src/routes/session.ts`). A prior doc revision incorrectly stated this
  endpoint returned `AwardsResult` directly.
- **`POST /school/create`** returns `{ school_id }` only —
  `recording_enabled` is accepted in the request body but not echoed back;
  read it via `GET /school/:id` (`src/routes/leaderboard.ts`). A prior doc
  revision incorrectly stated `recording_enabled` was echoed on create.
- **`POST /admin/webhooks/replay/:event_id`** returns
  `{ success: true, delivered: boolean }`, but `delivered` is not a delivery
  confirmation — `src/routes/admin.ts` hardcodes `delivered: false` and only
  re-schedules the webhook in the background. There is no synchronous
  confirmation of receipt.
- **`POST /session/:id/qc-advance`** ignores its request body entirely — it
  always advances to the next QC token in priority order regardless of what
  is sent (`src/services/qc.ts`). A prior doc revision implied an optional
  `{ token_id? }` body had an effect on which token advances.

---

## 3.11 Adult Identity Suite Token — Release 1

> **Amendment, 2026-08-21.** Added on the written approval of Max Barrett,
> narrowly, to describe the one credential Release 1 introduces. It grants no
> new capability beyond what is stated here.

Release 1 serves **authenticated adult single-player games**. Those players
authenticate with a **suite token** issued by the 3iAtlas Identity Service
(`https://id.sparxstar.com`), not with a Helios JWT and not with a participant
token.

**What an adult Identity token may do — the whole list:**

| Allowed | Notes |
| :---- | :---- |
| Submit `game.result` events to `POST /api/v1/events/batch` | The only event type accepted on this credential. Settles account-scoped XP/reward with no session, class, or school. |
| Read its own `GET /api/v1/account/:id/xp` | Owner-scoped: the path's account must equal the token's. |
| Read its own `GET /api/v1/account/:id/ledger` | Owner-scoped, as above. |

**What it does NOT authorize, and must never be extended to authorize:**

- **Classroom** routes of any kind — session create/join/close/status, QC
  advance, teacher's star, ceremony, leaderboards.
- **Minor** tiers. The token carries a `tier` claim and only `adult` is
  accepted; a valid `lower_basic` / `upper_basic` / `senior_secondary` token is
  refused.
- **Session**-scoped anything. Solo settlement is account-scoped by
  construction; there is no session to join or resolve.
- **DVE promotion** (`POST /token/:id/approve`). Non-negotiable #10 stands
  unchanged: a token reaches `promoted` only by teacher approval under a Helios
  JWT.
- **Stored writing.** No `token.*` event is accepted on this credential, so the
  RWC/RSC collection surface is unreachable from it. Release 1 deliberately
  stores **game results, not writing**; encrypted writing collection is out of
  scope for this release (§11).

**Relationship to non-negotiable #12 (§9).** #12 is unchanged and unweakened:
teacher/admin auth is a JWKS-verified Helios JWT, scope-checked, and the
participant token remains HMAC-signed and session-scoped. This section adds a
*third* credential for a surface #12 does not describe — solo adult game
results — and the two authorities are permanently separate:

- Identity answers *who are you* and issues no scope. Helios answers *what may
  you do*.
- A suite token MUST NEVER be accepted on a path requiring a JWKS-verified
  Helios JWT (`3IATLAS-IDENTITY-AND-GAME-SERVICES-DECISION-v1.0` §2).
- The engine refuses to start if the Helios and Identity JWKS or issuers name
  the same authority, in every environment.

Wire shape is delegated to `GAME-SERVICE-INTAKE-SPEC-v1.0` §1/§3 (the
`GameResultEvent` envelope and the auth gate), per §2's one-home-per-fact rule.
The local decision record is `docs/adr/NODE-ADR-006`.

---

# 4. Collection Modes

Teacher selects one mode per session. Cannot switch mid-run.

## 4.1 Rapid Word Collection (RWC)

Elicits individual words within a semantic domain. Uses Louw-Nida-derived semantic domains (e.g. `6.2` — Agriculture).

Submission sequence — steps shown and required only for selected depth:

1. Student types the word in the target language *(all depths)*
2. Student types the translation *(full and translation_only only — hidden entirely in basic)*
3. Student records via Starmus → audio routed to Yahura → destroyed *(full only — hidden entirely in other depths)*

## 4.2 Rapid Sentence Collection (RSC)

Elicits short sentences exemplifying one of 12 grammar domain categories. Same sequence as RWC. Game sequences through all 12 domains automatically. Teacher does not select them.

**Focus word underlining:** As the student types, the grammar domain focus element is underlined in red. Implementation: per-domain heuristic, client-side only, best-effort. Gracefully degrades to no underline if the heuristic cannot identify the focus element for the current language. Never blocks submission.

**Focus word and rewards:** The backend fires a signal to myCred indicating whether the focus element was detected. myCred configuration at the school level determines whether this affects the reward. The backend does not implement the reward logic.

### The 12 Grammar Domains — Fixed Sequence

All prompts are localization keys. English values shown as reference locale only.

| # | Domain | Reference prompt (en) | Focus element |
| :---- | :---- | :---- | :---- |
| 1 | Noun Phrase | Name the person or thing doing the action | Subject noun |
| 2 | Verb Phrase | Describe what someone is doing | Main verb |
| 3 | Adjective | Describe what something looks like or feels like | Describing word |
| 4 | Adverb | Describe how someone does something | Manner word |
| 5 | Possession | Say who owns something (my, his, her, their) | Possessive word |
| 6 | Numeric | Describe how many of something there are | Number or quantity |
| 7 | Interjection | Express surprise, greeting, or emotion | Exclamation (localized per language) |
| 8 | Conjunction | Connect two thoughts with and, but, or because | Connecting word |
| 9 | Type / Classifier | Name what kind of thing this is | Classifier word |
| 10 | Question | Ask a question about something in the domain | Question word |
| 11 | Formal | Greet an elder or teacher respectfully | Respect marker |
| 12 | Informal | Greet a friend your own age | Casual marker |

## 4.3 Collection Depth

| Depth | Steps shown and required |
| :---- | :---- |
| `full` | Steps 1 + 2 + 3 |
| `translation_only` | Steps 1 + 2 |
| `basic` | Step 1 only |

Steps not required for the selected depth are hidden entirely — not shown as disabled.

---

# 5. Data Model

## 5.1 Schools Table

```sql
CREATE TABLE schools (
    school_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(256) NOT NULL,
    country         VARCHAR(64) NOT NULL,
    region          VARCHAR(128),
    total_xp        INTEGER NOT NULL DEFAULT 0,
    total_gold      INTEGER NOT NULL DEFAULT 0,
    created_at      BIGINT NOT NULL
);
CREATE INDEX idx_schools_country ON schools (country);
```

## 5.2 Classes Table

```sql
CREATE TABLE classes (
    class_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id       UUID NOT NULL REFERENCES schools(school_id),
    name            VARCHAR(128) NOT NULL,
    tier            VARCHAR(20) NOT NULL
                      CHECK (tier IN ('lower_basic','upper_basic','senior_secondary','adult')),
    teacher_id      UUID,
    total_xp        INTEGER NOT NULL DEFAULT 0,
    total_gold      INTEGER NOT NULL DEFAULT 0,
    created_at      BIGINT NOT NULL
);
CREATE INDEX idx_classes_school_id ON classes (school_id);
```

## 5.3 Accounts Table

```sql
CREATE TABLE accounts (
    account_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id       UUID REFERENCES schools(school_id), -- NULL for adult accounts not affiliated with a school
    class_id        UUID REFERENCES classes(class_id),
    screen_name     VARCHAR(64) NOT NULL,
    tier            VARCHAR(20) NOT NULL
                      CHECK (tier IN ('lower_basic','upper_basic','senior_secondary','adult')),
    pin_hash        VARCHAR(256),        -- Upper Basic only — Argon2id
    password_hash   VARCHAR(256),        -- Senior Secondary and Adult — Argon2id
    failed_logins   SMALLINT NOT NULL DEFAULT 0,
    locked_until    BIGINT,              -- Unix timestamp; NULL when not locked
    reset_email     VARCHAR(256),        -- Adult tier only — optional, the single optional PII field
    encryption_key_ref VARCHAR(256),     -- Reference to per-account DEK in KMS
    lifetime_xp     INTEGER NOT NULL DEFAULT 0,
    lifetime_gold   INTEGER NOT NULL DEFAULT 0,
    created_at      BIGINT NOT NULL,
    UNIQUE (school_id, screen_name)
);
CREATE INDEX idx_accounts_school_id ON accounts (school_id);
CREATE INDEX idx_accounts_class_id  ON accounts (class_id);

-- Adult tier global screen-name uniqueness (school_id IS NULL):
CREATE UNIQUE INDEX idx_accounts_adult_screen_name
    ON accounts (screen_name)
    WHERE school_id IS NULL;
```

No PII. No real name. No email (except optional `reset_email` on Adult accounts — declared and documented). Screen name only. School holds the real-world identity mapping. AIWA never does.

**Account creation:** School admin pre-registers students. Admin creates the class, assigns screen names and initial credentials (PIN for Upper Basic, password for Senior Secondary). Lower Basic accounts are class-level — no individual login. Students do not self-register. Adult accounts may self-register via a separate `POST /api/v1/account/adult-register` endpoint (rate-limited, captcha-gated).

**Screen name uniqueness:** Unique per school. Two students at different schools may share a screen name. Within a school, "The Hulk 2" is auto-generated if "The Hulk" is taken. Adult accounts (no school) have a separate global namespace enforced by partial unique index.

**Cascade delete:** `ON DELETE CASCADE` on all foreign keys from accounts → tokens ensures Article 17 (right to erasure) is implementable cleanly. Erasure also issues a KMS key-destroy on the account's DEK, rendering all encrypted ciphertext mathematically unrecoverable.

## 5.4 Sessions Table

```sql
CREATE TABLE sessions (
    session_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    join_code           CHAR(6) NOT NULL UNIQUE,
    school_id           UUID NOT NULL REFERENCES schools(school_id),
    class_id            UUID REFERENCES classes(class_id),
    teacher_id          UUID REFERENCES accounts(account_id),
    mode                VARCHAR(3) NOT NULL CHECK (mode IN ('rwc','rsc')),
    language            VARCHAR(32) NOT NULL,
    locale              VARCHAR(16) NOT NULL,
    semantic_domain_id  VARCHAR(16),
    duration_minutes    INTEGER NOT NULL DEFAULT 15,
    collection_depth    VARCHAR(20) NOT NULL DEFAULT 'full'
                          CHECK (collection_depth IN ('full','translation_only','basic')),
    status              VARCHAR(16) NOT NULL DEFAULT 'open'
                          CHECK (status IN ('open','qc','ceremony','closed','archived')),
    class_xp_total      INTEGER NOT NULL DEFAULT 0,
    started_at          BIGINT NOT NULL,
    ended_at            BIGINT,
    join_code_expires_at BIGINT NOT NULL, -- bounds Lower Basic roster exposure
    participants        JSONB NOT NULL DEFAULT '{}',
    rights              JSONB NOT NULL
);
CREATE INDEX idx_sessions_join_code ON sessions (join_code);
CREATE INDEX idx_sessions_class_id  ON sessions (class_id);
CREATE INDEX idx_sessions_status    ON sessions (status);
```

## 5.5 Tokens Table

```sql
CREATE TABLE tokens (
    token_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id            UUID NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
    account_id            UUID NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
    participant_id        VARCHAR(128) NOT NULL,
    -- participant_id: session-scoped opaque identifier issued at join
    -- account_id: persistent identity FK — these are intentionally different
    collection_mode       VARCHAR(3) NOT NULL CHECK (collection_mode IN ('rwc','rsc')),
    text                  TEXT NOT NULL, -- encrypted at rest
    translation           TEXT NOT NULL DEFAULT '', -- encrypted at rest
    enriched_translation  TEXT, -- legacy single-language slot — see token_translations for multi-language
    yahura_transcription  TEXT, -- encrypted at rest — returned by Yahura, never the source audio
    yahura_confidence     NUMERIC(4,3),
    grammar_domain        VARCHAR(64) NOT NULL DEFAULT '',
    grammar_domain_index  INTEGER,
    spelling_signal       VARCHAR(16) CHECK (spelling_signal IN ('confirmed','variant','discovery')),
    spelling_score        NUMERIC(5,2),
    completeness_signal   VARCHAR(16) NOT NULL DEFAULT 'basic'
                            CHECK (completeness_signal IN ('basic','partial','complete','verified','promoted')),
    orthography_state     VARCHAR(16) NOT NULL DEFAULT 'pending'
                            CHECK (orthography_state IN ('pending','passed','failed','corrected')),
    xp_paid               INTEGER NOT NULL DEFAULT 0,
    audio_routed_at       BIGINT,
    approved_by_teacher   BOOLEAN NOT NULL DEFAULT FALSE,
    approved_at           BIGINT,
    focus_detected        BOOLEAN, -- RSC only — NULL = heuristic did not run (RWC) or returned inconclusive;
                                   -- TRUE = focus element detected; FALSE = heuristic ran, no match
    vote_orthography      JSONB NOT NULL DEFAULT '{"yes":0,"no":0,"voters":[]}',
    vote_semantics        JSONB NOT NULL DEFAULT '{"yes":0,"no":0,"voters":[]}',
    vote_audio            JSONB NOT NULL DEFAULT '{"yes":0,"no":0,"voters":[]}',
    qc_translations       JSONB NOT NULL DEFAULT '[]',
    corrected_text        TEXT, -- encrypted at rest — never overwrites text field
    rights                JSONB NOT NULL,
    created_at            BIGINT NOT NULL
);
CREATE INDEX idx_tokens_session_id      ON tokens (session_id);
CREATE INDEX idx_tokens_account_id      ON tokens (account_id);
CREATE INDEX idx_tokens_completeness    ON tokens (completeness_signal);
CREATE INDEX idx_tokens_spelling_signal ON tokens (spelling_signal);
CREATE INDEX idx_tokens_orthography     ON tokens (orthography_state) WHERE orthography_state = 'corrected';
```

**`text` is immutable after creation. No UPDATE on this column. Ever.**
**`corrected_text` is the only correction mechanism. No new token is created for a correction.**
**`xp_paid` tracks cumulative XP settled — prevents double-payment on retroactive settlement.**

**Concurrency note:** `vote_orthography`, `vote_semantics`, `vote_audio` JSONB columns face concurrent write amplification during QC (30 students × 10 tokens × 3 dimensions). Builder may implement a `token_votes` staging table with INSERT and aggregate on read. Schema above is logical — physical implementation is builder's decision.

## 5.6 Token Translations Table

```sql
CREATE TABLE token_translations (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token_id            UUID NOT NULL REFERENCES tokens(token_id) ON DELETE CASCADE,
    target_language     VARCHAR(16) NOT NULL,
    enriched_translation TEXT NOT NULL, -- encrypted at rest
    confidence          NUMERIC(4,3),
    created_at          BIGINT NOT NULL,
    UNIQUE (token_id, target_language)
);
CREATE INDEX idx_token_translations_token_id ON token_translations (token_id);
```

## 5.7 Vote Dimensions — Locked

| Dimension | API string | UI label (localized) | Question (localized) |
| :---- | :---- | :---- | :---- |
| Orthography | `orthography` | Spelling | Is this word spelled correctly? |
| Semantics | `semantics` | Meaning | Does this make sense? Is the grammar correct? |
| Audio | `audio` | Pronunciation | Can you hear the word said properly? |

API and database always use `orthography`, `semantics`, `audio`. UI labels and questions are localization keys — never hardcoded English.

**Majority threshold:** `no > yes` triggers correction. Ties do not.
**Consensus threshold:** `yes / (yes + no) >= 0.8` AND `(yes + no) >= floor(participant_count / 2)`.

**QC vote sequence per token:**

1. Audio vote (skipped if `audio_routed_at` is NULL — proceed directly to step 2)
2. Orthography vote
3. Semantics vote
4. Correction — shown to submitter only if `vote_orthography.no > vote_orthography.yes`
5. Translation — all participants submit

**Orthography vote drives correction.** Semantics and audio votes are system-critical signals (feeding Behistun and Yahura respectively) but do not drive in-session correction for this release.

**Submitter anonymization in QC:** Tokens displayed in QC do not show the submitter's screen name. Submitter identity is revealed only during ceremony (when star awards are announced) or when the submitter is prompted to correct their own token. This protects vote integrity from peer pressure / favoritism.

**`POST /token/:id/vote` returns:** `{ success, vote_counts, has_voted }`. `has_voted` is meaningful on the 200 path only — duplicate votes return 409.

## 5.8 Token Submission State Machine

| State | Condition |
| :---- | :---- |
| `IDLE` | Not started |
| `TYPED` | Text non-empty and confirmed |
| `TRANSLATED` | Translation non-empty — `full` and `translation_only` only |
| `RECORDED` | `starmus:complete` DOM event fired — `full` only |
| `SAVED` | `POST /api/v1/token/save` returns success |

---

# 6. Backend — `sparxstar-3iatlas-rlc-node-engine`

## 6.1 Stack

| Component | Technology |
| :---- | :---- |
| Runtime | Node.js |
| Framework | Express |
| Database | PostgreSQL |
| Real-time | socket.io |
| Teacher auth | Helios JWT via JWKS endpoint, scope-checked |
| Student auth | HMAC-signed participant token — account_id embedded |
| Inbound service auth | HMAC-SHA256 signed body, shared secret per service |
| Encryption | AES-256-GCM, per-account DEK wrapped by per-school KEK in external KMS |
| Spelling | In-memory trigram index per language, loaded at session start |
| CORS | Allow an origin allowlist (`UI_ORIGIN` + optional comma-separated `UI_ORIGINS`) + `Authorization` header. Multi-origin as of 2026-08 (§3.10) — onboarding a second consumer is now a config edit (`UI_ORIGINS`), not a code change. |
| Rate limiting | Per-IP + per-account, token-bucket on join, vote, save, batch flush |

## 6.2 Repository Structure

```
src/
  routes/         Express route handlers
  services/       Session, token, qc, awards, spelling, quality, leaderboard, encryption, screentime
  models/         PostgreSQL query layer
  sockets/        socket.io handlers and auth middleware
  middleware/     Auth, validation, error handling, rate limiting, CORS
  webhooks/       Outbound HMAC-signed webhook firing to orchestrator (retry + DLQ)
  games/          gameType manifest registry (registry.ts, manifests.ts, types.ts) —
                  scoring/star XP resolved per-manifest instead of hardcoded constants;
                  `rwc`/`rsc` under game_type 'rlc' (mode-keyed) plus `dictionary_quiz`
                  under a separate game_type-keyed registry as of 2026-08 (§3.10, §11.3)
  i18n/           Localization strings per supported language
data/
  dictionary/     Language JSON files — read-only at runtime
  domains/        Semantic and grammar domain lists — static files
migrations/       PostgreSQL DDL — versioned, sequential
```

## 6.3 REST API

Base path: `/api/v1/`

> **§6.3 completeness note (verification pass, 2026-07):** the tables below
> were expanded against the current route files (`src/routes/*.ts`) to include
> endpoints that shipped after this section was last written but were never
> back-filled here. `docs/API.md` is generated from the same routes and is
> kept in sync with the code on every change — treat it as the detailed
> operational reference; this section is the authoritative-intent summary and
> the two must not diverge on endpoint existence.

### School & Class Endpoints

| Method | Path | Auth | Description |
| :---- | :---- | :---- | :---- |
| POST | `/school/create` | `rlc:school_admin` | Body: `{ name, country, region?, recording_enabled? }` (defaults `false`). Returns: `{ school_id }`. |
| GET | `/school/:id` | `rlc:school_admin` \| `rlc:teacher` | Returns: `{ school_id, name, country, region, recording_enabled, total_xp, total_gold }`. |
| POST | `/school/:id/recording` | `rlc:school_admin` | Body: `{ enabled }`. Audio-recording consent opt-in toggle gating `full`-depth sessions (see the recording-consent gate note below the Session Endpoints table). Returns: `{ school_id, recording_enabled }`. |
| POST | `/class/create` | `rlc:school_admin` | Body: `{ school_id, name, tier, teacher_id? }`. Returns: `{ class_id }`. |
| GET | `/class/:id` | `rlc:teacher` | Returns: `{ class_id, school_id, name, tier, teacher_id, total_xp, total_gold, recording_enabled }` (`recording_enabled` inherited from the school, included for UI convenience). |

### Account & Leaderboard Endpoints

| Method | Path | Auth | Description |
| :---- | :---- | :---- | :---- |
| POST | `/account/create` | `rlc:school_admin` | Body: `{ school_id, class_id, screen_name, tier, pin? }`. Returns: `{ account_id }`. School pre-registers students. |
| POST | `/account/adult-register` | None (captcha + rate-limited) | Body: `{ screen_name, password, reset_email? }`. Adult self-registration. |
| POST | `/account/:id/unlock` | `rlc:teacher` | Clears `failed_logins` and `locked_until`. Teacher PIN/password reset path. |
| GET | `/account/:id/xp` | Account token | Lifetime XP, gold, achievements |
| GET | `/class/:id/leaderboard` | `rlc:teacher` | Class XP totals, student rankings |
| GET | `/school/:id/leaderboard` | `rlc:school_admin` | School XP totals, class rankings |
| GET | `/leaderboard/national?country=GM` | None | National school rankings. `country` defaults to the requesting school's country if a school is identifiable from origin; otherwise required. |

### Session Endpoints

| Method | Path | Auth | Description |
| :---- | :---- | :---- | :---- |
| POST | `/session/create` | `rlc:teacher` | Body: `{ mode, language, locale, semantic_domain_id, duration_minutes, collection_depth, class_id, rights }`. Returns: `{ session_id, join_code, qr_code_url }`. |
| POST | `/session/join` | None | **Lower Basic:** body `{ join_code }` only — student selects screen name from session list on device, no credential. **Upper Basic:** `{ join_code, screen_name, pin }`. **Senior Secondary / Adult:** `{ join_code, screen_name, password }`. School ID is injected by host page — never in the request body. Returns: `{ session_id, participant_id, participant_token, account_id, language, locale, mode, collection_depth, session_screen_names? }`. Failure responses listed below. |
| GET | `/session/:id/status` | None | Returns: `{ status, participant_count, token_count, time_remaining_seconds, leaderboard[], class_xp_total, participant_token? }`. |
| POST | `/session/:id/close` | `rlc:teacher` | End collection. Trigger QC selection. Emit `session:status`. |
| GET | `/session/:id/qc-words` | session reader | Returns ordered `QcToken[]` — 5–10 by priority algorithm. Submitter identity stripped. **Auth changed 2026-08-23 from None:** this returns decrypted writing, so it now requires a participant of this session or a teacher/admin authorized for its school. |
| GET | `/session/:id/qc-state` | session reader | **Added 2026-08-23.** The authoritative current QC position: `{ seq, token, exhausted }`. The hydration and reconnection read — a client calls it on mount, on reconnect, and after a reload, and lands where the class is. It advances nothing; only `qc-advance` moves anyone. Submitter identity stripped. |
| POST | `/session/:id/qc-advance` | `rlc:teacher` | Teacher's T3 "Advance" control. **No request body is read** — the route ignores whatever is sent and always advances to the next QC token in priority order (`src/services/qc.ts`, `src/routes/session.ts`); there is no way to target a specific `token_id`. Returns: `{ success: true, token_id, seq }` (next QC token, and the sequence its broadcast carried). Sets `teacher_advanced_qc = true` on the first call that **actually advances** (drives the Teacher Award, §6.5) — corrected 2026-08-23: it previously flipped on any call, so one click against an exhausted queue earned the award without the teacher having driven QC. A 409 (`qc_exhausted` or `qc_advance_conflict`) credits nothing. Emits `qc:token`. 409 `qc_exhausted` when nothing remains to advance. |
| GET | `/session/:id/awards` | session reader | Returns: `{ stars[], leaderboard[], total_tokens, discovery_count }`. **Auth changed 2026-08-23 from None:** returns participant screen names. |
| POST | `/session/:id/teachers-star` | `rlc:teacher` | Body: `{ participant_id }`. One per session — 409 if already assigned. |
| POST | `/session/:id/ceremony` | `rlc:teacher` | Sequences `qc → ceremony → closed`. Emits each `ceremony:star` then `ceremony:end`. Returns: `{ success }`. |

**Recording-consent gate (`POST /session/create`):** when `collection_depth =
'full'`, the request returns **422 `recording_not_permitted`** unless *both*
the school has opted in (`schools.recording_enabled = true`, toggled via
`POST /school/:id/recording`) *and* the class tier is not `lower_basic`.
Non-`full` depths are never gated. Audio still never touches the backend
either way — this gate only controls whether the *recording step* is offered
at all, per §1.2/§1.5/§3.6.

**`POST /session/join` failure responses:**

| Code | Meaning | Body |
| :---- | :---- | :---- |
| 403 | Screen name not registered for this school | `{ error: "unknown_screen_name", localized_message }` |
| 401 | Wrong PIN or password | `{ error: "credential_invalid", remaining_attempts }` |
| 423 | Account locked (3 failed attempts) | `{ error: "account_locked", unlock_path }` |
| 410 | Join code expired or session closed | `{ error: "session_unavailable" }` |
| 429 | Rate limit exceeded | `{ error: "rate_limited", retry_after_seconds }` |
| 451 | Screen-time limit exceeded for the day (myCred ledger) | `{ error: "screen_time_exceeded", reset_at }` |

**Lower Basic roster exposure:** Join codes are session-scoped and short-lived (`join_code_expires_at` on the sessions table). If a code leaks beyond the classroom, the roster of screen names is exposed only for the remaining session duration. This is the bounded acceptable cost of the no-credential LB UX. The roster contains screen names only — no PII.

### Token Endpoints

| Method | Path | Auth | Description |
| :---- | :---- | :---- | :---- |
| POST | `/token/save` | Participant token | Body: `{ session_id, participant_id, text, translation, collection_mode, grammar_domain?, focus_detected?, rights }`. Returns: `{ token_id, spelling_signal, saturation_signal, spelling_score, completeness_signal, xp_awarded, account_lifetime_xp }`. |
| POST | `/token/:id/vote` | Participant token | Body: `{ dimension, vote_yes, participant_id }`. Returns: `{ success, vote_counts, has_voted }`. Duplicate votes 409. |
| POST | `/token/:id/translate` | Participant token | Body: `{ translation, participant_id }`. |
| POST | `/token/:id/correct` | Submitter only | Body: `{ corrected_text, participant_id }`. Writes encrypted `corrected_text`. Sets `orthography_state = corrected`. Never modifies `text`. 403 if not original submitter. |
| POST | `/token/:id/approve` | `rlc:teacher` | Teacher approval for DVE promotion. Sets `approved_by_teacher = true`, `approved_at`, advances to `promoted`. |
| POST | `/token/:id/audio-routed` | Yahura MCP (HMAC) | Body: `{ yahura_transcription, yahura_confidence }`. Advances completeness. Fires myCred hook. |
| POST | `/token/:id/translation-enriched` | Behistun MCP (HMAC) | Body: `{ enriched_translation, confidence, target_language }`. Writes to `token_translations`. |
| POST | `/token/:id/completeness` | ESU MCP (HMAC) | Body: `{ completeness_signal }`. Monotonic only — 409 if backward. Triggers retroactive settlement in same handler. |

### System Endpoints

| Method | Path | Auth | Description |
| :---- | :---- | :---- | :---- |
| POST | `/events/batch` | Participant token | Offline queue flush. **Allowlist-gated, not a generic sink** (§3.10): `token.save`, `token.vote`, `token.translate`, `token.correct`, `game.result` (added 2026-08, GAME-SERVICE-INTAKE-SPEC-v1.0) are queueable (`QUEUEABLE` in `src/services/batch.ts`); any other `event_type` is rejected per-event with `failed: [{event_id, reason: 'unsupported_event_type'}]` **only if the event has an `event_id`** — an event with no `event_id` is silently dropped instead (counted in neither `accepted` nor `failed`) — and has no other effect. Body: `{ events: [{ event_id, event_type, payload }] }`. Returns: `{ accepted: <integer count of successfully-applied events>, failed: Array<{ event_id: string, reason: string }> }` — `accepted` is a count, not a list of ids. Duplicate `event_id` silently skipped (persisted idempotency via `processed_events`, not in-memory only). Max 200 events/batch. |
| POST | `/screentime/limit-reached` | Orchestrator (HMAC) | Body: `{ account_id, reset_at? }`. myCred-triggered mid-session signal. Gracefully winds the flagged student down (further saves refused with 451; class session stays open) and emits `screentime:limit-reached` to student + teacher. |
| GET | `/account/:id/ledger?limit=N` | Participant (owner) | Returns: `{ account_id, totals: { xp, gold, entry_count, last_entry_at }, entries: [...] }`. Newest-first reward-ledger entries (PLATFORM-PLAN P1, §3.10) from the append-only `reward_ledger` table. `limit` default 50, max 200. |
| POST | `/ledger/totals` | Orchestrator (HMAC) | Body: `{ account_id }`. Returns: `{ account_id, xp, gold, entry_count, last_entry_at }`. Reconciliation pull of authoritative earned totals — read-only; the engine never learns about spending (§6.6). |
| POST | `/admin/webhooks/replay/:event_id` | `rlc:school_admin` | Replays a dead-lettered webhook (§6.6). Returns: `{ success, delivered }`. 404 `dead_letter_not_found` if the event isn't dead-lettered. |

### Signal Values

| Signal | Values |
| :---- | :---- |
| `spelling_signal` | `confirmed` \| `variant` \| `discovery` |
| `saturation_signal` | `continue` \| `saturated` (threshold: 15 identical per session) |
| `completeness_signal` | `basic` \| `partial` \| `complete` \| `verified` \| `promoted` |

## 6.4 QC Word Selection — Strict Priority

Exhaust bucket 1 before taking from bucket 2. Hard cap: 10 tokens maximum.

| Priority | Criterion |
| :---- | :---- |
| 1 | `spelling_signal = 'discovery'` — not in dictionary |
| 2 | In dictionary but `translation` is empty |
| 3 | `spelling_score < 50` |
| 4 | Submitted by exactly 1 distinct participant |
| 5 | Submitted by 5 or more distinct participants |
| Default | Tokens with 2–4 distinct participants not selected unless cap not reached |

## 6.5 Awards

| Star | Criterion |
| :---- | :---- |
| 🥇 Most Words / Sentences | Highest `SAVED` token count. Tie: shared award. |
| 🎯 Best Spelling | Highest ratio `vote_orthography.yes / total`. Tie: shared. |
| 🔍 Discovery Star | Most `spelling_signal = 'discovery'` tokens. Tie: shared. |
| ⚡ Speed Star | Lowest mean time `TYPED` → `SAVED`. Tie: shared. |
| 🎙️ Audio Star | Most `audio_routed_at IS NOT NULL` tokens — counts routed outcomes, not attempts. Tie: shared. |
| ⭐ Teacher's Star | Teacher-assigned. One per session. |
| 🏫 Teacher Award | Auto-issued to teacher for QC participation. **Correction (verification pass, 2026-07):** the shipped rule (`src/services/awards.ts`, `teacher_advanced_qc` flag) awards this when the teacher has called `POST /session/:id/qc-advance` at least once — a real teacher QC-driving action — not when the teacher has cast a vote. |

**XP stacking:** Discovery + Consensus bonuses both apply to the same token. Not mutually exclusive.

**Vote XP balance:** +5 XP per QC round, not per dimension. One round = one token reviewed regardless of how many dimensions voted. This keeps collection XP higher than QC voting XP.

### XP — myCred Hooks

Backend fires hooks to myCred via orchestrator. myCred handles all reward logic.

**Correction (verification pass, 2026-07):** this table is the RLC `gameType`'s
scoring, sourced today from the registered manifest
(`src/games/manifests.ts` → `SCORING_XP`/`STAR_XP`, PLATFORM-PLAN P2 — see
§3.10), not a generic event-type-keyed lookup. Each row below corresponds to a
specific hand-written service call (`saveToken`, `castVote`,
`submitQcTranslation`, `correctToken`, or the completeness-settlement path) —
there is no path by which an arbitrary `event_type` earns XP; see §3.10 for
why this rules out treating `/events/batch` as extensible without new code.
The engine also now writes these amounts to the append-only `reward_ledger`
(PLATFORM-PLAN P1, shipped — §6.3) in addition to firing the myCred webhook
below; the two are not in tension — the ledger is the engine's own system of
record, myCred remains the one-way wallet mirror.

| Event | XP hook | Accumulates at |
| :---- | :---- | :---- |
| Token submitted | +10 XP | Student, Class, School |
| Translation submitted in collection | +15 XP | Student, Class, School |
| Audio routed to Yahura | +20 XP | Student, Class, School |
| QC round completed (per token reviewed) | +5 XP | Student, Class, School |
| Translation submitted in QC | +10 XP | Student, Class, School |
| Token reaches consensus | +50 XP + **1 Gold** | Student, Class, School |
| Discovery — new word | +100 XP + **1 Gold** | Student, Class, School |
| RSC — all 12 domains complete | +200 XP + **1 Gold** | Student, Class, School |
| Retroactive settlement | Delta XP | Student, Class, School |

> **Gold is a currency, not a badge (corrected 2026-09).** These three rows read
> "Gold badge" until this pass, which is why §1.6 could say badges are undefined
> while this table appeared to award one — the contradiction was the word, not
> the model. What the engine grants is one unit of **Gold**:
> `grantXp(ctx, xp, 1, tx)` in `rlc-node-engine` `src/services/qc.ts`
> (`settleConsensus`) and `src/services/tokens.ts` (discovery, RSC completion),
> which raises `lifetime_gold` and writes a `kind: 'gold'` row to
> `reward_ledger`. `'badge'` is a *reserved* `LedgerKind` in `src/contract.ts`
> with no writer anywhere in that repo — which is exactly what §1.6 means.
> The two statements are consistent once the word is right: **Gold ships,
> badges do not.**
>
> **For UI purposes, Gold is earn-only and has no spend path.** Earning is
> implemented; ownership, redemption and whether a balance is ever shown to a
> learner are not decided. Do not build a wallet, a shop, or a spendable
> balance against this: showing a total a player can never use is a promise the
> platform cannot keep today. Render Gold only as settled by the engine, per
> the never-invent-an-award rule in §1.6.

## 6.6 Backend → Orchestrator Webhooks

HMAC-SHA256 signed. `event_id` on every webhook for idempotency. Orchestrator verifies signature and deduplicates on `event_id`.

**This table is a hardcoded union, not derived from `event_type` (§3.10).**
`src/webhooks/outbound.ts` declares its own `WebhookEvent` type covering
exactly these nine kinds, fired explicitly by `fireWebhook(...)` calls placed
inside the domain service functions listed above — never generically from the
incoming client `event_type`. A new webhook kind requires adding both a new
`WebhookEvent` union member and an explicit `fireWebhook` call at its call
site; there is no dispatch-by-`event_type` mechanism to extend.

| Webhook | Orchestrator action |
| :---- | :---- |
| `token.submitted` | Fire myCred hook → +10 XP |
| `audio.routed` | Fire myCred hook → +20 XP |
| `qc.round.completed` | Fire myCred hook → +5 XP |
| `consensus.reached` | Fire myCred hook → +50 XP + **1 Gold** |
| `discovery.found` | Fire myCred hook → +100 XP + **1 Gold** |
| `rsc.completed` | Fire myCred hook → +200 XP + **1 Gold** |
| `settlement.retroactive` | Fire myCred hook → delta XP |
| `token.promoted` | Submit derived token to DVE via SPARXSTAR internal HTTP API with Helios Bearer auth |
| `game.result.settled` | Fire myCred hook → XP per the settling `game_type`'s manifest (added 2026-08, GAME-SERVICE-INTAKE-SPEC-v1.0) |

**Retry policy:** Each outbound webhook makes an initial delivery attempt, then retries with exponential backoff at 2s, 4s, 8s, 16s, 32s, 64s (7 attempts total — 1 initial + 6 backoff retries, ~2-minute total window; `src/webhooks/outbound.ts` records `attempts = BACKOFF_MS.length + 1` on dead-letter). After exhaustion, the webhook is recorded in a `webhook_dead_letter` table with full payload, attempt history, and last error. Manual replay endpoint: `POST /api/v1/admin/webhooks/replay/:event_id` (admin auth). myCred outages are non-fatal — game continues; rewards settle on retry.

---

# 7. Frontend — `sparxstar-3iatlas-rlc-ui`

## 7.1 Stack

| Component | Technology |
| :---- | :---- |
| Framework | React 19 + TypeScript |
| Build | Vite |
| Localization | i18next — all student-facing strings are localization keys |
| Real-time | socket.io-client |
| Offline queue | IndexedDB → flushes to `POST /api/v1/events/batch` on reconnect |

## 7.2 What the Frontend Does Not Do

- Never calls WordPress directly
- Never calculates XP — XP comes from backend on `token:submitted` socket event and `token/save` response
- Never references audio files — audio is destroyed, not stored
- Never stores plaintext writing — all display is from encrypted-at-rest fields decrypted by backend before transmission over TLS

## 7.3 Teacher Screens

| Screen | Description |
| :---- | :---- |
| T1 — Session Setup | Mode, language, locale, domain, duration, depth. Rights confirmation — teacher confirms each field, no forced defaults. Calls `POST /api/v1/session/create`. |
| T2 — Live Monitor | Join code + QR. Participant count. Rolling submission feed. Live leaderboard. Class XP total. **Lower Basic sessions:** roster claim panel showing which screen names are claimed and which remain free. **All tiers:** last-active indicator per participant (defined as `MAX(last_socket_heartbeat, last_submission_at)` — never includes keystroke or productivity data). Locked-account list with one-tap unlock. End session button. Socket-driven. |
| T3 — QC Review | One token at a time. Yahura transcription displayed as reference. Audio vote live counts. Orthography vote live counts. Semantics vote live counts. Translation feed. Submitter identity hidden from teacher during voting (revealed at ceremony only). Advance button. |
| T4 — Teacher's Star | Participant list with session XP. One tap. Calls `POST /api/v1/session/:id/teachers-star`. Disabled after assignment. |
| T5 — Ceremony | Same as student ceremony screen. |

## 7.4 Student Screens

| Screen | Description |
| :---- | :---- |
| S1 — Join | Large 6-character code entry, auto-uppercase. **Lower Basic:** after code entry, student sees a list of class screen names scoped to the session — tap your name, you are in. No credential. No typing. Teacher sees who claimed which name on T2 monitor. **Upper Basic:** code + screen name + 4-digit PIN. PIN entry uses `inputmode="numeric"`, masked digits, auto-advance on 4th digit. PIN failure: 3 attempts then locked — teacher unlocks via T2 monitor. **Senior Secondary / Adult:** code + screen name + password. Password field uses standard `type="password"` with show/hide toggle, 12-char minimum enforced client-side and server-side. School ID injected by orchestrator host page — never entered by student. Stores `participant_token` in memory only — never persisted. |
| S2 — RWC Collection | Steps shown only for selected depth. (1) Word entry + AccessoryBar; (2) Translation — hidden in `basic`; (3) Starmus recorder — hidden in `basic` and `translation_only`. XP counter in header — updated from server response and `token:submitted` socket event. Submit active only when required steps complete. |
| S3 — RSC Collection | Same as S2. Grammar domain context card above input — localized prompt. Focus element underlined red as student types — visual only, best-effort heuristic, never blocks submission. Progress: localized "7 of 12". Domain tiles: grey / green / highlighted. |
| S4–S7 — QC | Single screen walking through states via socket. State sequence: Audio Vote (skipped if no audio) → Spelling Vote → Semantics Vote → Correction (submitter only if spelling majority No) → Translation. All participants progress simultaneously. Yahura transcription shown as reference during Audio Vote. Submitter identity is never shown in the QC card — only the submitted text. |
| S8 — Ceremony | Star announcements sequenced with animation — localized star names. Final leaderboard with lifetime XP. School standing shown. Fireworks. |

## 7.5 AccessoryBar — Special Characters

Required on all collection screens. Non-negotiable.

- Minimum 44px touch targets
- Visible without scrolling at 360px
- Inserts at cursor position — never replaces selected text
- Multi-character inserts (`aa`, `ee`, `ii`, `oo`, `uu`) advance cursor by 2 — must bypass IME autocorrect to prevent interference
- Characters: `ŋ` `ɓ` `ɗ` `ñ` `ɲ` `ʔ`, plus the long vowels `aa` `ee` `ii` `oo` `uu`

**`ʔ` (U+0294, glottal stop) is intentionally supported** (amended 2026-08-23).
It was absent from this list and present in the implementation; the
implementation is right. The glottal stop is a phoneme in the target languages,
and a student who cannot type it will simply drop it — the same failure this bar
exists to prevent for `ŋ`. Asserted in
`sparxstar-3iatlas-rlc-ui/src/types/rsc.preservation.test.ts` — the repo is named
because this spec is carried in both and there is no such test in the engine, so
the list and the bar cannot drift apart again *and* a reader is not sent looking
for a file that was never here.

`ŋ` is the highest-priority character. If not trivially accessible, students type `n` and never learn the difference. Linguistic sovereignty — not optional.

## 7.6 Starmus Integration

1. Mount Starmus widget in recording panel — shown only in `full` depth
2. Listen: `window.addEventListener('starmus:complete', handler)`
3. On event: advance state machine to `RECORDED`, enable Save
4. Never reference audio in any API call

## 7.7 Offline Resilience

All four action types are queueable in IndexedDB: token save, vote, translation, correction. On reconnect, flushed sequentially to `POST /api/v1/events/batch`. Each event carries unique `event_id` — server skips duplicates. A student who drops during QC does not lose their vote or translation.

---

# 8. Orchestrator — SUPERSEDED (no WordPress orchestrator exists or will)

> **Superseded 2026-08-23 by owner architectural ruling.** This section described
> a WordPress PHP orchestrator owning myCred hooks, the DVE promotion pipeline,
> and a page mount that injected `window.RLC_API_BASE`,
> `window.RLC_TEACHER_TOKEN`, and `window.RLC_SCHOOL_ID` into the UI at runtime.
>
> **That component does not exist and is not to be created.** RLC is entirely
> Node.js. Nothing in this section is a dependency waiting to be built, and no
> requirement stated below binds any current repository. It is kept, unedited
> below the line, only as the record of what was superseded — read it as history.
>
> What replaced each part:
>
> | Was the orchestrator's | Now |
> | :--- | :--- |
> | Injecting a standing teacher token into a page | **Gone.** Authentication is an Identity Service token; authorization is `rlc_authorizations` rows in the engine (NODE-ADR-007). A reusable teacher token in page configuration is explicitly forbidden. |
> | Injecting school/class/session context | The engine resolves school scope from the authenticated principal's grant. The browser does not supply it. |
> | Owning the session workflow | The engine owns it, teacher-driven and server-authoritative (NODE-ADR-008). |
> | myCred hooks and reward settlement | Still a **separate integration**, not yet built, and not a WordPress plugin. The engine writes its own append-only ledger and fires signed webhooks; who consumes them is unassigned — see `OQ-NODE-008-A` below. |
> | DVE promotion | Unchanged in intent: a token reaches `promoted` only by teacher approval (non-negotiable #10). The pipeline's host is unassigned — see `OQ-NODE-008-A`. |
>
> **`OQ-NODE-008-A` — two components lost their host and did not gain one.**
> Retiring the orchestrator removed the named home for myCred settlement and for
> the DVE submission step, and this change does not appoint a replacement: doing
> so would be inventing an architectural decision rather than recording one, and
> both are explicitly out of scope for the work that produced this amendment.
>
> What is true today, so nobody reads "superseded" as "handled":
>
> - **myCred settlement is unbuilt.** The engine's side is real and complete — an
>   append-only `reward_ledger` and HMAC-signed webhooks on game and token events
>   (`src/services/webhooks.ts`). Nothing receives them. XP accrues correctly and
>   settles into no external reward.
> - **DVE submission is unbuilt.** The promotion *gate* is real and enforced —
>   `promoted` requires explicit teacher approval and the system never
>   auto-promotes — so nothing leaks. But an approved token then goes nowhere: no
>   code in either repository posts a derived envelope to
>   `sparxstar-dheghom-dve-core`.
>
> Both need an owner ruling on where they live before Release 1 can claim reward
> settlement or dictionary contribution. Neither blocks classroom gameplay, which
> is why they are recorded here rather than fixed here.
>
> ---
>
> *Historical text follows.*


## 8.1 Stack

WordPress PHP 8.2+ plugin. WordPress 6.5+ minimum (SPARXSTAR platform-wide security baseline). The orchestrator uses only core plugin registration APIs available since WordPress 5.x — it does not depend on WordPress 7.x-only APIs. If the SPARXSTAR baseline advances to 7.0 in the future, the orchestrator does not need code changes.

## 8.2 What It Owns

| Responsibility | Detail |
| :---- | :---- |
| WordPress page mount | Registers page template. Enqueues React app. Injects `window.RLC_API_BASE`, `window.RLC_TEACHER_TOKEN`, and `window.RLC_SCHOOL_ID`. |
| Webhook receiver | Receives HMAC-signed webhooks from backend. Verifies signature. Deduplicates on `event_id`. Processes only verified, non-duplicate events. |
| myCred hooks | On verified game event webhooks: fires myCred point/badge hooks. Graceful no-op if myCred absent. |
| DVE promotion pipeline | On `token.promoted` webhook: submits derived token envelope to `sparxstar-dheghom-dve-core` via HTTP POST to SPARXSTAR internal REST API with Helios Bearer auth. Audio never forwarded. |

## 8.3 What It Does Not Own

Game logic. Session state. Token records. Votes. Leaderboard calculations. Any game REST endpoint. Audio of any kind. Reward logic — that is myCred's job.

## 8.4 DVE Promotion Gate

Only tokens with `completeness_signal = 'promoted'` enter DVE. Requires `verified` completeness + explicit teacher approval via `POST /token/:id/approve`. System never auto-promotes. Audio never forwarded to DVE.

---

# 9. Non-Negotiables

| Rule | Detail |
| :---- | :---- |
| **Primary source always destroyed** | Audio destroyed after Yahura processing. No primary source from minors retained. Governing data ethics principle. |
| **All writing encrypted at rest** | AES-256-GCM, per-account DEK in external KMS. All text, translation, corrected_text, yahura_transcription fields. Architectural — not configurable. |
| **No PII stored by the platform** | Screen names only. Adult `reset_email` is the single optional PII field, documented and rate-limited. School holds real-world identity mapping. |
| **Audio quality standard** | Community vote is the threshold. If children can hear it, the AI must too. |
| **Never block — always flag** | No submission rejected at intake. Flags drive enrichment and retroactive settlement. |
| **XP persistent and forever** | Lifetime accumulation per account. Class, school, national totals. National competitions enabled from day one. |
| **Localization always** | Every student-facing string is a localization key. No hardcoded English in any student-facing component. |
| **Token text immutability** | `text` column never updated. Corrections in `corrected_text`. Never a new token for a correction. |
| **Vote dimension strings** | API/DB: `orthography` \| `semantics` \| `audio`. UI: localized labels. Never swap the API strings. |
| **Three-step sequence** | State machine enforced as pedagogical guide (not gate). Steps hidden entirely when depth does not require them. |
| **Audio never in backend or DVE** | Starmus routes directly to Yahura. Destroyed after processing. Backend never holds audio. Starmus does not persist between capture and routing. |
| **No game logic in orchestrator** | myCred hooks, DVE promotion, WordPress page mount. Nothing else. |
| **UI talks to backend only** | React never calls WordPress directly. |
| **Rights travel with every token** | Never stripped. Never defaulted without explicit teacher confirmation. |
| **Community validates** | Votes by the class. System records. Never overrides outcomes. |
| **Submitter anonymized in QC** | Token shown in QC carries no identifying display of who submitted it. Revealed only at ceremony. |
| **Human gates DVE promotion** | Teacher explicitly approves. System never auto-promotes. |
| **Majority vote threshold** | `no > yes` triggers correction. Ties do not. |
| **Consensus threshold** | `yes / total >= 0.8` AND `total >= floor(participant_count / 2)`. |
| **Audio and semantics votes never affect completeness** | Only orthography votes drive state. Audio + semantics are exported informationally. |
| **Completeness transitions monotonic** | Forward only. Backward transitions rejected 409. |
| **Participant token in memory only** | Never persisted to localStorage or IndexedDB. |
| **myCred is the reward system** | Backend fires hooks. myCred handles all logic. No reward logic in the backend. |
| **Screen time enforced cross-product** | Hard ceiling by tier, tracked in central myCred ledger across all 3iAtlas products. Cannot be configured off. Graceful session end. |
| **Webhook delivery has retry + DLQ** | Outbound webhooks retry with exponential backoff; failed deliveries land in dead-letter table for manual replay. |
| **WordPress 6.5 minimum** | PHP 8.2 minimum. Orchestrator uses only core plugin registration APIs available since WP 5.x. |

---

# 10. Build Order

| Phase | Repo | Work | Done when |
| :---- | :---- | :---- | :---- |
| 1 — Scaffold | Backend | PostgreSQL migrations (all tables, including partial indexes and DLQ table). Express + socket.io. Dictionary JSON in memory. Helios JWT middleware (scope-aware). Participant HMAC middleware. Inbound service HMAC middleware. AES-256-GCM encryption service with KMS wiring. CORS. Rate limiting. i18n strings loaded. | `npm run dev` clean. Migrations run. All auth paths validate. Encryption round-trips correctly. KMS get/wrap/unwrap verified. |
| 2 — Accounts & Schools | Backend | `POST /account/create`. `POST /account/adult-register`. `POST /account/:id/unlock`. Class admin endpoints. National leaderboard endpoint with country param. Screen-time ledger query via myCred. | School admin creates class. Admin creates student accounts. Locked account unlocks. Adult self-registers. Leaderboard updates on XP award. Screen-time check blocks join after limit. |
| 3 — Session core | Backend + UI | Create, join (with all failure response shapes), status. `session:joined` / `session:left` sockets. T1 setup with rights confirmation. T2 monitor with LB roster claim panel and locked-account list. S1 join with tier-appropriate credential entry, masking, autofocus, IME handling. School ID injected by host page. | Teacher creates session. Lower Basic student picks name from roster. Upper Basic student enters PIN (locks after 3 fails). Teacher sees student in real time and can unlock. |
| 4 — RWC Collection | Backend + UI | Token save. Spelling signal. Saturation. `token:submitted` socket with XP. S2 screen (depth-conditional). AccessoryBar with IME bypass. State machine. Starmus mount. `POST /token/:id/audio-routed`. `POST /token/:id/translation-enriched`. `qc:audio-ready` socket. | Student submits word. XP counter updates. Teacher sees submission live. Yahura returns; transcription stored encrypted. Behistun enriches asynchronously. |
| 5 — RSC Collection | Backend + UI | Grammar domain sequencing. Focus element heuristic + `focus_detected` signal (NULL on RWC). Progress indicator. S3 screen. | Student completes all 12 domains. Focus detection fires myCred signal. RSC completion bonus fires on 12th save. |
| 6 — QC Phase | Backend + UI | QC selection algorithm. All token endpoints. S4–S7 unified QC screen with full sequence (anonymized submitter). T3 controls with Yahura transcription display. All via socket. Offline queue for votes and translations. ESU corrected-token path live. | Full QC round completes. All vote types, correction, translation work. Teacher approves token. ESU advances a corrected token to verified. |
| 7 — Awards | Backend + UI | Awards calculation. Class/school/national leaderboard aggregation. `GET /session/:id/awards`. T4 Teacher's Star + Teacher Award. S8 ceremony. Fireworks. Retroactive settlement. | Full ceremony runs on all screens. National totals update correctly. Retroactive settlement fires on ESU completeness advance. |
| 8 — Orchestrator | Orchestrator | WordPress page mount. Inject `window.RLC_API_BASE`, `window.RLC_TEACHER_TOKEN`, `window.RLC_SCHOOL_ID`. Webhook receiver with HMAC + event_id deduplication. myCred hooks for all event types. DVE promotion pipeline with Helios auth. Webhook DLQ table + admin replay endpoint. | React app loads on WordPress page. myCred awards fire. Promoted token reaches DVE. Failed webhook lands in DLQ; admin replays successfully. |
| 9 — Polish | All | PWA manifest. IndexedDB offline queue for all action types. `/events/batch` with full event schema. Screen time enforcement end-to-end (myCred ledger). Connectivity indicators. Error states. End-to-end test both modes. | Submission survives 30-second drop. Full session test passes both modes. Screen-time limit triggers graceful session end. National leaderboard updates correctly. |

---

# 11. Planned Surfaces — Not Yet Implemented

Everything in this section is **design/planning, not shipped code**. It lives
in `docs/PLATFORM-PLAN.md` (a v5.0 draft migration charter, senior only to
itself — this v4.0 spec remains canonical and unchanged for RLC) and its
companion ADRs/pathway notes. Nothing here should be read as available today.
Where the rest of this spec is silent, assume "not built" for anything listed
below. This section exists so that reading `docs/PLATFORM-PLAN.md` in
isolation never gets mistaken for a description of the current system — see
§3.10 for the corresponding shipped-mechanism corrections.

## 11.1 Tenant API (dictionary-games integration path)

`docs/PLATFORM-PLAN.md` §4.3/§4.5 describes a tenant-scoped developer surface
as the intended integration path for external games (first-named consumer:
`sparxstar-3iatlas-dictionary-games`):

| Endpoint | Purpose (planned) |
| :---- | :---- |
| `GET /api/v1/tenant/next-prompt` | Selector-served next capture/validation task |
| `POST /api/v1/tenant/submit` | Single ingestion door for activity results across games |
| `POST /api/v1/tenant/manifest` | Register/update a tenant game manifest |
| `GET /api/v1/tenant/ledger/:subject` | Read XP/trust status for an account or claimed device |
| `POST /api/v1/tenant/claim` | Upgrade a device token to a pseudonymous account |
| `GET /api/v1/tenant/asset/:id/url` | Presigned playback URL for vault assets |

**None of these exist in `src/routes/` today.** `docs/PLATFORM-PLAN.md` says so
explicitly at its own header ("Implementation status: Not implemented"). The
shipped surface remains the `/api/v1/*` REST + socket.io API documented in §6
and mirrored in `docs/API.md`, serving the RLC UI exclusively. Do not treat
the tenant API as available, partially built, or imminent without a dated
status update to this section backed by a code citation.

## 11.2 `dictionary-games` as "first external consumer"

`docs/PLATFORM-PLAN.md` §4.5 names `sparxstar-3iatlas-dictionary-games` as the
first external consumer and walks through how its outbox (`useProgressSync`)
would map onto `/events/batch` and the future tenant API. **Corrected 2026-08
(GAME-SERVICE-INTAKE-SPEC-v1.0 Phase 2):** the engine side of this is now
real — `game.result` is accepted at `/events/batch` under a registered
`dictionary_quiz` manifest, and `UI_ORIGINS` (§3.10) can admit a second
browser origin without further code changes. What is still **not** shipped:
no webhook configuration, client-registration code, or route anywhere in
`src/` references `dictionary-games` by name; no operator has added its
actual origin to any real deployment's `UI_ORIGINS`; and — this is the part
that actually blocks an end-to-end integration — **`dictionary-games`'
client code does not emit `game.result` at all.** Its outbox
(`useProgressSync.js`) only ever posts `aiwa_game_*`-prefixed markers to its
own IndexedDB queue and `syncNow()` is a deliberate no-op (intake spec §5,
OQ-3: it also can't populate a conformant `GameResultEvent` today — no
`attempts`/`time_ms`, and only `correct` outcomes are ever recorded). That
client-side work (Phase 3) has not started. Treat this as "the engine can
accept it, nothing sends it yet" — not a shipped integration.

## 11.3 `gameType` generalization beyond RLC

The registry mechanism exists today (§3.10; `src/games/registry.ts` +
`src/games/manifests.ts`) and is designed to hold more than one `gameType`.
The RLC (`mode`-keyed `GameManifest`) side is unchanged since the 2026-07
pass: exactly two manifests (`rwc`, `rsc`), both under `game_type: 'rlc'`.
**Corrected 2026-08 (GAME-SERVICE-INTAKE-SPEC-v1.0 Phase 2):** a third
`game_type` — `dictionary_quiz` — is now registered, but through a second,
`game_type`-keyed registry added alongside the original one, not as a third
entry in the `mode`-keyed one (§3.10's P2 note explains why: `Mode` is a
closed union and `GameManifest.tunables` is RLC-specific). `docs/PLATFORM-PLAN.md`
§2 (decision D1) and `ROLE.md` describe "dictionary and community games"
following RLC as additional `gameType`s on the same engine — that target
architecture is now partially realized in code, via a deliberately separate
mechanism rather than a literal extension of the `mode`-keyed one.

## 11.4 Event-vocabulary reconciliation

Per `NODE-ADR-003`, reconciling the engine's `token.*` dotted vocabulary with
the proposed "3iAtlas Event Contract v0.1" flat-verb vocabulary (and building
the per-`event_type` registry that would let new types land without an engine
release) is explicitly deferred to PLATFORM-PLAN P3. It is an **open
question, not a resolved decision** — do not read either vocabulary as having
superseded the other. See §3.10 for the current runtime behavior this
reconciliation would change.

## 11.5 Reading `docs/PLATFORM-PLAN.md` and the NODE-ADRs alongside this spec

`docs/PLATFORM-PLAN.md`, `docs/adr/NODE-ADR-*.md`, and
`.github/instructions/3iATLAS-ENGINE-PATHWAY-SPEC-v0.1.md` are architecture-
decision and planning-rationale documents — they record *why* a future
direction was chosen, not what ships today. This spec (v4.0) does not
contradict them; where §11 above and those documents describe the same
not-yet-built surface, treat this section as the terse, code-verified index
and the source documents as the detailed rationale. If a future change makes
any part of §11 shipped, update it here first (with a code citation), then
adjust the source planning document's status banner to match — never the
other way around.

---

# Appendix A. Implementation Status — `sparxstar-3iatlas-rlc-ui` (Verified Against Code)

> **Provenance note:** Sections 1–11 above are the canonical spec text,
> byte-identical across all three repos per the R1 ground-truth-propagation
> ruling (Max Barrett, 2026-08-01, 3iAtlas suite integration session). This
> appendix is **not** part of that canonical text — it is this repo's own
> pre-existing, code-verified implementation-status tracker, carried forward
> unchanged (aside from renumbering §11.x → §A.x to avoid colliding with the
> canonical spec's own §11) rather than being overwritten, because it records
> a fact — this repo's shipped-vs-planned status — that lives nowhere else
> in the suite. Do not read anything in this appendix as amending or
> superseding Sections 1–11.

Sections 1–10 above describe the **target** architecture shared across all
three repos, regardless of what has been built yet. This appendix is
different in kind: it is a **repo-specific, code-verified snapshot** of what
is actually shipped in `sparxstar-3iatlas-rlc-ui` today versus what is still
planned. Unlike the architecture sections, this appendix is expected to go
stale as work lands — update it whenever a UI migration step (§A.5)
changes status, and re-verify against source rather than trusting a prior
version of this appendix or of `README.md`/`AGENTS.md`.

This appendix covers the UI repo only. It does not speak to the current
implementation status of `sparxstar-3iatlas-rlc-node-engine` or
`sparxstar-3iatlas-rlc` — those repos' own instances of this spec file (or
equivalent) are authoritative for their own status.

## A.0 Update — 2026-08-23 (synchronization, voting, and CI)

This appendix's status tables below predate the change described here. Where they
disagree with this section, this section is current.

**Classroom progression is now server-authoritative.** The three defects this
appendix's §A.5/§A.6 hinted at but did not name have been fixed:

| Was | Now |
| :--- | :--- |
| `qc:token` unheard; QC walked a local index, so the teacher's Advance moved one browser | `useQcSession` has no cursor. It hydrates from `GET /session/:id/qc-state` and follows `qc:token`, applying an event only when its `seq` exceeds the last applied. The teacher's advance is a server call. |
| `ceremony:star` / `ceremony:end` unheard; each browser sorted awards against a local `STAR_ORDER` and ran its own reveal timer | `useCeremony` renders the server's order from `seq`, dedupes by star kind, and ends on `ceremony:end`. `STAR_ORDER` is deleted. |
| 6 of 13 emitted events handled, with no record of which mattered | All 13 handled and classified in `src/runtime/serverEvents.ts`, enforced by a test. Unknown events and throwing handlers are contained. |

**Step 7 (QC Rewrite) is materially advanced, not complete.** The three vote
axes are now collected **separately** — pronunciation (when a recording exists) →
spelling → meaning → conditional correction → translation — which closes the
gap §A.5 described as *"a single combined `vote` step … that votes on only one
dimension"*. Only the spelling result branches to correction, and only on a
strict majority No. What remains outstanding on this step: the audio panel is
still a placeholder because `RlcRecorder` does not record, and one-vote-per-
dimension is enforced server-side rather than reflected in a per-axis UI history.

**The AI facilitator controls are gone.** The three "Eshu" buttons returned
hardcoded placeholder strings presented as guidance. Removed, with their module.
Canonical §3.9 is corrected to describe what exists: no facilitator, and the
ordering invariant it existed to protect implemented server-side inside
`saveToken`. Future facilitator work is explicitly deferred.

**Screen-time signals are now handled client-side** (`screentime:limit-reached`,
and the halt state it produces). This does **not** mean screen-time is enforced:
the engine's quota client is a labelled development stub that grants the full
allowance on every call. See the engine's `PRODUCTION_READINESS.md`.

**CI exists.** `.github/workflows/test.yml` runs clean lockfile install,
typecheck, lint, tests, the contract smoke test, and a production build on every
push and PR. `npm run smoke` previously pointed at a file that did not exist —
that test is now implemented (`src/contract.smoke.test.ts`), so §A.6's finding
that "the documented backend contract smoke check is not currently runnable" is
closed.

**Test coverage, actual numbers.** 75 tests across 8 files, stable over five
consecutive runs — up from 9 tests across 2 files, none of which touched a
screen. The new suites are screen-level: they render the real components and
drive the real hooks through a fake socket, because a test that mocked the hook
would have passed against the broken code. §A.6's "no CI workflow or end-to-end
suite" is half closed: CI exists, browser-level E2E still does not.

**Still not done, and not claimed:** localization extraction (one screen consumes
i18next, and none of the four non-English bundles exist), the Starmus recorder,
the teacher T2 gaps, ceremony lifetime XP and school standing, browser-level
E2E, and accessibility/mobile-width verification. No browser, offline,
reconnection-against-a-real-network, accessibility, or mobile-width testing was
performed for this change.

## A.1 Wire Contract — Where the Exact Shapes Live

This spec (§6.3, §3.2) describes REST/socket endpoints and events at a
conceptual level — purpose, auth, and rough payload contents. It is **not**
the source of truth for exact field names, types, or JSON shapes. That is
`.github/instructions/SPARXSTAR-3iAtlas-RLC-Contract-v1.0.md`, kept
byte-identical with its twin file in the node-engine repo, and mirrored in
code at `src/contract.ts`. When implementing against a REST or socket
payload, use the Contract doc (or `src/contract.ts`) — not this spec's prose
— for the exact shape. Do not copy Contract content into this file; keep the
two documents separate and cross-reference instead.

## A.2 Real-Time Transport — Socket.io Is Wired, Not Pending

**Current status: done, not planned.** `socket.io-client` (`^4.8.3`) is a
real dependency in `package.json`. `src/runtime/socket.ts` implements
`createSocket()`, which opens an authenticated `socket.io` connection with
reconnection (`reconnection: true`, up to 12 attempts, 1–8s backoff, 10s
handshake timeout).

`src/hooks/useSessionSocket.ts` is the current real-time hook:

- Connects the socket immediately on mount.
- Starts a 5-second REST poll (`GET /session/:id/status`) as a fallback from
  the start; the poll is cancelled the moment the socket emits `connect`.
- Restarts the fallback poll on `disconnect` or `connect_error`, and stops it
  again on reconnect.
- Emits a `heartbeat` event every 10 seconds while connected.
- Re-fetches full session status via REST whenever the server sends
  `session:status` (the socket payload for that event is `{ status }` only —
  the client merges it with join-time metadata).

`src/hooks/useSessionPoll.ts` is **not** an independent polling
implementation. It is a one-line compatibility re-export:
`export { useSessionSocket as useSessionPoll } from '@/hooks/useSessionSocket'`.
Any code that still imports `useSessionPoll` is already running on sockets.

**What this means for prior drift:** earlier revisions of `README.md`,
`AGENTS.md`, and `.github/copilot-instructions.md` described real-time as
"still polling-based" with socket.io "not yet installed" — that was stale
and has been corrected. Verify this section against `package.json`,
`src/runtime/socket.ts`, and `src/hooks/useSessionSocket.ts` before trusting
it, since the code may have moved further since this was written.

## A.3 Configuration / Environment Variables — Verified Current Defaults

| Variable | Where read | Current default / behavior |
| :---- | :---- | :---- |
| `VITE_RLC_BACKEND_URL` | `.env.local` (build-time), read by `vite.config.ts` dev proxy and `src/runtime/socket.ts` dev fallback | **`http://localhost:3001`** by default (see `.env.example`, `vite.config.ts`). `vite.config.ts` now calls `loadEnv(mode, process.cwd(), '')`, so `.env`/`.env.local` values configure the dev proxy as well as client code without a duplicate shell export. |
| `window.RLC_API_BASE` | `src/api/client.ts`, `src/runtime/socket.ts` | Injected by the orchestrator host page in production; falls back to `/api/v1` (REST) when unset. Socket URL is derived from its origin when present. |
| `window.RLC_TEACHER_TOKEN` | `src/api/client.ts`, teacher screens | Backend-issued JWT injected by the orchestrator and held in page memory only. The former `localStorage` development fallback was removed on 2026-08-10 because a long-lived, script-readable JWT is an avoidable credential-disclosure risk. Local development may assign the global in the current page from the browser console; a reload clears it. |
| `window.RLC_SCHOOL_ID` | join flow | Required for `/session/join`; injected by the orchestrator host page, never entered by the student. |
| `window.RLC_CLASS_ID` | `src/screens/teacher/SetupScreen.tsx` | Read from `window`, with a non-secret `localStorage` fallback in development. |
| `window.RLC_SCHOOL_CONTEXT` | declared in `src/vite-env.d.ts` | Declared but not yet consumed anywhere in `src/` — reserved for future use, not part of any current data flow. |
| `window.YAHURA_URL` / `VITE_YAHURA_URL` | `src/components/RlcRecorder.tsx` | Base URL for the (placeholder) Starmus/Yahura recorder integration; window global takes precedence over the Vite env var. |

## A.4 Vite / Build Configuration

- Vite dev proxy forwards `/api/*` to `VITE_RLC_BACKEND_URL` (default
  `http://localhost:3001`) — see `vite.config.ts`. The config now uses
  `loadEnv`, so `.env.local` controls the proxy without a duplicate shell export.
- `vite-plugin-pwa` is configured with `registerType: 'autoUpdate'` and a
  manifest whose icon exists (`public/icon.svg`). API responses are deliberately
  not runtime-cached: authenticated/session responses must not survive in a
  shared browser cache. Offline writes remain the responsibility of the
  explicit IndexedDB action queue.
- Path alias `@/` → `src/` is configured in `vite.config.ts`, consistent with
  `AGENTS.md`'s coding standards.

## A.5 UI Migration Steps — Verified Status

`README.md` tracks these steps as a checklist. The table below is the
code-verified detail behind each checkbox as of this update — re-verify
against source before relying on it, since work continues to land.

| Step | Checklist state | Verified status |
| :---- | :---- | :---- |
| 1 — Spec adoption | Done | Confirmed — this spec file and the AGENTS.md/copilot-instructions rewrite are in place. |
| 2 — Branch hygiene | Done | Confirmed — no evidence of leftover unused deps from the pre-v4.0 stack. |
| 3 — Backend Retarget | Done | Confirmed — `src/api/client.ts` and `vite.config.ts` target `/api/v1`; `window.RLC_SCHOOL_ID` exists in `src/vite-env.d.ts` and is used at join. |
| 4 — Socket Introduction | **Done** (corrects a prior unchecked/stale status) | See §A.2. `socket.io-client` is installed and wired end-to-end on the UI side; `useSessionPoll` is a shim, not real polling. |
| 5 — Tier-aware Sign-in | **Done** (corrects a prior unchecked/stale status) | `src/screens/student/JoinScreen.tsx` implements all four flows: Lower Basic (roster tap, no credential), Upper Basic (screen name + 4-digit PIN), Senior Secondary/Adult (screen name + password), plus a graceful fallback. `parseJoinError()` gives specific failure UX for 401 (invalid credential, with `remaining_attempts`), 410 (session unavailable), and 423 (account locked). 403 (unknown screen name) and 429 (rate limit) are **not** distinguished by `parseJoinError()` — they fall through to the generic `unknown` case, so the UI shows a generic "Code not found" (probe) or generic credential/join-failure message (credentials submission) rather than status-specific copy. |
| 6 — Localization Extraction | **Not done** | `src/i18n/index.ts` wires i18next but ships only an English resource bundle (`src/i18n/locales/en/common.json`); Mandinka/Wolof/Fula/French bundles do not exist yet. Of the screens checked, only `CeremonyScreen.tsx` calls `useTranslation()` — `JoinScreen.tsx`, `QcScreen.tsx`, and others still have hardcoded English strings. Key extraction across all student-facing screens remains outstanding. |
| 7 — QC Rewrite | **Partially done** | Submitter anonymization is implemented — `QcScreen.tsx` never renders a submitter identity, matching the anonymized `QcToken` shape. However, the full Audio → Orthography → Semantics → Correction → Translation five-step sequence (§5.7, §7.4 S4–S7) is not implemented: the current `QcScreen.tsx` has a single combined `vote` step per token that votes on only one dimension (`orthography` for RWC, `semantics` for RSC), an audio step that is a placeholder ("Starmus not yet wired"), then correction/translation. This is a materially simpler flow than the spec's locked five-step sequence. |
| 8 — Polish | **Partially done** | Done: installable PWA manifest, IndexedDB offline queue with unit tests (`src/hooks/useSubmissionQueue.test.ts`, `src/runtime/offlineQueue.test.ts`), AccessoryBar IME-bypass with `ŋ` first and 44px targets (`src/components/AccessoryBar.tsx`). API caching was removed as unsafe for shared devices. Not done: no UI handling found for screen-time limit signals (423 at join / `screentime:limit-reached` mid-session / 451); `CeremonyScreen.tsx` lacks lifetime XP and school standing; no cross-mode end-to-end test suite exists. |

## A.6 Complete UI Repository Review — 2026-08-10

The review covered every tracked source/configuration file (the complete
`rg --files` inventory), all 53 TypeScript/TSX modules under `src/`, the locale
bundle, styles, public assets, package manifests, TypeScript/ESLint/Vite
configuration, README/security guidance, wire contract, and this specification.
It also executed the type checker, linter, unit tests, and production build. An
`npm audit` dependency scan was attempted but the registry returned HTTP 403,
so dependency-advisory results remain unverified. This is a static code/configuration review; it does
not claim backend integration, browser, accessibility, load, or penetration
testing that has not been run.

**Current runnable surface.** The app has an in-component state router in
`App.tsx`; teacher setup/monitor/QC and student join/lobby/RWC/RSC/QC/ceremony
surfaces exist. REST is centralized in `src/api/client.ts`; participant auth is
module-memory-only. Session updates use socket.io with REST fallback. The PWA
build, action queue, theme system, and English i18next bootstrap compile.

**Known functional gaps confirmed in code.** In addition to A.5:

- The teacher flow is not localized and the majority of student-facing screens
  still contain hardcoded English. Four required launch locale bundles are absent.
- Join does not provide distinct localized UX for every required 403, 429, and
  451 response. There are no dedicated account-lock or screen-time screens.
- T2 lacks the specified Lower Basic claim roster, locked-account list/unlock
  action, full live leaderboard/class total, and defined last-active view.
- Collection depth/state behavior and the Starmus integration remain incomplete;
  `RlcRecorder` is a placeholder and must never be replaced with UI-owned audio.
- QC does not implement the locked audio → orthography → semantics → conditional
  correction → translation sequence or one-vote-per-dimension lifecycle.
- T4 is not a separate screen, and ceremony lacks lifetime XP and school standing.
- Offline coverage is limited to the implemented action queue; reconnect and
  cross-screen recovery have no browser-level verification.
- The `smoke` package script names `src/contract.smoke.test.ts`, which is absent,
  so the documented backend contract smoke check is not currently runnable.
- There is no CI workflow or end-to-end suite. Unit coverage is two files/nine
  tests and does not exercise screens, API error behavior, sockets, PWA upgrades,
  accessibility, or the 360px/mobile interaction contract.
- File/module comments are inconsistent. Public utilities are often documented,
  but many components, hooks, constants, and callbacks are not. Completing the
  requested file/class/function/global documentation pass remains work; comments
  must explain contracts and invariants rather than restate code.

## A.7 Work Required for a Working, Deployable UI

The repository can produce static assets, but it is **not product-deployable**
until the following exit criteria are met:

1. **Contract and journeys:** implement every missing A.6 screen/state and verify
   RWC and RSC journeys against a version-pinned node-engine, including all join
   failures, status transitions, reconnects, duplicate votes, and offline replay.
2. **Localization/accessibility:** extract every user-facing string; supply and
   review `mn`, `wo`, `ff`, and `fr`; add language selection/session-locale
   behavior; run automated accessibility checks plus keyboard, screen-reader,
   reduced-motion, focus, contrast, and 360px touch-target testing.
3. **Authentication/security:** keep both JWT classes out of persistent storage;
   validate and normalize the injected API/socket origins; configure the host
   with TLS, a restrictive CSP and `frame-ancestors`, HSTS, Referrer-Policy,
   Permissions-Policy, and MIME sniffing protection; ensure source maps and host
   globals expose no secrets. Perform dependency, SAST, and browser security
   review in CI. API/service-worker caches must never retain authenticated data.
4. **PWA/offline:** design a service-worker update UX, test install/update/offline
   behavior on target browsers, define queue retention/expiry and user-visible
   failure recovery, and confirm logout/session-end purges all participant data.
5. **Configuration/deployment:** document concrete development/staging/production
   values and backend CORS/socket allowlists; make the orchestrator inject
   `RLC_API_BASE`, teacher token, school/class context before app mount; deploy
   `dist/` as immutable hashed assets with `index.html` uncached; add SPA fallback
   only where the mount architecture requires it; add health/rollback/runbook and
   environment promotion procedures.
6. **Quality gates:** create the missing contract smoke test, screen/component
   tests, and Playwright-style E2E coverage for all tiers and both modes. Add CI
   that runs clean install, typecheck, lint, unit tests, smoke tests against an
   ephemeral compatible backend, production build, audit/SAST, and artifact
   validation. Pin the supported Node/npm toolchain and enforce lockfile installs.
7. **Operations/privacy:** add consent/privacy acceptance tests, telemetry that
   contains no plaintext submissions/tokens, error monitoring with redaction,
   availability/performance budgets, backup/incident ownership at system level,
   and a shared-device data-removal verification checklist.
8. **Documentation/code quality:** complete meaningful documentation for every
   file, exported type, component, hook, function, callback with non-obvious
   behavior, and global/constant; normalize formatting; then keep this appendix
   synchronized with evidence from CI and deployed integration tests.

## A.8 Findings Fixed During This Review

- Removed all teacher-JWT `localStorage` fallbacks from the API client and
  teacher socket consumers; corrected `.env.example`, which also incorrectly
  referenced a nonexistent UI `/auth/login` flow.
- Removed service-worker runtime caching of `/api/v1` responses to prevent stale
  state and cross-user disclosure on classroom/shared devices.
- Replaced two nonexistent PNG PWA manifest icons with the tracked SVG icon.
- Made the Vite proxy load `.env.local` through Vite's supported `loadEnv` path.


---

*End of SPARXSTAR-3iAtlas-RLC-Spec-v4.0 (Sections 1–11 canonical; Appendix A repo-specific)*
*Filename: `SPARXSTAR-3iAtlas-RLC-Spec-v4.0.md`*
*Sections 1–11: commit byte-identical to `.github/instructions/` in all three repos (canonical filename is `sparxstar-3iatlas-rlc-spec-v4.0.md` in the node-engine repo, this repo keeps its historical title-case filename per R1).*
*Appendix A is unique to this repo — do not copy it elsewhere.*
*WordPress 6.5 minimum. PHP 8.2 minimum.*
