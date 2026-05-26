  
**SPARXSTAR / AI WEST AFRICA**

**Rapid Word & Sentence Collection Platform**

Technical Specification — v1.0

Starisian Technologies / AI West Africa

Confidential — April 2026

# **1\. Executive Summary**

The AIWA Rapid Collection Platform is a community-centred, classroom-deployable WordPress plugin that collects structured West African linguistic data through guided gameplay. It has two collection modes — Rapid Word Collection (RWC) and Rapid Sentence Collection (RSC) — which share a single session architecture, token pipeline, and audio submission system.

Every submission follows a canonical three-step sequence: the student types the word or sentence, provides a translation, then records their voice. All three artefacts are packaged into an immutable token envelope that travels with full provenance and rights governance from classroom to knowledge graph, feeding Sky Esu training data at every step.

| Core principle No word or sentence is ever rejected — only collected, validated, and contextualised. The community validates. The teacher approves. The pipeline preserves. This sequence is not optional. |
| :---- |

# **2\. System Context & Platform Position**

## **2.1 Plugin identity**

Plugin slug: sparxstar-ai-west-africa. Namespace: Starisian\\Sparxstar\\Aiwa. This plugin is a data collection front-end and token pipeline. It is not a dictionary, not an AI model, and not a training system. It is the structured intake layer that feeds all three.

| Layer | Responsibility |
| :---- | :---- |
| sparxstar-ai-west-africa (this plugin) | Session management, token creation, voting, promotion, REST API, frontend UI |
| sparxstar-starmus-audio | Audio capture, WAV conversion, attachment creation — fires starmus\_submission\_complete hook |
| sparxstar-sky-esu | Consumes token envelopes for AI training (Yahura ASR, Behistun translation, Esu orchestration) |
| sparxstar-helios-trust | Session authentication for teacher accounts |
| sparxstar-sirus-context | Provenance enrichment — device, network context attached to tokens |
| sparxstar-dheghom-dve-core | Long-term vault storage — all promoted words route through Dheghom (Phase 5\) |
| sparxstar-mehns-dve-core | Governance enforcement on all writes (Phase 5\) |

## **2.2 What exists in the backend today**

The following classes are implemented and production-ready in the current repo:

* AiwaSessionManager — full session lifecycle: create, join, close, archive

* AiwaTokenManager — immutable token creation, audio attachment, vote recording, validity computation

* AiwaWordManager — promotion pipeline, clean-pile entry, trigram indexing, workflow advancement

* AiwaAiFunctions — check\_saturation, save\_token, analyze\_spelling; other AI functions stubbed

* AiwaStarmusBridge — transient-based audio handoff between Starmus and save\_token

* AiwaIngestBridge — POST /aiwa/v1/ingest/word endpoint (v1 stub, logs and returns 202\)

* AiwaGamification — myCred point hooks for all game events

* AiwaHeliosAuth — Helios session verification wrapper

* AiwaCptManager — three CPTs: aiwa\_artifact, aiwa\_token, aiwa\_word

* AiwaTrigramIndex — SQL-backed trigram spelling index

| What does NOT exist Zero frontend. No REST endpoints exposed to browser clients (except the ingest stub). No session creation UI, no join screen, no collection interface, no voting board, no teacher dashboard. The frontend is the entire remaining build. |
| :---- |

# **3\. Collection Modes**

## **3.1 Mode architecture**

The teacher selects one mode per session at setup. A session cannot switch modes mid-run. Both modes use the same CPTs, the same token envelope structure, the same Starmus audio pipeline, and the same voting and promotion flow. Mode is stored as a session meta field.

## **3.2 Rapid Word Collection (RWC)**

RWC elicits individual words within a semantic domain. The AI facilitator uses the domain to prompt the student. The canonical submission sequence is:

1. Student types the word in the target language

2. Student types the translation (English or another configured language)

3. Student records the word via the Starmus audio recorder

Domain vocabulary: RWC uses the existing semantic domain system (e.g. 6.2 — Agriculture). These are the 82 Louw-Nida-derived domains already in scope for the AIWA knowledge graph.

## **3.3 Rapid Sentence Collection (RSC) — new in this spec**

RSC elicits short sentences that exemplify one of 12 grammar domain categories. The submission sequence is identical to RWC:

4. Student types the sentence in the target language

5. Student types the translation

6. Student records the sentence via Starmus audio

The 12 grammar domains for RSC are:

