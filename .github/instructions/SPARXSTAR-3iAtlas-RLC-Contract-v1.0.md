# SPARXSTAR 3iAtlas RLC — Integration Contract v1.0
### Starisian Technologies · Confidential · May 2026

> **Status: `supporting`** — v4.0 (canonical) delegates the **wire surface** to this document; this document is the sole home for wire shape and does **not** govern behavior (see `AGENTS.md` §2).

---
| ⚠️ COORDINATION DOCUMENT — ALL THREE REPOS |
| :---- |
| This document defines the exact contract between `sparxstar-3iatlas-rlc-ui` and `sparxstar-3iatlas-rlc-node-engine`. |
| Neither repo invents anything not defined here. |
| If something is missing — raise it. Do not assume. |
| Scope: v4.0 delegates **wire shape** (endpoints, field names, encodings, status codes) to this document; this is its single home and it does **not** govern behavior. Behavioral questions resolve to v4.0. If v4.0 ever re-specifies a wire field, that is a bug — move it here. |
---
# 1. Transport
- **REST base URL:** `http://localhost:3001/api/v1` in development. `VITE_RLC_BACKEND_URL` in production.
- **WebSocket URL:** same host as REST. `VITE_RLC_BACKEND_URL` with `ws://` or `wss://` scheme.
- **All REST requests:** `Content-Type: application/json`
- **All responses:** `Content-Type: application/json`
---
# 2. Authentication Headers
## 2.1 Teacher Requests
```
Authorization: Bearer <identity_token>
```
**Amended 2026-08-23 (NODE-ADR-007).** This is an **Identity Service** token, not
a Helios JWT — the label above previously read `<helios_jwt>`. Helios is no longer
an authentication authority for RLC.

The token proves **identity only**. It carries no scope and cannot: the Identity
Service is forbidden from minting an authorization claim, and the engine refuses
any token presenting one. Teacher and school-admin power comes from RLC's own
`rlc_authorizations` rows, resolved server-side per request, and scoped to the
school of the resource being acted on.

The host page supplies it at runtime as `window.RLC_TEACHER_TOKEN`, held in page
memory only and never persisted. That host page is **not** a WordPress plugin —
spec §8's orchestrator is superseded — and a reusable teacher token must never be
committed to page configuration or source. The UI still never calls a login
endpoint; there is no `POST /auth/login`.
## 2.2 Participant Requests
```
Authorization: Participant <participant_token>
```
Required on **every** participant REST call. Not optional. Not just audio upload.
`participant_id` is **never** included in request bodies. The backend derives it from the bearer token.
## 2.3 Inbound Service Calls (Yahura, Behistun, ESU)
```
X-HMAC-Signature: <sha256_hmac>
X-Event-ID: <uuid>
```
## 2.4 Adult Identity Suite Token (Release 1)
```
Authorization: Bearer <identity_suite_token>
```
Issued by the 3iAtlas Identity Service (`https://id.sparxstar.com`). Carries
account/tier facts and **no scope** — see spec v4.0 §3.11 for the governing
statement of what it may do, and `docs/adr/NODE-ADR-006`.

**Amended 2026-08-23 (NODE-ADR-007).** §2.1 and this section now name the **same
issuer**: there is one authentication authority for the whole platform. What
distinguishes a teacher request from an adult solo one is therefore no longer the
issuer but the **authorization** behind it — a teacher route additionally requires
an `rlc_authorizations` grant for the school in question, which an adult solo
player simply does not hold. A token alone can never reach a teacher route.

Valid on exactly three surfaces, all listed in §3 with `Auth: Bearer
<identity_suite_token>`:

| Endpoint | Note |
| :---- | :---- |
| `POST /events/batch` | `game.result` events **only** — every `token.*` type is rejected on this credential |
| `GET /account/:id/xp` | owner-scoped: path id must equal the token's account |
| `GET /account/:id/ledger` | owner-scoped, as above |

Adult tier only. A valid `lower_basic` / `upper_basic` / `senior_secondary`
token is refused.

