# AIWA Rapid Word & Sentence Collection Platform
## Technical Specification v4.0
### Starisian Technologies / AI West Africa · Confidential · May 2026

---

| ⚠️ CANONICAL DOCUMENT — ALL THREE REPOS |
| :---- |
| This is the single authoritative specification for: |
| `sparxstar-3iatlas-rlc-ui` · `sparxstar-3iatlas-rlc-node-engine` · `sparxstar-3iatlas-rlc` |
| It supersedes every prior document without exception. |
| If you find any other spec file — ignore it. This document wins. |
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
| **Adult** | Post-secondary | — | Full account. Own credentials. Joins existing teacher-created sessions only — adult solo collection is out of scope for v4.0. | N/A — no school context | Encrypted at rest. Full ownership. | None |

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

## 1.6 Rewards — myCred Hooks Only

AIWA fires hooks to myCred. myCred handles all reward logic — points, stars, badges, display, redemption, adult vs student rules, school configuration. AIWA does not implement reward logic, tiers, or redemption. That is myCred's job.

The spec defines what signal AIWA fires. myCred decides what to do with it. School admins configure myCred directly.

XP, Gold, stars, and badges are all myCred entities. The backend fires the hook. Done.

## 1.7 Screen Time Limits

Screen time is tracked per account per day across all 3iAtlas products combined — not per product separately.

| Tier | Daily limit |
| :---- | :---- |
| Lower Basic | 45–60 minutes |
| Upper Basic | 90 minutes |
| Senior Secondary | 120 minutes |
| Adult | No limit |

These are defaults. School admin can adjust within a configurable range via myCred / school dashboard. Hard ceiling cannot be removed — the system enforces it regardless of admin configuration.

**Central ledger:** The screen-time ledger lives in myCred (as it spans all 3iAtlas products and myCred already holds per-account state). On `POST /api/v1/session/join`, the backend queries myCred for remaining daily quota. Join rejected with 423 Locked + localized "Daily limit reached" if quota exhausted. Successful joins emit `screentime.session.started` to myCred; session close emits `screentime.session.ended` with elapsed minutes.

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

## 2.2 The Three Repos

| Repo | Language | Responsibility |
| :---- | :---- | :---- |
| `sparxstar-3iatlas-rlc-ui` | React 19 + TypeScript + Vite + i18next | All screens. All user interaction. Localized. Talks to backend only. |
| `sparxstar-3iatlas-rlc-node-engine` | Node.js + Express + PostgreSQL + socket.io | All game logic. All data. All real-time. System of record. |
| `sparxstar-3iatlas-rlc` | WordPress PHP 8.2+ plugin | myCred hooks. DVE promotion pipeline. WordPress page mount. |

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
      └── sparxstar-3iatlas-rlc-ui ───┘
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
| `qc:token` | Server → all | Next token for QC — includes Yahura transcription if available |
| `qc:audio-ready` | Server → all | Yahura transcription arrived for a token already in QC |
| `qc:vote` | Client → Server → all | Vote cast with dimension field — covers all three dimensions |
| `qc:translation` | Client → Server → all | Translation submitted |
| `qc:correction` | Server → all | Correction submitted |
| `ceremony:star` | Server → all | Star awarded — sequenced |
| `ceremony:end` | Server → all | Session complete |
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
| `aiwa:teacher` | Classroom teachers | Session create/close/approve, teacher's star, class leaderboard |
| `aiwa:school_admin` | School administrators | Account create, school leaderboard, screen-time configuration |
| `aiwa:adult` | Adult tier accounts | Self-managed session join (read-only otherwise) |

"School admin JWT" and "Teacher JWT" referenced elsewhere in this spec are shorthand for Helios JWTs carrying the corresponding scope claim.

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
| `promoted` | Set when teacher calls `POST /token/:id/approve` |

Transitions are monotonic — forward only. Backward transitions rejected with 409.

**Audio and semantics votes do not affect `completeness_signal`.** Only orthography drives state. Audio and semantics are recorded, exported to ESU (§3.5), and surfaced in T3, but never gate the token's state machine.

**Corrected tokens:** After `corrected_text` is submitted, the token's `orthography_state` is marked `corrected`. No re-vote. The token does not auto-advance to `verified` — it remains at `complete`. ESU may advance it later via `POST /token/:id/completeness` (see §3.5).

**Limbo tokens:** Tokens with 50–79% yes on orthography vote are neither corrected nor verified. They sit at `complete` permanently unless ESU advances them. This is intentional — the human gate (teacher approval) and ESU enrichment are the paths forward.

## 3.9 AI Facilitator

LibreChat. Optional — game never halts if unavailable. When available, call sequence after every submission is locked:

1. `check_saturation(text, session_id)` — if saturated, redirect. Skip step 2.
2. `analyze_spelling(text, language)` — shape facilitator response
3. `save_token()` — only after steps 1 and 2. Never before.

Facilitator prompts are localized to the session language.

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