| Domain | Description | Example prompt |
| :---- | :---- | :---- |
| Noun Phrase | The subject | "Name the person doing the action" |
| Verb Phrase | The action | "Describe what someone is doing" |
| Adjective | Describing the noun | "Describe what something looks like" |
| Adverb | How the action happens | "Describe how someone does something" |
| Possession | Pronoun — my, his, her | "Say who owns something" |
| Numeric | Number or quantity | "Describe how many of something" |
| Interjection | Exclamation or emotion | "Express surprise or greeting (e.g. Kai\!)" |
| Conjunction | Connecting ideas | "Connect two thoughts with and or but" |
| Type | Classifying an object | "Name what kind of thing this is" |
| Question | Asking something | "Ask a question about the picture" |
| Formal | Respectful language for elders | "Greet an elder respectfully" |
| Informal | Casual language for friends | "Greet a friend your own age" |

Grammar domain is stored in the token envelope provenance as grammar\_domain, parallel to semantic\_domain in RWC. The two fields are mutually exclusive per token.

# **4\. Data Model**

## **4.1 Session meta fields (aiwa\_artifact)**

All existing session fields remain unchanged. Two new fields are added:

| Field | Description |
| :---- | :---- |
| teacher\_id | WordPress user ID of the facilitator |
| school\_id | School / site identifier |
| semantic\_domain\_id | Louw-Nida domain code (RWC mode only, e.g. "6.2") |
| session\_language | BCP-47 or AIWA language code (e.g. "mandinka") |
| duration\_minutes | Session duration (default 15\) |
| session\_code | 6-character uppercase alphanumeric join code |
| status | open | closed | archived |
| started\_at / ended\_at | Unix timestamps |
| session\_rights | Default rights object inherited by all tokens |
| participants | Keyed array: participant\_id → { display\_name, joined\_at } |
| collection\_mode \[NEW\] | "rwc" or "rsc" — set at session creation, immutable |
| grammar\_domain \[NEW\] | RSC mode only — one of the 12 grammar domain slugs |

## **4.2 Token envelope (aiwa\_token) — extended for RSC**

The existing envelope structure is preserved exactly. RSC extends the payload and provenance objects with two additional fields:

| Existing envelope (unchanged) uuid | payload: { text, definition, audio\_id } | provenance: { user\_id, session\_id, semantic\_domain, language, timestamp } | rights: { license, ai\_training, commercial } | processing\_status | validity: { orthography, semantics, audio } | votes: { orthography, semantics, audio } |
| :---- |

| Field path | RSC addition |
| :---- | :---- |
| payload.text | For RSC: the full sentence (not a single word). No structural change required — the field accepts arbitrary UTF-8 text. |
| payload.translation | NEW — student-provided translation of the word or sentence. Empty string for tokens submitted before translation step completes. |
| provenance.grammar\_domain | NEW — one of the 12 RSC grammar domain slugs. Empty string for RWC tokens. |
| provenance.collection\_mode | NEW — "rwc" or "rsc". Allows downstream systems to distinguish token types without inspecting session meta. |

| Immutability rule Tokens remain append-only. The translation field is populated at token creation time (step 2 completes before save\_token is called). Audio is attached via the Starmus bridge as in existing behaviour. No token is ever edited after creation. |
| :---- |

## **4.3 Token submission state machine**

The frontend must enforce the three-step sequence before calling save\_token. The state machine per submission is:

| State | Condition to advance |
| :---- | :---- |
| IDLE | Student has not started this submission |
| TYPED | text field is non-empty and student has confirmed |
| TRANSLATED | translation field is non-empty and student has confirmed |
| RECORDED | Starmus fires starmus\_submission\_complete; transient is set |
| SAVED | save\_token REST call returns success |

Advancing to SAVED is only permitted from the RECORDED state. The frontend must block the save call if audio has not been recorded. The Starmus bridge handles the audio\_id transparently — the frontend does not pass audio\_id directly.

# **5\. REST API Contract**

All endpoints live under the aiwa/v1 namespace. The following endpoints must be built. The ingest endpoint (POST /aiwa/v1/ingest/word) already exists as a stub.

## **5.1 Session endpoints**

