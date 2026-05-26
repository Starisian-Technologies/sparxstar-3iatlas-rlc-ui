# Integration Contract — UI ↔ `sparxstar-3iatlas-rlc`

Field-by-field contract between this UI and the `sparxstar-3iatlas-rlc`
WordPress plugin, **verified against the backend source** (`src/AiwaRestApi.php`,
`src/AiwaSessionManager.php`). Line references below point into that plugin.

**UI source of truth:** `src/api/client.ts` (calls) and `src/types/index.ts`
(shapes). **Backend namespace:** `aiwa/v1` (`AiwaRestApi::REST_NAMESPACE`), mounted
by WordPress at `/wp-json/aiwa/v1`.

**Legend:** ✅ aligned · ❌ confirmed mismatch (breaks at runtime) · ⚠️ partial / degrades · ℹ️ note

Run `RLC_SMOKE_BASE=<url> npm run smoke` against a live backend to re-verify.
The UI side of **B** (participant_id) is now fixed; until the backend lands **B2**
(qc-words rename) the smoke test will still flag the `vote_*` field names — that is
intended.

---

## Confirmed breakages (fix before an end-to-end session works)

### A. Teacher endpoints reject the UI — no auth sent ❌
`permission_teacher` requires a Helios session or `current_user_can('manage_options')`
(`AiwaRestApi.php:286-292`). The UI sends **no** `Authorization` header anywhere
(`src/api/client.ts:35-50`), so an anonymous client gets 401/403 on
`session/create`, `session/{id}/close`, and `teachers-star` — it cannot even
create a session. (Student endpoints use `permission_open` → `true`
(`AiwaRestApi.php:302`), so join/status/token/vote/etc. are open.)
**Fix:** decide the teacher-auth model and have the UI obtain + send a Helios
Bearer token (or run the teacher screens inside an authenticated WP admin session).

### B. `vote` / `translate` / `correct` omit `participant_id` → 403 ❌
The backend reads `participant_id` from the request and **requires** it:
- vote: must be in session participants (`AiwaRestApi.php:1036,1063`)
- translate: same (`:1114,1130`)
- correct: must equal the original submitter (`:1166,1180`)

But the UI sends only the path id + body — `vote(token_id, { dimension, vote_yes })`,
`submitTranslation(token_id, translation)`, `correct(token_id, corrected_text)`
(`src/api/client.ts:102-121`); `VotePayload` is `{ dimension, vote_yes }`
(`src/types/index.ts:94`). **Every QC vote, translation, and correction returns
403 `unauthorized`.** The whole QC interaction is broken.
**Fix (UI-side, low-risk):** include `participant_id` in all three bodies.

### G. `qc-words` vote fields are renamed / missing ❌
Backend returns per token: `vote_spelling {yes,no}` and `vote_meaning {yes,no}`
(`AiwaRestApi.php:637-644`) — and **no** audio votes. The UI's `QcToken` expects
`vote_orthography`, `vote_semantics`, **and** `vote_audio` (`src/types/index.ts:83-85`).
So the QC board reads three fields that are all absent → vote counts render empty
or throw on `.yes`/`.no` access.
**Fix:** rename backend → `vote_orthography`/`vote_semantics`, or remap in the UI;
drop or supply `vote_audio`. Also `token_id` is an **int** here (`:632`) but a
**string** from `token/save` (`:1015`) — pick one (UI types it `string`).

### H. RSC per-sentence `grammar_domain` is dropped ❌
RSC sends a different `grammar_domain` per sentence (12 domains). But
`handle_token_save` reads `grammar_domain` from **session meta**, not the request
(`AiwaRestApi.php:958`), and `session/create` has no `grammar_domain` field — so it
is always empty. Every RSC token is stored with an empty grammar domain; the
UI's per-sentence value never reaches storage.
**Fix:** read `grammar_domain` from the request param in `handle_token_save`.

### C. REST mount path / `RLC_API_BASE` ⚠️
Namespace `aiwa/v1` is correct (`AiwaRestApi.php:47`), so the v2.1 spec's `/api/v1`
is stale. But WordPress serves it at **`/wp-json/aiwa/v1`**, while the UI base is
`window.RLC_API_BASE ?? '/aiwa/v1'` (`src/api/client.ts:31-33`) and the Vite dev
proxy forwards `/aiwa` (not `/wp-json/aiwa`) (`vite.config.ts:47-55`). Unless the
plugin injects `window.RLC_API_BASE = '/wp-json/aiwa/v1'` (or a rewrite maps
`/aiwa/v1` → `/wp-json/aiwa/v1`), every call 404s.
**Fix:** confirm the plugin's asset loader injects `RLC_API_BASE`; point the dev
proxy at `/wp-json`.

