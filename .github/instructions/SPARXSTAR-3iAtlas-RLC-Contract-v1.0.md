# SPARXSTAR 3iAtlas RLC — Integration Contract v1.0
### Starisian Technologies · Confidential · May 2026

---

> **Status: `supporting`** — v4.0 (canonical) delegates the **wire surface**
> to this document; this document is the sole home for wire shape and does
> **not** govern behavior (see this repo's `AGENTS.md` for the Status-field
> system). Added 2026-08-01 (R1 status-header audit) — this repo's copy of
> this file was missing the Status field its node-engine twin already
> carries.

---

| ⚠️ COORDINATION DOCUMENT — ALL THREE REPOS |
| :---- |
| This document defines the exact contract between `sparxstar-3iatlas-rlc-ui` and `sparxstar-3iatlas-rlc-node-engine`. |
| Neither repo invents anything not defined here. |
| If something is missing — raise it. Do not assume. |
| If this document and the spec conflict — this document wins for implementation detail. |

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
Authorization: Bearer <helios_jwt>
```

JWT is injected by the WordPress orchestrator as `window.RLC_TEACHER_TOKEN`. The UI reads it from the window object. The UI never calls a login endpoint. There is no `POST /auth/login`.

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
Auth: `Participant <token>`

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
// 403
{ error: 'unknown_screen_name' } // UI does the i18n; wire body is just { error }
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
  participant_count: number;
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
Auth: **None** — the same posture as `GET /session/:id/qc-words` below, and
deliberately no wider: this returns one token from the list that endpoint already
serves unauthenticated. **Added 2026-08-23.**

> **Pre-existing exposure, not introduced here.** `qc-words` and `awards` are also
> unauthenticated, so a caller who knows a `session_id` can read decrypted QC text
> without a participant token. That predates this endpoint and is unchanged by it;
> it is called out because adding a second endpoint with the same posture is a
> reasonable moment to notice. Tightening all three together is a contract change
> and is not attempted here.

The authoritative current QC position — the hydration and reconnection read. A
client calls this on mount, on reconnect, and after a reload, and lands exactly
where the class is. It **advances nothing**: only `POST /session/:id/qc-advance`
moves anyone, and that is teacher-only.

`seq` matches the last emitted `qc:token.seq`, so a client can tell whether a
socket event it already holds is newer than the state it just fetched — and must
not let an older fetched position overwrite a newer event.

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
Auth: `rlc:teacher`

Request: empty body

Response 200:
```typescript
{
  success: true;
  token_id: string;  // next QC token
}
```

Sets `teacher_advanced_qc = true` on first call. Broadcasts `qc:token` socket
event with the new `seq`.

The advance is a compare-and-set. Two simultaneous clicks both select the same
next token, so exactly one lands; the other returns `409 { error:
'qc_advance_conflict' }` and broadcasts nothing. A client receiving that should
re-read `GET /session/:id/qc-state` rather than assume either outcome. `409 {
error: 'qc_exhausted' }` means there is nothing left to advance to.

### GET /session/:id/qc-words
Auth: None

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
Auth: None

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
  translation: string;        // empty string if basic depth
  collection_mode: 'rwc' | 'rsc';
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
Auth: Yahura MCP (HMAC) — or Participant token when UI is the intermediary

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
Auth: `Participant <token>`

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
    role: 'teacher',
    token: window.RLC_TEACHER_TOKEN,  // Identity-issued token. Proves identity
                                      // only — the handshake additionally requires
                                      // an RLC authorization record, so `role`
                                      // below is a routing hint, not a claim.
    sessionId: sessionId
  }
});
```

Bad or missing auth → connection rejected with `unauthorized`. Handle gracefully — show rejoin prompt.

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
  token_id: string;
  session_id: string;
  language: string;
  word: string;
  participant_token: string | null;
  maxSeconds?: number;  // default 5
  onComplete: (result: { yahura_transcription: string; confidence: number }) => void;
  onError?: (error: 'mic_denied' | 'upload_failed' | 'yahura_unavailable') => void;
  onSkip: () => void;
}

type RecorderState = 'idle' | 'requesting' | 'recording' | 'uploading' | 'done' | 'error';
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

*Commit to `.github/instructions/` in all three repos.*

*Both builders work from this document. Neither invents anything not defined here.*