| Endpoint | Description |
| :---- | :---- |
| POST /aiwa/v1/session/create | Create a new session. Teacher auth required. Body: { collection\_mode, language, semantic\_domain\_id (RWC) or grammar\_domain (RSC), duration\_minutes, rights }. Returns: { session\_id, join\_code, qr\_code\_url }. |
| POST /aiwa/v1/session/join | Join a session as a student. No auth required. Body: { join\_code, display\_name }. Returns: { session\_id, participant\_id, session\_language, collection\_mode }. |
| GET /aiwa/v1/session/{id}/status | Poll session status and live stats. Returns: { status, participant\_count, token\_count, time\_remaining\_seconds }. |
| POST /aiwa/v1/session/{id}/close | Close session (end collection phase). Teacher auth required. |
| GET /aiwa/v1/session/{id}/report | Full session report for teacher dashboard. Teacher auth required. |

## **5.2 Token endpoints**

| Endpoint | Description |
| :---- | :---- |
| POST /aiwa/v1/token/save | Create a token. Body: { session\_id, participant\_id, text, translation, collection\_mode, grammar\_domain (RSC), provenance, rights }. Returns: { token\_id, success, saturation\_signal }. |
| POST /aiwa/v1/token/{id}/vote | Cast a vote on one dimension. Body: { dimension (orthography|semantics|audio), vote\_yes, voter\_id }. Returns: { success, new\_validity }. |
| GET /aiwa/v1/session/{id}/tokens | Return all tokens for a session (voting board). Teacher auth required. |

## **5.3 Word promotion endpoint**

| Endpoint | Description |
| :---- | :---- |
| POST /aiwa/v1/word/{id}/promote | Advance a word to community\_verified or expert\_verified. Teacher auth required. Body: { new\_state }. |

## **5.4 Authentication model**

Teacher endpoints require a valid Helios session JWT (Authorization: Bearer \<token\>) or manage\_options capability for v1 admin use. Student endpoints (join, token/save, vote) require only a valid participant\_id issued by the join endpoint — no WordPress account needed. The participant\_id is session-scoped and expires with the session.

# **6\. Frontend Architecture**

## **6.1 Delivery target**

The frontend is a React Single Page Application registered as a WordPress plugin page and mounted via wp\_enqueue\_scripts. It communicates exclusively with the REST API endpoints defined in Section 5\. The PHP plugin layer is the data source; the React app is the presentation layer only.

Build tooling: @wordpress/scripts (webpack). Output: assets/js/aiwa-frontend.js, assets/css/aiwa-frontend.css. Enqueued on a dedicated WordPress page template (page-aiwa-collection.php).

## **6.2 Screen map — Teacher flow**

| Screen | Description |
| :---- | :---- |
| T1 — Session Setup | Teacher selects: collection mode (RWC or RSC), language, domain (semantic for RWC, grammar for RSC), duration, rights preset. On submit: calls POST /session/create. Transitions to T2. |
| T2 — Live Session Monitor | Displays join code (large, readable) and QR code. Shows live participant count and rolling token feed. Polls GET /session/{id}/status every 5 seconds. Teacher can end session → calls POST /session/{id}/close → transitions to T3. |
| T3 — Voting Board | Grid of all submitted tokens. Each card shows: text, translation, audio player, three vote tallies (orthography, semantics, audio), current validity state. Teacher can promote words to clean pile → calls POST /word/{id}/promote. Export option triggers ingest queue. |

## **6.3 Screen map — Student flow**

| Screen | Description |
| :---- | :---- |
| S1 — Join | Full-screen join. Large code entry (6 characters, auto-uppercase). Display name field. On submit: calls POST /session/join. Returns to S2. |
| S2 — Collection (RWC) | Three sequential panels: (1) Word entry with language-aware keyboard support and special character picker; (2) Translation entry; (3) Starmus audio recorder widget. Submit button active only in state RECORDED. XP counter in header. |
| S3 — Collection (RSC) | Identical structure to S2 but panel (1) label reads "Your sentence" and the grammar domain prompt is shown as a context card above the input (e.g. "Write a sentence using possession — my, his, her, their"). |
| S4 — Session End | Summary screen: words/sentences contributed, XP earned, discovery count. Thank-you message. No navigation — session is over. |

## **6.4 Special character support**

West African languages require extended Latin characters unavailable on standard mobile keyboards. The frontend must include a special character picker that appears below any text input in collection screens. Required minimum character set for Mandinka:

* ŋ (eng) — the single highest-risk character for community participation

* ɓ ɗ (implosives)

* ñ

* Long vowels: aa ee ii oo uu (digraph buttons, not Unicode combining)

The character picker must be tap-friendly (minimum 44px touch target), visible without scrolling on a 360px wide viewport, and insert at the cursor position without replacing selected text.

## **6.5 Starmus audio integration**