**The verifier on these three surfaces is unchanged.** The 2026-08-23 amendment
altered §2.1's *label* — Helios JWT to Identity token — and nothing about how an
adult token is checked: all three still run `requireSuiteAccount`
(`sparxstar-3iatlas-rlc-node-engine/src/middleware/suite.ts` — this contract is
carried in both repositories, so the path is qualified), which verifies through
`verifySuiteToken` exactly as before, with the same issuer pin, the same audience pin, the same RS256-and-`kid`
requirement, the same scope refusal, the same adult-tier gate, and the same live
session assertion. Stated because "§2.1 and §2.4 now name the same issuer" could
be read as a behavioural change to the adult path; it is not. What changed is that
the classroom path stopped using a *different* verifier and now calls the same
one. No adult client needs to do anything differently.
---
## 2.5 What is actually reachable in Release 1

**Amended 2026-08-23.** Every endpoint in §3 below that needs a teacher, a
classroom, a school roster, a minor tier, an RLC session, or the DVE gate is
**not mounted** unless `CLASSROOM_ENABLED=true`, which is off by default
(`src/routes/index.ts`). An unmounted route 404s for every caller, so it cannot
be reached by a token of any kind.

This is stated here because it is the answer to a question §3 otherwise invites:
whether the 2026-08-23 auth tightening on `qc-words`, `qc-state`, and `awards` —
`None` → `session reader` — is a breaking change for an existing consumer. **It
is not.** All three live on the session router, which is unmounted in Release 1,
so they answer 404 to everyone today; there is no deployed caller to break. The
same holds for the socket handshake's new refusal reason strings: socket
registration itself is not gated, but neither credential type can be obtained
without the classroom routes (a participant token comes from `session/join`, and
a teacher socket needs a session that only `session/create` can make), so no
Release 1 client observes either string.