**Focus word and rewards:** AIWA fires a signal to myCred indicating whether the focus element was detected. myCred configuration at the school level determines whether this affects the reward. AIWA does not implement the reward logic.

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
| CORS | Allow `sparxstar-3iatlas-rlc-ui` origin + `Authorization` header |
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
  i18n/           Localization strings per supported language
data/
  dictionary/     Language JSON files — read-only at runtime
  domains/        Semantic and grammar domain lists — static files
migrations/       PostgreSQL DDL — versioned, sequential
```

## 6.3 REST API

Base path: `/api/v1/`

### Account & Leaderboard Endpoints

| Method | Path | Auth | Description |
| :---- | :---- | :---- | :---- |
| POST | `/account/create` | `aiwa:school_admin` | Body: `{ school_id, class_id, screen_name, tier, pin? }`. Returns: `{ account_id }`. School pre-registers students. |
| POST | `/account/adult-register` | None (captcha + rate-limited) | Body: `{ screen_name, password, reset_email? }`. Adult self-registration. |
| POST | `/account/:id/unlock` | `aiwa:teacher` | Clears `failed_logins` and `locked_until`. Teacher PIN/password reset path. |
| GET | `/account/:id/xp` | Account token | Lifetime XP, gold, achievements |
| GET | `/class/:id/leaderboard` | `aiwa:teacher` | Class XP totals, student rankings |
| GET | `/school/:id/leaderboard` | `aiwa:school_admin` | School XP totals, class rankings |
| GET | `/leaderboard/national?country=GM` | None | National school rankings. `country` defaults to the requesting school's country if a school is identifiable from origin; otherwise required. |

### Session Endpoints

| Method | Path | Auth | Description |
| :---- | :---- | :---- | :---- |
| POST | `/session/create` | `aiwa:teacher` | Body: `{ mode, language, locale, semantic_domain_id, duration_minutes, collection_depth, class_id, rights }`. Returns: `{ session_id, join_code, qr_code_url }`. |
| POST | `/session/join` | None | **Lower Basic:** body `{ join_code }` only — student selects screen name from session list on device, no credential. **Upper Basic:** `{ join_code, screen_name, pin }`. **Senior Secondary / Adult:** `{ join_code, screen_name, password }`. School ID is injected by host page — never in the request body. Returns: `{ session_id, participant_id, participant_token, account_id, language, locale, mode, collection_depth, session_screen_names? }`. Failure responses listed below. |
| GET | `/session/:id/status` | None | Returns: `{ status, participant_count, token_count, time_remaining_seconds, leaderboard[], class_xp_total, participant_token? }`. |
| POST | `/session/:id/close` | `aiwa:teacher` | End collection. Trigger QC selection. Emit `session:status`. |
| GET | `/session/:id/qc-words` | None | Returns ordered `QcToken[]` — 5–10 by priority algorithm. Submitter identity stripped. |
| GET | `/session/:id/awards` | None | Returns: `{ stars[], leaderboard[], total_tokens, discovery_count }`. |
| POST | `/session/:id/teachers-star` | `aiwa:teacher` | Body: `{ participant_id }`. One per session — 409 if already assigned. |

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
| POST | `/token/:id/approve` | `aiwa:teacher` | Teacher approval for DVE promotion. Sets `approved_by_teacher = true`, `approved_at`, advances to `promoted`. |
| POST | `/token/:id/audio-routed` | Yahura MCP (HMAC) | Body: `{ yahura_transcription, yahura_confidence }`. Advances completeness. Fires myCred hook. |
| POST | `/token/:id/translation-enriched` | Behistun MCP (HMAC) | Body: `{ enriched_translation, confidence, target_language }`. Writes to `token_translations`. |
| POST | `/token/:id/completeness` | ESU MCP (HMAC) | Body: `{ completeness_signal }`. Monotonic only — 409 if backward. Triggers retroactive settlement in same handler. |
| POST | `/events/batch` | Participant token | Offline queue flush. Queueable event types: `token.save`, `token.vote`, `token.translate`, `token.correct`. Body: `{ events: [{ event_id, event_type, payload }] }`. Returns: `{ accepted, failed }`. Duplicate `event_id` silently skipped. |

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
| 🏫 Teacher Award | Auto-issued to teacher for QC participation — awarded if teacher cast at least one vote. |

**XP stacking:** Discovery + Consensus bonuses both apply to the same token. Not mutually exclusive.

**Vote XP balance:** +5 XP per QC round, not per dimension. One round = one token reviewed regardless of how many dimensions voted. This keeps collection XP higher than QC voting XP.

### XP — myCred Hooks

Backend fires hooks to myCred via orchestrator. myCred handles all reward logic.

| Event | XP hook | Accumulates at |
| :---- | :---- | :---- |
| Token submitted | +10 XP | Student, Class, School |
| Translation submitted in collection | +15 XP | Student, Class, School |
| Audio routed to Yahura | +20 XP | Student, Class, School |
| QC round completed (per token reviewed) | +5 XP | Student, Class, School |
| Translation submitted in QC | +10 XP | Student, Class, School |
| Token reaches consensus | +50 XP + Gold badge | Student, Class, School |
| Discovery — new word | +100 XP + Gold badge | Student, Class, School |
| RSC — all 12 domains complete | +200 XP + Gold badge | Student, Class, School |
| Retroactive settlement | Delta XP | Student, Class, School |

## 6.6 Backend → Orchestrator Webhooks

HMAC-SHA256 signed. `event_id` on every webhook for idempotency. Orchestrator verifies signature and deduplicates on `event_id`.

| Webhook | Orchestrator action |
| :---- | :---- |
| `token.submitted` | Fire myCred hook → +10 XP |
| `audio.routed` | Fire myCred hook → +20 XP |
| `qc.round.completed` | Fire myCred hook → +5 XP |
| `consensus.reached` | Fire myCred hook → +50 XP + Gold badge |
| `discovery.found` | Fire myCred hook → +100 XP + Gold badge |
| `rsc.completed` | Fire myCred hook → +200 XP + Gold badge |
| `settlement.retroactive` | Fire myCred hook → delta XP |
| `token.promoted` | Submit derived token to DVE via SPARXSTAR internal HTTP API with Helios Bearer auth |

**Retry policy:** Each outbound webhook attempts delivery with exponential backoff at 2s, 4s, 8s, 16s, 32s, 64s (6 attempts, ~2-minute total window). After exhaustion, the webhook is recorded in a `webhook_dead_letter` table with full payload, attempt history, and last error. Manual replay endpoint: `POST /api/v1/admin/webhooks/replay/:event_id` (admin auth). myCred outages are non-fatal — game continues; rewards settle on retry.

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
- Characters: `ŋ` `ɓ` `ɗ` `ñ` `ɲ` `aa` `ee` `ii` `oo` `uu`

`ŋ` is the highest-priority character. If not trivially accessible, students type `n` and never learn the difference. Linguistic sovereignty — not optional.

## 7.6 Starmus Integration

1. Mount Starmus widget in recording panel — shown only in `full` depth
2. Listen: `window.addEventListener('starmus:complete', handler)`
3. On event: advance state machine to `RECORDED`, enable Save
4. Never reference audio in any API call

## 7.7 Offline Resilience

All four action types are queueable in IndexedDB: token save, vote, translation, correction. On reconnect, flushed sequentially to `POST /api/v1/events/batch`. Each event carries unique `event_id` — server skips duplicates. A student who drops during QC does not lose their vote or translation.

---

# 8. Orchestrator — `sparxstar-3iatlas-rlc`

## 8.1 Stack

WordPress PHP 8.2+ plugin. WordPress 6.5+ minimum (SPARXSTAR platform-wide security baseline). The orchestrator uses only core plugin registration APIs available since WordPress 5.x — it does not depend on WordPress 7.x-only APIs. If the SPARXSTAR baseline advances to 7.0 in the future, the orchestrator does not need code changes.

## 8.2 What It Owns

| Responsibility | Detail |
| :---- | :---- |
| WordPress page mount | Registers page template. Enqueues React app. Injects `window.AIWA_API_BASE`, `window.AIWA_TEACHER_TOKEN`, and `window.AIWA_SCHOOL_ID`. |
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
| **No PII stored by AIWA** | Screen names only. Adult `reset_email` is the single optional PII field, documented and rate-limited. School holds real-world identity mapping. AIWA never does. |
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
| **myCred is the reward system** | AIWA fires hooks. myCred handles all logic. AIWA implements no reward logic. |
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
| 8 — Orchestrator | Orchestrator | WordPress page mount. Inject `window.AIWA_API_BASE`, `window.AIWA_TEACHER_TOKEN`, `window.AIWA_SCHOOL_ID`. Webhook receiver with HMAC + event_id deduplication. myCred hooks for all event types. DVE promotion pipeline with Helios auth. Webhook DLQ table + admin replay endpoint. | React app loads on WordPress page. myCred awards fire. Promoted token reaches DVE. Failed webhook lands in DLQ; admin replays successfully. |
| 9 — Polish | All | PWA manifest. IndexedDB offline queue for all action types. `/events/batch` with full event schema. Screen time enforcement end-to-end (myCred ledger). Connectivity indicators. Error states. End-to-end test both modes. | Submission survives 30-second drop. Full session test passes both modes. Screen-time limit triggers graceful session end. National leaderboard updates correctly. |

---

*End of AIWA-RWC-RSC-Technical-Specification-v4.0*
*Filename: `AIWA-RWC-RSC-Technical-Specification-v4.0.md`*
*Commit to `.github/instructions/` in all three repos.*
*Delete every prior spec file from every location any coding agent can index.*
*WordPress 6.5 minimum. PHP 8.2 minimum.*