The Starmus audio recorder widget is a separate WordPress plugin (sparxstar-starmus-audio) that exposes a JavaScript mount point. The AIWA frontend mounts the Starmus widget inside the recording panel (step 3 of collection). On recording completion, Starmus fires a custom DOM event (starmus:complete) which the AIWA frontend listens to in order to advance the submission state machine from RECORDED to ready-to-save.

The PHP-side handoff (transient keyed by user/session) is already implemented in AiwaStarmusBridge. The frontend does not need to pass audio\_id to save\_token — the bridge handles it transparently. The frontend's only responsibility is to block the save call until the starmus:complete event has fired.

| Starmus event contract Frontend listens for: window.addEventListener("starmus:complete", handler). Starmus dispatches with detail: { attachment\_id, post\_id }. AIWA frontend advances state to RECORDED and enables the Save button. No audio\_id is passed to the save\_token REST call — the PHP bridge consumes the transient. |
| :---- |

# **7\. Gamification**

All gamification hooks are implemented in AiwaGamification. The frontend is responsible only for displaying point events — it does not calculate or store points.

| Event | Award |
| :---- | :---- |
| Token submitted (word or sentence) | \+10 XP |
| Audio submitted with token | \+20 XP |
| Vote cast | \+5 XP |
| Token reaches consensus | \+100 Gold |
| New dictionary discovery | \+50 Gold |
| Combo breaker (5 valid tokens in 2 min) | Badge |

The frontend polls GET /session/{id}/status to retrieve running XP totals per participant. A lightweight leaderboard is shown on the Teacher monitor (T2) ranked by XP. Student screens show only their own score.

# **8\. AI Facilitator**

The AI facilitator runs as the LibreChat conversation thread. It is not a separate component — it is the configured system prompt for the session, constructed from session parameters at session creation time.

## **8.1 RWC system prompt template**

You are a curious field linguist learning {language}.

Current domain: {semantic\_domain\_name} (ID: {semantic\_domain\_id}).

Students are in {region}. Elicit words for this domain.

Ask broad questions first. Follow up on specifics.

Do not interrupt a student mid-thought. One question at a time.

Call check\_saturation({word}, {session\_id}) after each submission.

If saturated: redirect to a related sub-domain.

## **8.2 RSC system prompt template**

You are a patient language teacher helping students practise {language} sentences.

Today's grammar focus: {grammar\_domain\_name} — {grammar\_domain\_description}.

Ask the student to construct a short sentence demonstrating this grammar pattern.

Provide one example in English first. Then ask for their sentence.

After each submission, affirm the contribution and offer one gentle observation.

## **8.3 AI functions available**

| Function | Status |
| :---- | :---- |
| check\_saturation(word, session\_id) | Implemented — returns { count, saturated, signal } |
| save\_token(text, definition, audio\_id, provenance, rights) | Implemented — creates aiwa\_token; Starmus bridge handles audio\_id transparently |
| analyze\_spelling(text, language) | Implemented — trigram similarity, returns { score, signal, matched\_lemma } |
| entity\_extraction() | Stub — returns not-implemented |
| prosody\_analysis() | Stub — returns not-implemented |
| training\_pipeline() | Stub — returns not-implemented |
| blockchain\_hash() | Stub — returns not-implemented |

# **9\. Backend Changes Required**

The following changes to the existing PHP plugin are required to support this specification. No existing classes are deleted. All changes are additive or extend existing methods.

## **9.1 AiwaSessionManager — additions**

* create\_session() must accept collection\_mode ("rwc" or "rsc") and grammar\_domain (RSC only) in the config array and store them as session meta.

* get\_session\_report() must return collection\_mode and grammar\_domain in its response array.

## **9.2 AiwaTokenManager — additions**

* create\_token() payload must accept translation (string) as an optional field alongside existing text, definition, audio\_id.

* create\_token() provenance must accept grammar\_domain and collection\_mode as optional fields.

* The token envelope must store these additional fields in payload.translation, provenance.grammar\_domain, and provenance.collection\_mode.

## **9.3 AiwaAiFunctions — additions**

* save\_token() must accept and pass through the translation, grammar\_domain, and collection\_mode fields.

## **9.4 New class: AiwaRestApi**

A new class AiwaRestApi must be created to register all REST endpoints defined in Section 5\. This class does not exist in the current repo. It should follow the same pattern as AiwaIngestBridge: register\_hooks() adds to rest\_api\_init, each endpoint has its own handler and permission\_callback.