Release 1's reachable surface is the adult single-player one: `POST
/events/batch` (`game.result` only), `GET /account/:id/xp`, and `GET
/account/:id/ledger` — the three §2.4 surfaces, whose verifier is unchanged.

---
# 3. REST Endpoints — Exact Contracts
## 3.1 School & Class
### POST /school/create
Auth: `rlc:school_admin`
Request:
```typescript
{
  name: string;
  country: string;
  region?: string;
}
```
Response 201:
```typescript
{
  school_id: string; // UUID
}
```
### POST /class/create
Auth: `rlc:school_admin`
Request:
```typescript
{
  school_id: string;
  name: string;
  tier: 'lower_basic' | 'upper_basic' | 'senior_secondary' | 'adult';
  teacher_id?: string;
}
```
Response 201:
```typescript
{
  class_id: string; // UUID
}
```
### GET /school/:id
Auth: `rlc:school_admin` or `rlc:teacher`
Response 200:
```typescript
{
  school_id: string;
  name: string;
  country: string;
  region: string | null;
  recording_enabled: boolean; // default false
  total_xp: number;
  total_gold: number;
}
```
### GET /class/:id
Auth: `rlc:teacher`
Response 200:
```typescript
{
  class_id: string;
  school_id: string;
  name: string;
  tier: 'lower_basic' | 'upper_basic' | 'senior_secondary' | 'adult';
  teacher_id: string | null;
  total_xp: number;
  total_gold: number;
  recording_enabled: boolean; // inherited from school — included here for UI convenience
}
```
## 3.2 Accounts
### POST /account/create
Auth: `rlc:school_admin`
Request:
```typescript
{
  school_id: string;
  class_id: string;
  screen_name: string;
  tier: 'lower_basic' | 'upper_basic' | 'senior_secondary' | 'adult';
  pin?: string;       // Upper Basic — 4 digits
  password?: string;  // Senior Secondary, Adult — min 12 chars
}
```
Response 201:
```typescript
{
  account_id: string;
}
```
### POST /account/adult-register
Auth: None (rate-limited, captcha-gated)
Request:
```typescript
{
  screen_name: string;
  password: string;
  reset_email?: string;
}
```
Response 201:
```typescript
{
  account_id: string;
}
```
### POST /account/:id/unlock
Auth: `rlc:teacher`
Request: empty body
Response 200:
```typescript
{
  success: true;
}
```
### GET /account/:id/xp
Auth: `Participant <token>` (classroom) **or** `Bearer <identity_suite_token>` (adult, §2.4).
Owner-scoped either way: the path id must equal the account the credential names.
Response 200:
```typescript
{
  account_id: string;
  lifetime_xp: number;
  lifetime_gold: number;
}
```
## 3.3 Leaderboards
### GET /class/:id/leaderboard
Auth: `rlc:teacher`
Response 200:
```typescript
{
  class_id: string;
  total_xp: number;
  students: {
    account_id: string;
    screen_name: string;
    lifetime_xp: number;
    session_xp: number;
  }[];
}
```
### GET /school/:id/leaderboard
Auth: `rlc:school_admin`
Response 200:
```typescript
{
  school_id: string;
  total_xp: number;
  classes: {
    class_id: string;
    name: string;
    total_xp: number;
  }[];
}
```
### GET /leaderboard/national
Auth: None
Query params: `?country=GM` (defaults to school country if identifiable)
Response 200:
```typescript
{
  country: string;
  schools: {
    school_id: string;
    name: string;
    total_xp: number;
    rank: number;
  }[];
}
```
## 3.4 Sessions
### POST /session/create
Auth: `rlc:teacher`
Request:
```typescript
{
  mode: 'rwc' | 'rsc';
  language: string;         // BCP-47
  locale: string;           // BCP-47
  semantic_domain_id?: string;
  duration_minutes: number;
  collection_depth: 'full' | 'translation_only' | 'basic';
  class_id: string;
  rights: {
    license: string;
    ai_training: boolean;
    commercial: boolean;
  };
}
```
Response 201:
```typescript
{
  session_id: string;
  join_code: string;  // 6 chars, uppercase
  qr_code_url: string;
}
```
Response 422 — recording not permitted:
```typescript
{
  error: 'recording_not_permitted';
  // Returned when collection_depth = 'full' AND
  // (class tier is lower_basic OR school.recording_enabled = false)
}
```
### POST /session/join — Lower Basic Step 1
Auth: None
Request:
```typescript
{
  join_code: string;
  // No screen_name — Lower Basic first step
}
```
Response 200:
```typescript
{
  requires_screen_name: true;
  session_screen_names: string[];
}
```
### POST /session/join — All Tiers Final Step
Auth: None
Request:
```typescript
// Lower Basic
{
  join_code: string;
  screen_name: string;
  // No credential
}
// Upper Basic
{
  join_code: string;
  screen_name: string;
  pin: string;
}
// Senior Secondary / Adult
{
  join_code: string;
  screen_name: string;
  password: string;
}
// school_id is NEVER in the body — injected by host page as window.RLC_SCHOOL_ID
```
Response 200:
```typescript
{
  session_id: string;
  participant_id: string;
  participant_token: string;  // Store in memory only. Never localStorage. Never IndexedDB.
  account_id: string;
  language: string;
  locale: string;
  mode: 'rwc' | 'rsc';
  collection_depth: 'full' | 'translation_only' | 'basic';
  session_screen_names?: string[];  // Lower Basic only
}
```
Failure responses:
```typescript
// 403 — localization is the UI's job (it holds the i18n keys); the backend
// sends only { error }.
{ error: 'unknown_screen_name' }
// 401
{ error: 'credential_invalid'; remaining_attempts: number }
// 423
{ error: 'account_locked'; unlock_path: string }
// unlock_path = '/api/v1/account/<account_id>/unlock'
// 410
{ error: 'session_unavailable' }
// 429
{ error: 'rate_limited'; retry_after_seconds: number }
// 451
{ error: 'screen_time_exceeded'; reset_at: number } // Unix timestamp
```
### GET /session/:id/status
Auth: None
Response 200:
```typescript
{
  status: 'open' | 'qc' | 'ceremony' | 'closed' | 'archived';
  participant_count: number;  // computed from participants JSONB — not a column
  token_count: number;
  time_remaining_seconds: number;
  leaderboard: {
    participant_id: string;
    screen_name: string;
    session_xp: number;
  }[];
  class_xp_total: number;
  participant_token?: string;  // Present only when near expiry — replace silently
}
```
### GET /session/:id/qc-state
Auth: **session reader** — either `Participant <token>` for *this* session, or
`Bearer <identity_token>` from a teacher/admin holding an `rlc_authorizations`
grant for this session's school. **Added 2026-08-23.**

The authoritative current QC position — the hydration and reconnection read. A
client calls this on mount, on reconnect, and after a reload, and lands exactly
where the class is. It **advances nothing**: only `POST /session/:id/qc-advance`
moves anyone, and that is teacher-only.

`seq` matches the last emitted `qc:token.seq`, so a client can tell whether a
socket event it already holds is newer than the state it just fetched — and must
not let an older fetched position overwrite a newer event.

> **`token` carries DECRYPTED WRITING**, which is why this is authenticated.
> `QcToken.text` is the student's submission, decrypted server-side for the class
> to vote on.
>
> **Closed 2026-08-23: `qc-words`, `qc-state`, and `awards` were all
> unauthenticated.** Anyone holding a session UUID could read minors' writing with
> no credential. The first reasoning offered for leaving the new endpoint open —
> that tightening one changes nothing while the others serve more — was true and
> was the argument for closing all three, not for adding a third. All three now
> require a session reader. Refusals: `401` with no or an invalid credential,
> `403 session_scope_required` for a valid credential belonging to another session
> or an account with no grant for this school.

Response 200:
```typescript
{
  seq: number;              // 0 before the teacher's first advance
  token: QcToken | null;    // null before the first advance; submitter NEVER included
  exhausted: boolean;       // true once every selectable token has been advanced through
}
```

### POST /session/:id/close
Auth: `rlc:teacher`
Request: empty body
Response 200:
```typescript
{
  success: true;
}
```
### POST /session/:id/qc-advance
Auth: classroom role `teacher`, resolved from `rlc_authorizations` and scoped to
this session's school (§2.1). Not a token scope — no token carries one.
Request: empty body
Response 200:
```typescript
{
  success: true;
  token_id: string;  // next QC token
  seq: number;       // sequence the accompanying qc:token broadcast carried
}
```

`seq` is echoed (added 2026-08-23) so the teacher's own response says where the
class was moved to. Without it a teacher client must wait for and correlate the
broadcast, and has nothing to compare against `qc-state` if that broadcast is
lost.
Sets `teacher_advanced_qc = true` on first call. Broadcasts `qc:token` socket
event with the new `seq`.

The advance is a compare-and-set. Two simultaneous clicks both select the same
next token, so exactly one lands; the other returns `409 { error:
'qc_advance_conflict' }` and broadcasts nothing. A client receiving that **must**
re-read `GET /session/:id/qc-state` before rendering anything further — advisory
language would be wrong here, because a teacher UI that assumed either outcome
would diverge from the class it is supposed to be driving. `409 {
error: 'qc_exhausted' }` is the different case: there is nothing left to advance
to, and re-reading will not change that — the class has finished QC.
### GET /session/:id/qc-words
Auth: **session reader** (see `GET /session/:id/qc-state`) — changed 2026-08-23
from `None`. Returns decrypted student writing.
Response 200:
```typescript
{
  qc_words: {
    token_id: string;
    text: string;
    translation: string;
    yahura_transcription: string | null;
    yahura_confidence: number | null;
    grammar_domain: string;
    spelling_signal: 'confirmed' | 'variant' | 'discovery' | null;
    completeness_signal: 'basic' | 'partial' | 'complete' | 'verified' | 'promoted';
    vote_orthography: { yes: number; no: number };
    vote_semantics: { yes: number; no: number };
    vote_audio: { yes: number; no: number };
    // submitter_id NEVER included — anonymized
  }[];
}
```
### GET /session/:id/awards
Auth: **session reader** (see `GET /session/:id/qc-state`) — changed 2026-08-23
from `None`. Returns participant `screen_names`.
Response 200:
```typescript
{
  stars: {
    star: 'most_words' | 'most_sentences' | 'best_spelling' | 'discovery' |
          'speed' | 'audio' | 'teacher' | 'teacher_award';
    participant_ids: string[];
    screen_names: string[];
  }[];
  leaderboard: {
    participant_id: string;
    screen_name: string;
    tokens: number;
    session_xp: number;
  }[];
  total_tokens: number;
  discovery_count: number;
}
```
### POST /session/:id/teachers-star
Auth: `rlc:teacher`
Request:
```typescript
{
  participant_id: string;
}
```
Response 200:
```typescript
{ success: true }
```
Response 409: already assigned this session.
### POST /session/:id/ceremony
Auth: `rlc:teacher`
Sequences `qc → ceremony → closed`. Emits `ceremony:star` then `ceremony:end` socket events.
Request: empty body
Response 200:
```typescript
{ success: true }
```
## 3.5 Tokens
### POST /token/save
Auth: `Participant <token>`
Request:
```typescript
{
  session_id: string;
  text: string;
  translation: string;        // always on the wire; empty string if basic depth
  collection_mode: 'rwc' | 'rsc';
  // RSC: grammar_domain_index (1–12) is REQUIRED and authoritative — it drives
  // rsc_progress. The server derives the canonical grammar_domain name from the
  // index; grammar_domain is OPTIONAL and, if sent, must equal the canonical
  // name for that index, else 400 { error: 'grammar_domain_mismatch' }. The UI
  // may send the index alone. RWC: grammar_domain is a free-form Louw-Nida
  // semantic domain and the index is unused.
  grammar_domain_index?: number;  // REQUIRED when collection_mode === 'rsc' (1–12)
  grammar_domain?: string;
  focus_detected?: boolean;   // RSC only. NULL for RWC — omit field entirely.
  rights: {
    license: string;
    ai_training: boolean;
    commercial: boolean;
  };
  // participant_id NOT included — derived from bearer token
}
```
Response 201:
```typescript
{
  token_id: string;
  spelling_signal: 'confirmed' | 'variant' | 'discovery';
  saturation_signal: 'continue' | 'saturated';
  spelling_score: number;
  completeness_signal: 'basic' | 'partial' | 'complete' | 'verified' | 'promoted';
  xp_awarded: number;
  account_lifetime_xp: number;
  rsc_progress?: { completed: number; total: number };  // RSC mode only
}
```
### POST /token/:id/vote
Auth: `Participant <token>`
Request:
```typescript
{
  dimension: 'orthography' | 'semantics' | 'audio';
  vote_yes: boolean;
  // participant_id NOT included — derived from bearer token
}
```
Response 200:
```typescript
{
  success: true;
  vote_counts: {
    orthography: { yes: number; no: number };
    semantics: { yes: number; no: number };
    audio: { yes: number; no: number };
  };
  has_voted: boolean;
}
```
Response 409: duplicate vote.
### POST /token/:id/translate
Auth: `Participant <token>`
Request:
```typescript
{
  translation: string;
  // participant_id NOT included — derived from bearer token
}
```
Response 200:
```typescript
{ success: true }
```
### POST /token/:id/correct
Auth: `Participant <token>` — submitter only
Request:
```typescript
{
  corrected_text: string;
  // participant_id NOT included — derived from bearer token
}
```
Response 200:
```typescript
{ success: true }
```
Response 403: not the original submitter.
### POST /token/:id/approve
Auth: `rlc:teacher`
Request: empty body
Response 200:
```typescript
{ success: true }
```
### POST /token/:id/audio-routed
Auth: Yahura MCP (HMAC)
Request:
```typescript
{
  yahura_transcription: string;
  yahura_confidence: number;  // 0.0 – 1.0
}
```
Response 200:
```typescript
{ success: true }
```
Audio is never sent to this endpoint. This endpoint receives only the Yahura result.
Audio travels from the UI directly to Yahura. Backend never holds audio in any form.
### POST /token/:id/translation-enriched
Auth: Behistun MCP (HMAC)
Request:
```typescript
{
  enriched_translation: string;
  confidence: number;
  target_language: string;
}
```
Response 200:
```typescript
{ success: true }
```
### POST /token/:id/completeness
Auth: ESU MCP (HMAC)
Request:
```typescript
{
  completeness_signal: 'basic' | 'partial' | 'complete' | 'verified' | 'promoted';
}
```
Response 200:
```typescript
{ success: true }
```
Response 409: backward transition rejected.
### POST /events/batch
Auth: `Participant <token>` (classroom — every queueable type) **or**
`Bearer <identity_suite_token>` (adult solo — `game.result` ONLY; any `token.*`
event on this credential is rejected with `unsupported_event_type`). See §2.4.
Request:
```typescript
{
  events: {
    event_id: string;   // UUID — server skips duplicates
    event_type: 'token.save' | 'token.vote' | 'token.translate' | 'token.correct';
    payload: Record<string, unknown>;  // same shape as individual endpoint body
  }[];
}
```
Response 200:
```typescript
{
  accepted: number;
  failed: { event_id: string; reason: string }[];
}
```
## 3.6 Admin
### POST /admin/webhooks/replay/:event_id
Auth: `rlc:school_admin`
Request: empty body
Response 200:
```typescript
{ success: true; delivered: boolean }
```
---
# 4. WebSocket — Socket.io
## 4.1 Connection
```typescript
import { io } from 'socket.io-client';
// Student
const socket = io(VITE_RLC_BACKEND_URL, {
  auth: {
    token: participantToken  // 'Participant <token>'
  }
});
// Teacher
const socket = io(VITE_RLC_BACKEND_URL, {
  auth: {
    // A ROUTING hint: it selects which verifier the handshake runs, and nothing
    // more. Authority comes from an rlc_authorizations grant, and that grant must
    // cover the school of `sessionId` below — a teacher authorized in another
    // school is refused (NODE-ADR-007).
    role: 'teacher',
    // Identity Service token (§2.1). Proves identity ONLY.
    token: window.RLC_TEACHER_TOKEN,
    // REQUIRED. A teacher socket monitors exactly one session; without it the
    // handshake cannot be scoped, so it is refused rather than admitted unscoped.
    sessionId: sessionId
  }
});
```
Bad or missing auth → connection rejected with `unauthorized`. Handle gracefully — show rejoin prompt.

**What `role` can and cannot do.** It selects which verifier runs and nothing
else; both verifiers then run their own full check, so spoofing it gains nothing:

| Client sends | What happens |
| :---- | :---- |
| `role: 'teacher'` + participant token | Identity verifier runs and rejects an HMAC participant token outright → `unauthorized` |
| `role: 'teacher'` + valid Identity token, no grant for the session's school | Authenticated, then refused at the grant lookup → `unauthorized` |
| `role: 'teacher'` + valid Identity token + grant for that school | Admitted, as a teacher |
| no `role` (student) + valid participant token | Admitted, as that participant only |

There is no path on which `role` skips a step. Both branches verify a real
credential and the teacher branch additionally requires an authorization row
covering `sessionId`'s school.
## 4.2 Client → Server Events
### heartbeat
Throttled to minimum 10s server-side. Drives last-active timestamp.
```typescript
socket.emit('heartbeat');
// No payload
```
### qc:vote
```typescript
socket.emit('qc:vote', {
  token_id: string;
  dimension: 'orthography' | 'semantics' | 'audio';
  vote_yes: boolean;
});
```
### qc:translation
```typescript
socket.emit('qc:translation', {
  token_id: string;
  translation: string;
});
```
### qc:correction
```typescript
socket.emit('qc:correction', {
  token_id: string;
  corrected_text: string;
});
```
## 4.3 Server → Client Events
### session:joined
```typescript
// Teacher receives when a new participant joins
{
  participant_id: string;
  screen_name: string;
  tier: 'lower_basic' | 'upper_basic' | 'senior_secondary' | 'adult';
}
```
### session:left
```typescript
// Teacher receives when a participant disconnects
{
  participant_id: string;
  screen_name: string;
}
```
### session:status
```typescript
// All receive on phase transition
// UI triggers a REST re-fetch of GET /session/:id/status on receipt
{
  status: 'open' | 'qc' | 'ceremony' | 'closed' | 'archived';
}
```
### token:submitted
```typescript
// Teacher + submitting student receive on new submission
{
  participant_id: string;
  completeness_signal: 'basic' | 'partial' | 'complete' | 'verified' | 'promoted';
  account_lifetime_xp: number;
}
// Full token data NOT included — teacher fetches feed via REST
```
### saturation:signal
```typescript
// Submitting student receives when word is saturated
{
  token_id: string;
  signal: 'saturated';
  // UI redirects student — do not show submit for this word again
}
```
### qc:token
```typescript
// All receive — the AUTHORITATIVE current token for QC (added `seq` 2026-08-23).
//
// Apply ONLY when `seq` exceeds the last seq this client applied. A repeat is a
// duplicate delivery; a lower value is a late delivery of a position the class
// has already left. Both are dropped, and neither is an error. This is what
// makes a client safe without a cursor of its own — see GET /session/:id/qc-state
// for the matching hydration read.
{
  seq: number;          // monotonic advance counter for this session
  token_id: string;
  text: string;
  yahura_transcription: string | null;
  yahura_confidence: number | null;
  grammar_domain: string;
  vote_orthography: { yes: number; no: number };
  vote_semantics: { yes: number; no: number };
  vote_audio: { yes: number; no: number };
  // submitter_id NEVER included
}
```
### qc:audio-ready
```typescript
// All receive — Yahura transcription arrived for token already in QC
{
  token_id: string;
  // UI fetches updated token data via REST GET /session/:id/qc-words
}
```
### qc:vote
```typescript
// All receive — vote cast
{
  token_id: string;
  dimension: 'orthography' | 'semantics' | 'audio';
  vote_counts: {
    orthography: { yes: number; no: number };
    semantics: { yes: number; no: number };
    audio: { yes: number; no: number };
  };
}
```
### qc:translation
```typescript
// All receive — translation submitted in QC
{
  token_id: string;
  // Translation content NOT included — fetch via REST if needed
}
```
### qc:correction
```typescript
// All receive — correction submitted
// Two events in sequence:
// 1. correction_needed — broadcast to all when orthography majority fails
// 2. corrected — broadcast to all after submitter submits corrected_text
// correction_needed
{
  token_id: string;
  correction_needed: true;
  // Only the original submitter shows the correction input
}
// corrected
{
  token_id: string;
  corrected: true;
  // UI advances QC state — no corrected_text broadcast
}
```
### screentime:limit-reached
```typescript
// Student receives when daily limit exhausted mid-session
{
  participant_id: string;
  reset_at: number;  // Unix timestamp
}
// Teacher also receives — to manage classroom
// UI shows ScreenTimeExceededScreen for that student
// Session ends gracefully for that student only
```
### ceremony:star
```typescript
// All receive — star announcements in the SERVER's order (added seq/total 2026-08-23).
//
// Order comes from `seq`; the client computes none of its own. Dedupe by `star`
// kind, not by seq, because the immediate announcement fired when a teacher
// assigns the Teacher's Star carries seq: null and the numbered run re-emits that
// same star later — both must resolve to one entry.
//
// BOTH emissions carry the same `xp_awarded`, read from the same game manifest.
// It is display metadata, not an increment: a client must never accumulate XP
// from these events. XP is granted server-side and read from the account (spec
// §7.2 — the client never calculates XP), so seeing a star twice cannot
// double-count anything. Dedupe by kind and the question does not arise.
{
  seq: number | null;   // position in the run; null = out-of-sequence announcement
  total: number | null; // stars in the run; null on an out-of-sequence announcement
  star: 'most_words' | 'most_sentences' | 'best_spelling' | 'discovery' |
        'speed' | 'audio' | 'teacher' | 'teacher_award';
  participant_ids: string[];
  screen_names: string[];
  xp_awarded: number;
}
```
### ceremony:end
```typescript
// All receive — the AUTHORITATIVE end of the ceremony (added stars_total 2026-08-23).
//
// This event ends the phase. A client timer may pace the reveal animation; it may
// not decide that the ceremony is over. `stars_total` lets a client that missed a
// star know its reveal was incomplete rather than silently showing a short one.
{
  session_id: string;
  total_tokens: number;
  discovery_count: number;
  stars_total: number;
}
```
---
# 5. Audio — Direct to Yahura
Audio is **never** sent to the node engine. The UI posts the audio blob directly to Yahura.
```typescript
// UI — RlcRecorder component
// src/components/RlcRecorder.tsx
const formData = new FormData();
formData.append('audio', audioBlob, 'recording.webm');
formData.append('token_id', tokenId);
formData.append('session_id', sessionId);
formData.append('language', sessionLanguage);
const yahuraResponse = await fetch(`${VITE_YAHURA_URL}/v1/transcribe`, {
  method: 'POST',
  headers: {
    Authorization: `Participant ${participantToken}`
  },
  body: formData
});
const { yahura_transcription, confidence } = await yahuraResponse.json();
// Then tell the backend the result
await fetch(`${VITE_RLC_BACKEND_URL}/api/v1/token/${tokenId}/audio-routed`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Participant ${participantToken}`
  },
  body: JSON.stringify({ yahura_transcription, yahura_confidence: confidence })
});
// Audio blob is now out of scope — GC collects it
// Backend never saw it
```
## RlcRecorder Component Contract
```typescript
// src/components/RlcRecorder.tsx
interface RlcRecorderProps {
  tokenId: string;
  sessionId: string;
  language: string;
  participantToken: string;
  onComplete: (result: { yahura_transcription: string; confidence: number }) => void;
  onError: (error: 'mic_denied' | 'upload_failed' | 'yahura_unavailable') => void;
  onSkip: () => void;
}
type RecorderState = 'idle' | 'recording' | 'uploading' | 'done' | 'error';
```
MediaRecorder format: `audio/webm;codecs=opus` with `audio/mp4` fallback for Safari.
Single button. No client-side persistence. Blob lives in memory only until upload completes.
Mic permission failure → `onError('mic_denied')` → show clear message → student can skip audio step.
---
# 6. No-Rounds Rule
There are no rounds in the RLC data model. No `current_round`. No `round_status`. No `round_number`.
The UI must not reference rounds anywhere. Remove all round-related state, props, types, and UI elements.
The game has phases: `open` → `qc` → `ceremony` → `closed`. Phase transitions arrive via `session:status` socket event.
---
# 7. Participant Token Lifecycle
```typescript
// Store in memory only
let participantToken: string = response.participant_token;
// On every GET /session/:id/status response:
if (statusResponse.participant_token) {
  participantToken = statusResponse.participant_token; // replace silently
  // This replacement must happen even during QC
  // Update the Authorization header on the next request automatically
}
// NEVER:
localStorage.setItem('participant_token', participantToken); // ❌
sessionStorage.setItem('participant_token', participantToken); // ❌
// indexedDB participant token storage // ❌
```
---
# 8. Mismatch Resolution — From Current State
These are the exact mismatches found between the current UI (PR #16) and node engine (merged branch). Each one is resolved here.
| # | Mismatch | Resolution |
| :---- | :---- | :---- |
| 1 | `session:status` — UI expected full Session object | Socket sends `{ status }` only. UI re-fetches `GET /session/:id/status` on receipt. See §4.3. |
| 2 | `GET /qc-words` — UI expected bare `QcToken[]` | Response is `{ qc_words: QcToken[] }`. UI unwraps. See §3.5. |
| 3 | `qc:correction` payload shape | Two events: `{ token_id, correction_needed: true }` then `{ token_id, corrected: true }`. See §4.3. |
| 4 | `qc:translation` payload | `{ token_id }` only. See §4.3. |
| 5 | `qc:audio-ready` payload | `{ token_id }` only. UI fetches updated data via REST. See §4.3. |
| 6 | `token:submitted` payload | `{ participant_id, completeness_signal, account_lifetime_xp }` only. See §4.3. |
| 7 | Participant token on REST | Required on every participant call as `Authorization: Participant <token>`. See §2.2. |
| 8 | `participant_id` in bodies | Never included. Derived from bearer token. See §2.2. |
| 9 | `POST /token/:id/audio` | Does not exist. Audio goes direct to Yahura. See §5. |
| 10 | Rounds concept in UI | No rounds. Remove all round state. Phase transitions only. See §6. |
| 11 | `POST /auth/login` | Does not exist. Teacher auth is `window.RLC_TEACHER_TOKEN`. See §2.1. |
| 12 | 451 on join not handled | Handle `screen_time_exceeded { reset_at }`. See §3.4. |
| 13 | Participant token refresh | Check every `GET /session/:id/status` response. Replace silently including mid-QC. See §7. |
| 14 | Backend port | `:3001`. Set `VITE_RLC_BACKEND_URL=http://localhost:3001`. |
---
*End of SPARXSTAR-3iAtlas-RLC-Contract-v1.0*
*Filename: `SPARXSTAR-3iAtlas-RLC-Contract-v1.0.md`*
*Both builders work from this document. Neither invents anything not defined here.*