### I. RWC "rounds" don't exist in the backend ⚠️
`status` returns only `status`, `participant_count`, `token_count`,
`time_remaining_seconds`, `leaderboard` (`AiwaRestApi.php:499-507`). The UI's
`Session` and `RwcCollectionScreen` consume `current_round`, `total_rounds`,
`round_goal`, `round_status`, `next_round_starts_in_seconds`, `semantic_domain_id`,
`participants[]` — none are sent. The backend models a **single timed session**;
the UI models **multiple rounds**. Result: round counter shows 1/5, goal 10, the
prompt word shows "TARGET WORD", and round-complete never fires.
**Fix:** either add round fields server-side or drop the round UI's dependence on them.

---

## Verified aligned ✅ (earlier concerns, now cleared by the source)

- **Session status enum** — backend constants are exactly `open|closed|archived|qc|ceremony` (`AiwaSessionManager.php:26-54`); matches `SessionStatus`. Flow: open →`close`→ closed →(`start_qc_phase`)→ qc →(GET `awards`)→ ceremony. The merged `qc/closed`→QC and `ceremony/archived`→ceremony routing is correct.
- **Responses are unwrapped** — handlers return the payload directly; no `{ success, data }` envelope.
- **`token/save` response** — returns `token_id`, `spelling_signal`, `saturation_signal`, `spelling_score`, `xp_awarded` (`AiwaRestApi.php:1013-1021`); matches `SaveTokenResponse`. `spelling_signal` ∈ `confirmed|variant|discovery` via the signal map (`:75-79`).
- **`events/batch`** — returns `{ accepted, failed }` (`:1310-1316`); UI's optional `accepted_event_ids` is harmless. Idempotent by `event_id`. Note: the backend does **not** reject unknown `event_type` values (`:1241-1251`), so event-enum drift causes no data loss (downgrades earlier risk E).
- **`vote` response** — `{ success, vote_counts: {yes,no} }` (`:1094-1100`); matches `VoteResponse`.

## Notes ℹ️

- **`saturation_signal`** — backend returns `'saturated'` or **`'continue'`** (`:1011`), not `'ok'`. The UI only branches on `=== 'saturated'`, so the redirect works, but the type `'ok' | 'saturated'` (`src/types/index.ts:55`) is wrong — should be `'saturated' | 'continue'`.
- **Vote dimension `'audio'`** — backend allows only `orthography|semantics` (`:68`, rejects others with 400 at `:1040`), but `VotePayload.dimension` includes `'audio'`. The QC screen never sends audio, so this is latent.
- **`token/save` overrides `collection_mode`** from session meta (`:960-962`), ignoring the request value — harmless.

---

## Per-endpoint summary

| Endpoint | Auth | Verdict |
|---|---|---|
| POST `/session/create` | teacher | ❌ A (needs auth) · shape ✅ |
| POST `/session/join` | open | ✅ |
| GET `/session/{id}/status` | open | ⚠️ I (no round fields) |
| POST `/session/{id}/close` | teacher | ❌ A |
| GET `/session/{id}/qc-words` | open | ❌ G (vote field names) |
| GET `/session/{id}/awards` | open | ✅ (also flips status→ceremony) |
| POST `/session/{id}/teachers-star` | teacher | ❌ A |
| POST `/token/save` | open | ✅ (RWC) · ❌ H (RSC grammar_domain) |
| POST `/token/{id}/vote` | open | ❌ B (no participant_id) |
| POST `/token/{id}/translate` | open | ❌ B |
| POST `/token/{id}/correct` | open | ❌ B |
| POST `/events/batch` | open | ✅ |

---

## Reconciliation checklist

Decisions locked: teacher auth = **Helios JWT**; QC vote fields = **backend renames**; RWC rounds = **backend adds rounds**.

UI-side (this repo):
- [x] Add `participant_id` to vote / translate / correct bodies (fixes **B**).
- [x] Keep `vote_orthography`/`vote_semantics`; make `vote_audio` optional (UI side of **G**).
- [x] Type `saturation_signal` as `'saturated' | 'continue'`.
- [x] Point the dev proxy at `/wp-json` so dev hits the real route (**C**).
- [ ] Acquire + send `Authorization: Bearer <Helios JWT>` on teacher endpoints (**A**, ticket U3 — blocked on where the token comes from).
- [ ] Confirm the plugin injects `window.RLC_API_BASE` in production (**C**, backend B3).

Backend-side (needs a PR to `sparxstar-3iatlas-rlc`):
- [ ] Read `grammar_domain` from the request in `handle_token_save` (fixes **H**, B1).
- [ ] Rename `vote_spelling`/`vote_meaning` → `vote_orthography`/`vote_semantics` (+ `vote_audio`) in `qc-words` (**G**, B2).
- [ ] Document the Helios teacher-auth flow + return clean 401 (**A**, B4).
- [ ] Add `current_round`/`total_rounds`/`round_goal`/`round_status` to `status` (**I**, B5).
- [ ] Return `token_id` as a string in `qc-words` (B6).
- [ ] Inject `window.RLC_API_BASE` + CORS; stand up staging + a test teacher JWT (B3/B7).

Then: `RLC_SMOKE_BASE=<staging>/wp-json/aiwa/v1 RLC_SMOKE_WRITE=1 RLC_SMOKE_TOKEN=<jwt> npm run smoke` and clear every reported mismatch.