## **9.5 What does NOT change**

* All three CPTs (aiwa\_artifact, aiwa\_token, aiwa\_word) — no changes needed

* AiwaWordManager — no changes needed

* AiwaStarmusBridge — no changes needed

* AiwaGamification — no changes needed

* AiwaHeliosAuth — no changes needed

* AiwaTrigramIndex — no changes needed

* AiwaIngestBridge — no changes needed (will be replaced in Phase 5\)

# **10\. Sky Esu Integration**

Every token envelope — word and sentence — feeds Sky Esu as training data. Sky Esu consumes three artefacts from each token:

* text — the typed word or sentence (trains Behistun orthography and translation models)

* translation — the student-provided translation (parallel corpus for Behistun)

* audio\_id → resolved audio file (trains Yahura ASR model via the correction loop)

The integration point is the aiwa\_token\_created action hook, already fired by create\_token(). Sky Esu registers a listener on this hook and processes the envelope asynchronously. No synchronous call from AIWA to Sky Esu occurs — the hook is fire-and-forget from AIWA's perspective.

| Training data quality gate Only tokens where validity.orthography \= verified AND validity.audio \= verified are eligible for Yahura ASR training. All tokens (regardless of validity) contribute to the Behistun parallel corpus, since disputed translations are valuable training signal. This gate is enforced by Sky Esu, not by AIWA. |
| :---- |

# **11\. Build Order**

| Phase | Work |
| :---- | :---- |
| Phase 1 — Backend extension | Add collection\_mode and grammar\_domain to AiwaSessionManager. Add translation, grammar\_domain, collection\_mode to AiwaTokenManager envelope. Update AiwaAiFunctions.save\_token() accordingly. |
| Phase 2 — REST API | Build AiwaRestApi class with all endpoints from Section 5\. Wire into register\_hooks(). Add nonce and participant\_id auth for student endpoints. |
| Phase 3 — Teacher UI | Build React app scaffold. Session setup screen (T1). Live monitor screen (T2) with polling. QR code display. |
| Phase 4 — Student UI | Join screen (S1). RWC collection screen (S2) with special character picker. RSC collection screen (S3). Starmus widget mount. Three-step state machine enforcement. |
| Phase 5 — Voting & Promotion | Voting board screen (T3). Vote casting UI per token. Promote-to-clean-pile action. Teacher report view. |
| Phase 6 — Polish & CI | End-to-end test (one session → one promoted word with audio → one ingest payload). CI pipeline. PHPCS and PHPStan on all new PHP. Jest on REST client layer. |

# **12\. Non-Negotiables**

These constraints apply from day one of any build and may not be deferred, worked around, or overridden by any AI coding agent:

* Token immutability — tokens are append-only from the moment of creation

* Rights object on every token — set at ingest, never stripped, never defaulted to false for ai\_training without explicit user consent

* Two-pile separation — tokens never go directly to aiwa\_word; promotion pipeline is always enforced

* Human authority at promotion — teacher explicitly approves before a word enters the clean pile

* Three-step submission sequence — text → translation → audio, in that order, enforced by the frontend state machine

* Audio required before save — save\_token may not be called until starmus:complete has fired for this submission

* Tripartite validation — orthography, semantics, and audio validity are always independent dimensions

* No word is ever rejected — all text is collected; only contextualised and validated

* Grammar domain is immutable per session — set at creation, cannot be changed mid-session

# **13\. Explicitly Deferred**

These items are not cut — they are stubbed with interfaces in place for Phase 5+ implementation:

* Blockchain hashing — stub returns not-implemented

* Entity extraction — stub returns not-implemented

* Prosody analysis — stub returns not-implemented

* Editorial board workflow — teacher approval is sufficient for v1

* Multi-game engine — RWC and RSC are modes one and two; the container exists

* Global student accounts — session-scoped identity is sufficient for v1

* Revenue split — rights object is in place; calculation deferred to Phase 5

* Dheghom vault integration — ingest bridge is a stub; full DAL wiring in Phase 5

* Mēh₁n̥s governance enforcement — deferred to Phase 5

# **14\. Licence & Patent Notice**

| Proprietary & Patent Pending This specification and the software it describes are proprietary to Starisian Technologies. All rights reserved. PATENTS PENDING — invention date April 10, 2026, inventor Max Barrett / Starisian Technologies. No portion of this document or the described system may be reproduced, disclosed, or implemented outside of a Starisian Technologies Service Agreement or Commercial License without prior written permission. |
| :---- |

