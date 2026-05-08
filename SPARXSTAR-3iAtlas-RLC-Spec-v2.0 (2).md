

| 3iATLAS RAPID LANGUAGE COLLECTION (RLC) *Technical Specification v2.0* |
| :---: |

Starisian Technologies  ·  SPARXSTAR Platform

**Africa First  ·  Mobile First  ·  Mother Tongue First**

April 2026  ·  Confidential

| Purpose:  This document is the authoritative specification for sparxstar-3iatlas-rlc. |
| :---- |
| It is written for GitHub Copilot to build from. Every architectural decision is locked. |
| Do not deviate from this spec without explicit written approval from Max Barrett. |

# **1\. Overview & Mission**

The 3iAtlas Rapid Language Collection (RLC) is a classroom-deployable web application that collects structured linguistic data through guided gameplay. It is a standalone tool — it does not depend on WordPress, DVE, or any SPARXSTAR runtime pipeline. It runs anywhere a modern browser runs.

| Mission:  Gambia is teaching mother tongue. Students need a tool built for their language. |
| :---- |
| RLC is that tool — fast, mobile-first, Africa-first, designed for a cheap Android phone on a variable data connection in a real classroom. |
| Everything collected feeds the language knowledge base over time. The game is how the data gets collected. |

## **1.1 What RLC Is**

* A real-time classroom game run by a teacher, played by students on their phones

* A linguistic data collection tool disguised as an engaging activity

* A community validation system — the class votes, not just one authority

* Mobile-first: designed for 360px viewport, low-end Android, variable connectivity

* Standalone: React \+ Node, no WordPress dependency, no DVE runtime dependency

## **1.2 What RLC Is Not**

* Not a dictionary — it consumes the dictionary export, it does not write to it

* Not a DVE component — data flows out of RLC separately; that pipeline is not RLC's concern

* Not an AI training system — Sky AI is a trained model, not a repo dependency

* Not a WordPress plugin — the WordPress era of this spec is over

## **1.3 Suite Context**

RLC is one of four tools in the 3iAtlas suite. All four are standalone and independent:

| Repo | Purpose |
| :---- | :---- |
| **sparxstar-3iatlas-dictionary** | DVE export — the shared word knowledge base. Read-only at runtime. |
| **sparxstar-3iatlas-wordpad** | Language-aware writing tool. Google Docs for underserved languages. Standalone app. |
| **sparxstar-3iatlas-rlc** | This repo. Classroom collection game. |
| **sparxstar-3iatlas-games** | Vocabulary and spelling games built on the dictionary. Future. |

| Dependency rule:  These repos consume data from the SPARXSTAR data layer. They do not participate in it. |
| :---- |
| The dictionary is a DVE export — a read-only snapshot. RLC, wordpad, and games read from it. |
| DVE → export → 3iAtlas dictionary → RLC / wordpad / games |
| No reverse flow. No live DVE connection at runtime. |

# **2\. Game Modes**

RLC has two modes: Rapid Word Collection (RWC) and Rapid Sentence Collection (RSC). The teacher selects the mode when creating a session. A session cannot switch modes mid-run. Both modes follow the same three-phase structure.

## **2.1 Three-Phase Structure — Both Modes**

| Phase | Description |
| :---- | :---- |
| **Phase 1 — Collection** | Students submit words or sentences during a timed session. Teacher monitors live. |
| **Phase 2 — QC Review** | The class reviews 5–10 selected submissions together. Community validation. |
| **Phase 3 — Awards** | Points calculated, stars awarded, leaderboard displayed. Fireworks. |

## **2.2 Session Configuration — Teacher Sets at Startup**

| Setting | Options / Notes |
| :---- | :---- |
| **Mode** | RWC (words) or RSC (sentences) |
| **Language** | Select from supported languages (e.g. Mandinka, Wolof, Fula) |
| **Semantic Domain** | One domain from the dictionary export (e.g. Agriculture 6.2, Family 2.1) |
| **Duration** | 5 / 10 / 15 / 20 minutes (default 15\) |
| **Collection Depth** | Full (word \+ translation \+ recording) | Translation Only (no recording) | Basic (word only) |

| Collection Depth — why it matters:  Full: word/sentence \+ translation \+ audio recording. Maximum data. Vital for the linguistic work. |
| :---- |
| Translation Only: word/sentence \+ translation. No recording. Lighter session, still captures meaning. |
| Basic: word/sentence only. No translation, no recording. Any grade level, pure vocabulary practice. |
| The QC phase and awards ceremony run in all three modes. The game always ends with recognition. |

## **2.3 Rapid Word Collection (RWC)**

Students submit individual words within the selected semantic domain. The AI facilitator prompts based on the domain and redirects if too many students submit the same word.

### **Collection Phase — per submission**

| Step | Student Action |
| :---- | :---- |
| **1 — Word** | Types the word in the target language. Wordpad provides spelling support against dictionary export. |
| **2 — Translation** | Types the translation in English or French. (Full and Translation Only modes only.) |
| **3 — Recording** | Records themselves saying the word using the Starmus audio widget. (Full mode only.) |
| **4 — Submit** | Submit button active only when required steps for the selected depth are complete. |

## **2.4 Rapid Sentence Collection (RSC)**

Students write short sentences within the selected semantic domain. The game automatically sequences through all 12 grammar domains — one sentence per domain. A session is complete when a student has submitted all 12\. The teacher does not select the grammar domain — the game owns that sequence.

| RSC Design Principle:  This follows the traditional learning model: learn the word, then learn to write sentences with the word. |
| :---- |
| RWC first, RSC second — the natural pedagogical progression. |
| Short sentences only — AI-training quality. Not essays. One clear idea per sentence. |

### **The 12 Grammar Domains — Fixed Game Sequence**

| \# | Domain | Prompt shown to student | Underlined element |
| :---- | :---- | :---- | :---- |
| 1 | Noun Phrase | Name the person or thing doing the action | The subject noun |
| 2 | Verb Phrase | Describe what someone is doing | The main verb |
| 3 | Adjective | Describe what something looks like or feels like | The describing word |
| 4 | Adverb | Describe how someone does something | The manner word |
| 5 | Possession | Say who owns something (my, his, her, their) | The possessive word |
| 6 | Numeric | Describe how many of something there are | The number or quantity |
| 7 | Interjection | Express surprise, greeting, or emotion (e.g. Kai\!) | The exclamation |
| 8 | Conjunction | Connect two thoughts with and, but, or because | The connecting word |
| 9 | Type / Classifier | Name what kind of thing this is | The classifier word |
| 10 | Question | Ask a question about something in the domain | The question word |
| 11 | Formal | Greet an elder or teacher respectfully | The respect marker |
| 12 | Informal | Greet a friend your own age | The casual marker |

### **Focus Word Underlining**

As the student types their sentence, the grammar domain focus element is underlined in red in real time. This is not spell check — it is grammar awareness. The student sees which part of their sentence satisfies the domain.

* Example: Domain is Noun Phrase. Student types: 'Demba sits by the river.' 'Demba' is underlined in red.

* Example: Domain is Verb Phrase. Student types: 'The farmer digs the field.' 'digs' is underlined in red.

* Underlining is visual only — it does not validate correctness. The QC phase does that.

* Underlining logic is per-domain — the system knows which grammatical position to highlight for each of the 12 domains.

### **RSC Collection Phase — per sentence**

| Step | Student Action |
| :---- | :---- |
| **1 — Sentence** | Types the sentence. Wordpad active with spelling support. Focus word underlined in red as they type. |
| **2 — Translation** | Types the translation in English or French. (Full and Translation Only modes only.) |
| **3 — Recording** | Records themselves saying the full sentence. (Full mode only.) |
| **4 — Submit** | Submit. Game advances to next grammar domain automatically. |
| **Complete** | When all 12 domains have a submitted sentence, the student's collection phase is done. |

### **RSC Progress Display**

The student screen shows a progress indicator: 7 of 12 sentences complete. Each of the 12 grammar domains is shown as a tile — grey (not done), green (submitted), highlighted (current). The student can see at a glance which domains remain.

# **3\. QC / Community Review Phase**

After the collection timer ends, the game moves to QC. The system selects 5–10 submissions for the class to review together. This is the community validation step — not the teacher alone, not the system alone. The class decides.

## **3.1 Word / Sentence Selection for Review**

The system automatically selects which submissions to review. Selection criteria, in priority order:

| Priority | Criterion |
| :---- | :---- |
| **1 — Highest** | Not found in the dictionary export — likely a new word or spelling variant |
| **2** | Found in dictionary but no translation recorded in this session |
| **3** | Spelling confidence is low (trigram similarity below threshold against dictionary) |
| **4** | Submitted by only one student — needs independent confirmation |
| **5 — Lowest** | High-frequency submission — many students submitted it — good for consensus building |

| Why this matters:  Right now we need everything confirmed in our system — that is the starting point. |
| :---- |
| The system prioritises what it doesn't know. New words and unconfirmed spellings first. |
| High-frequency words are selected last — the class already agreed on them implicitly. |

## **3.2 QC Round — One Submission at a Time**

Each selected submission plays out in the following sequence. Everyone's phone shows the same screen simultaneously:

### **RWC QC Sequence (per word)**

| Step | What happens |
| :---- | :---- |
| **1 — Audio** | The student who submitted the word records it live (Full mode) or it plays back if already recorded. The class hears the word spoken. Now everyone knows what word is being reviewed. |
| **2 — Spelling vote** | All students see the word as it was spelled. Each student votes: spelled correctly? Yes or No. Results shown live as votes come in. |
| **3 — Correction** | If the majority votes No, the submitting student can correct the spelling on their screen. New spelling is shown to all. |
| **4 — Translation** | All students type what they think the word means in English or French. All responses collected — multiple meanings captured. Shown as a live feed. |
| **5 — Next** | System moves to the next selected word. |

### **RSC QC Sequence (per sentence)**

| Step | What happens |
| :---- | :---- |
| **1 — Audio** | Submitting student records themselves saying the full sentence live, or playback if recorded. Class hears it. |
| **2 — Meaning vote** | All students vote: does this sentence make sense? Yes or No. (Not spelling — meaning and grammar.) |
| **3 — Correction** | If majority votes No, submitting student can correct both the spelling and the sentence itself. |
| **4 — Translation** | All students type the translation in English or French. Multiple translations collected. |
| **5 — Next** | System moves to the next selected sentence. |

| Translation collection design:  Translation is intentionally open — every student types what they think it means. |
| :---- |
| bantaba might get: 'community meeting place', 'gathering spot', 'town square', 'where elders meet'. |
| All of these are valid and valuable. The semantic range of a word is captured, not just one translation. |
| This is especially important for cultural concepts with no direct English equivalent. |

## **3.3 Teacher Participation in QC**

The teacher participates in QC as a player — they vote on spelling and meaning, and they submit translations. This makes the review pedagogically richer (the teacher is modelling engagement), and the teacher earns points and stars for their participation. Teacher points feed the same awards system as students.

# **4\. Awards Ceremony**

After QC completes, the game moves to the awards ceremony. Every participant's screen shows the same ceremony. This is not just announcing one winner — multiple students are recognised across multiple categories. Mario Party model.

## **4.1 Points System**

Points are awarded throughout the game for correct actions. Stars are awarded at the ceremony and carry a point bonus on top of base XP. Points integrate with myCred.

| Event | Base Award |
| :---- | :---- |
| **Word or sentence submitted** | \+10 XP |
| **Translation submitted (collection phase)** | \+15 XP |
| **Audio recorded (collection phase)** | \+20 XP |
| **Vote cast in QC phase** | \+5 XP |
| **Translation submitted in QC phase** | \+10 XP |
| **Submission reaches consensus (spelling vote passes)** | \+50 Gold |
| **New word not in dictionary — Discovery** | \+100 Gold |
| **Session completion bonus (all 12 domains, RSC)** | \+200 Gold |
| **Teacher participation bonus (any QC action)** | \+25 XP per action |

## **4.2 Star Categories**

Stars are recognition awards. Each star pays a configurable Gold bonus. The admin panel sets which stars are active and their point values. All are active by default.

| Star | Awarded to | Default Gold bonus |
| :---- | :---- | :---- |
| 🥇 Most Words / Sentences | Student with highest submission count | 500 Gold |
| 🎯 Best Accuracy | Highest ratio of submissions that passed spelling/meaning vote | 400 Gold |
| 🔍 Discovery Star | Most new words not in the dictionary | 600 Gold |
| ⚡ Speed Star | Fastest average submission time | 300 Gold |
| 🎙️ Audio Star | Most audio recordings submitted | 350 Gold |
| ⭐ Teacher's Star | Teacher-assigned — one student, teacher's discretion | 500 Gold |
| 🏫 Teacher Award | Teacher earns this for participating in QC | 400 Gold |

## **4.3 Accelerator Multipliers**

Accelerators stack on top of base points and star bonuses. All are configurable in the admin panel.

| Accelerator | Default behaviour |
| :---- | :---- |
| **Streak** | Consecutive sessions with submissions: 1.1× at 3 sessions, 1.25× at 5, 1.5× at 10+ |
| **Volume** | Total words ever contributed: 1.1× at 100, 1.25× at 500, 1.5× at 1000+ |
| **Speed** | Session completion under 50% of time: 1.15× bonus on that session |
| **Accuracy** | 90%+ vote pass rate across session: 1.2× on all Gold awards that session |

## **4.4 Ceremony Sequence**

| Step | What the screen shows |
| :---- | :---- |
| **1 — Results summary** | Total words/sentences collected this session. New discoveries count. Class total. |
| **2 — Star announcements** | Each star category revealed one at a time with animation. Student name highlighted. Gold bonus displayed. |
| **3 — Final leaderboard** | All participants ranked by total XP \+ Gold for the session. Teacher included. |
| **4 — Cumulative standings** | All-time leaderboard — how today's session affected the overall standings. |
| **5 — Fireworks / celebration** | Full-screen celebration animation. Session complete. |

## **4.5 Leaderboards**

| Type | Scope |
| :---- | :---- |
| **Session leaderboard** | This session only. Shown during collection phase on teacher monitor and at ceremony. |
| **Cumulative all-time** | Every session ever. Shown at ceremony end. Students can check anytime. |
| **Teacher monitor (live)** | Rolling leaderboard during collection so teacher can ensure all students are participating. |

# **5\. Technical Architecture**

## **5.1 Stack Decision — Locked**

| Stack:  Frontend: React \+ TypeScript \+ Vite. Same stack as sparxstar-3iatlas-wordpad-universe. |
| :---- |
| Backend: Node.js \+ Express. REST API. Stateless sessions via JWT. |
| Database: PostgreSQL. Real-time session state via WebSockets (socket.io). |
| Audio: Starmus audio widget (sparxstar-starmus-audio). DOM event contract: starmus:complete. |
| Spelling: Trigram fuzzy match against dictionary export JSON. No external API calls. |
| Hosting: Any Node-capable host. PWA-ready. No WordPress. No PHP. |

The frontend and backend are cleanly separated from day one. The React app talks to a REST API. The backend can be replaced or scaled without touching the frontend. This is the right architecture for the long term.

## **5.2 Repository Structure**

| Path | Contents |
| :---- | :---- |
| **packages/client/** | React \+ Vite frontend. All screens. PWA manifest. |
| **packages/server/** | Node \+ Express API. WebSocket server. Database models. |
| **packages/shared/** | TypeScript types shared between client and server. Session schema, token types, domain lists. |
| **data/dictionary/** | Dictionary export JSON files by language. Read-only at runtime. |
| **data/domains/** | Semantic domain list (Louw-Nida 82 domains). Grammar domain list (12 domains). |

## **5.3 Real-Time Architecture**

The collection phase is real-time. All participants in a session share live state. WebSockets (socket.io) handle the real-time layer.

| Event | Direction |
| :---- | :---- |
| **session:join** | Client → Server → broadcast to teacher |
| **submission:new** | Client → Server → broadcast to teacher monitor |
| **saturation:signal** | Server → Client (student who submitted) |
| **qc:word** | Server → all clients (QC phase) |
| **qc:vote** | Client → Server → broadcast live vote count |
| **qc:translation** | Client → Server → stored, shown as feed |
| **ceremony:start** | Server → all clients |
| **ceremony:star** | Server → all clients (one per star, sequenced) |

## **5.4 Connectivity & Offline Resilience**

| Deployment reality:  Students are on cheap Android phones on variable African mobile networks. |
| :---- |
| The app must tolerate connection drops during a session without losing submissions. |
| Strategy: submissions are queued locally (IndexedDB) and flushed to the server when connectivity returns. |
| A student who drops for 30 seconds does not lose their work. |
| The teacher monitor shows a connectivity indicator per participant. |

## **5.5 Dictionary Integration**

The dictionary export is a set of JSON files by language, committed to the data/dictionary/ folder. At runtime the server loads the relevant language file into memory on session start. No database query per lookup — in-memory trigram index for fast fuzzy matching.

| Function | Behaviour |
| :---- | :---- |
| **Exact match** | Word found in dictionary → confirmed. Spelling score 100\. |
| **Fuzzy match (score 50–89)** | Possible spelling variant → flagged for QC. AI redirects student. |
| **No match (score \< 50\)** | New word not in dictionary → Discovery signal. Gold bonus awarded. |
| **Saturation check** | 15+ students submitted same word this session → reframe signal to AI facilitator. |

## **5.6 AI Facilitator**

The AI facilitator runs as a configured conversation thread (LibreChat). It is not a separate component — it is a system prompt constructed from session parameters. It calls three functions, in locked sequence, after every submission:

| Step | Function — locked call sequence |
| :---- | :---- |
| **1 — Always first** | check\_saturation(word, session\_id) — if reframe signal, redirect immediately. Skip step 2\. |
| **2 — If not saturated** | analyze\_spelling(text, language) — use signal to shape response: celebrate discovery, flag duplicate, note variant. |
| **3 — Last always** | save\_token() — only after steps 1 and 2 have been evaluated. Never before. |

### **RWC System Prompt Template**

| You are a curious field linguist learning {language}. Current domain: {semantic\_domain\_name} (ID: {semantic\_domain\_id}). Students are in {region}. Elicit words for this domain. Ask broad questions first. Follow up on specifics. Do not interrupt a student mid-thought. One question at a time. REQUIRED SEQUENCE after each submission:   1\. check\_saturation(word, session\_id)   2\. analyze\_spelling(text, language) — skip if step 1 returned reframe   3\. save\_token() — only after steps 1 and 2 |
| :---- |

### **RSC System Prompt Template**

| You are a patient language teacher helping students practise {language} sentences. Today's focus: {grammar\_domain\_name} sentences about {semantic\_domain\_name}. Example: '{example\_sentence}' ({grammar\_domain\_name} \+ {semantic\_domain\_name}) Ask the student for one short, clear sentence. Affirm and observe gently. REQUIRED SEQUENCE after each submission:   1\. check\_saturation(sentence\_pattern, session\_id)   2\. analyze\_spelling(text, language)   3\. save\_token() |
| :---- |

# **6\. Screen Map**

## **6.1 Teacher Screens**

| Screen | Name | Description |
| :---- | :---- | :---- |
| T1 | Session Setup | Select mode (RWC/RSC), language, semantic domain, duration, collection depth. Generate session. |
| T2 | Live Monitor | Large join code \+ QR. Live participant count. Rolling submission feed. Live leaderboard by XP. End session button. |
| T3 | QC Review | One submission at a time. Controls for audio playback/record trigger. Vote results live. Translation feed. Advance to next. |
| T4 | Teacher's Star | Teacher selects one student to receive the Teacher's Star before ceremony begins. |
| T5 | Ceremony | Same ceremony screen as students. Teacher awards their star during the sequence. |

## **6.2 Student Screens**

| Screen | Name | Description |
| :---- | :---- | :---- |
| S1 | Join | Full screen. Large 6-character code entry, auto-uppercase. Display name. Join button. |
| S2 | RWC Collection | Three sequential panels: (1) Word entry with wordpad; (2) Translation; (3) Starmus recorder. XP counter in header. Submit active only when required steps done. |
| S3 | RSC Collection | Same structure as S2 but shows sentence prompt with grammar domain context card. Focus word underlined red as student types. Progress indicator: 7 of 12\. |
| S4 | QC — Waiting | Your word/sentence is shown. Record button if not yet recorded. Waiting for class vote. |
| S5 | QC — Voting | Word/sentence shown. Yes/No vote buttons. Live vote count animates in. |
| S6 | QC — Correction | Shown to submitter only if majority voted No. Edit field. Confirm correction. |
| S7 | QC — Translation | All students type translation. Live feed of translations appearing from classmates. |
| S8 | Ceremony | Star announcements one at a time. Final leaderboard. Cumulative standings. Fireworks. |

## **6.3 Mobile-First Design Rules — Non-Negotiable**

* Design target: 360px viewport width. Everything must work at this width.

* Touch targets: minimum 44px height on all interactive elements.

* Font sizes: minimum 16px for body text on mobile (prevents iOS auto-zoom on inputs).

* The join code entry: large, single field, auto-uppercase, numeric keyboard hint.

* The wordpad: keyboard must not obscure the text input — viewport must scroll or resize.

* The Starmus recorder: single large record button. No small controls.

* Special characters (ŋ, ɓ, ɗ, ñ): accessible accessory bar above the keyboard. Minimum 44px tap targets. Inserts at cursor. Does not replace selected text.

* ŋ (eng) is the highest-risk character — if the tool doesn't make it easy to type, students type n and never learn the difference. This is not optional.

# **7\. API Contract**

All endpoints are under /api/v1. Authentication for teacher endpoints uses JWT (Bearer token). Student endpoints use a session-scoped participant\_id issued at join — no account required.

## **7.1 Session Endpoints**

| Method \+ Path | Auth | Description |
| :---- | :---- | :---- |
| POST /session/create | Teacher JWT | Create session. Body: { mode, language, semantic\_domain\_id, duration\_minutes, collection\_depth }. Returns: { session\_id, join\_code, qr\_code\_url }. |
| POST /session/join | None | Join as student. Body: { join\_code, display\_name }. Returns: { session\_id, participant\_id, language, mode, collection\_depth }. |
| GET /session/:id/status | None | Poll session state. Returns: { status, participant\_count, token\_count, time\_remaining\_seconds, leaderboard\[\] }. |
| POST /session/:id/close | Teacher JWT | End collection phase. Triggers QC word selection. |
| GET /session/:id/qc-words | Teacher JWT | Returns ordered list of 5–10 selected submissions for QC review. |

## **7.2 Token Endpoints**

| Method \+ Path | Auth | Description |
| :---- | :---- | :---- |
| POST /token/save | participant\_id | Save a submission. Body: { session\_id, participant\_id, text, translation?, collection\_mode, grammar\_domain? }. Returns: { token\_id, spelling\_signal, saturation\_signal }. |
| POST /token/:id/vote | participant\_id | Cast a vote. Body: { dimension (spelling|meaning), vote\_yes }. Returns: { success, vote\_counts }. |
| POST /token/:id/translate | participant\_id | Submit a QC translation. Body: { translation }. Returns: { success }. |
| POST /token/:id/correct | submitter only | Submit a correction. Body: { corrected\_text }. Returns: { success }. |

## **7.3 Awards Endpoints**

| Method \+ Path | Auth | Description |
| :---- | :---- | :---- |
| POST /session/:id/teachers-star | Teacher JWT | Assign Teacher's Star. Body: { participant\_id }. Returns: { success }. |
| GET /session/:id/awards | None | Returns final awards calculation: stars, points, leaderboard. Called when ceremony begins. |
| GET /leaderboard/alltime | None | Cumulative all-time standings for this school/installation. |

# **8\. Data Model**

## **8.1 Session**

| Field | Type / Notes |
| :---- | :---- |
| **session\_id** | UUID, primary key |
| **join\_code** | 6-character uppercase alphanumeric, unique, indexed |
| **mode** | ENUM: rwc | rsc |
| **language** | BCP-47 or AIWA language code (e.g. mandinka) |
| **semantic\_domain\_id** | String — Louw-Nida code (e.g. '6.2') |
| **duration\_minutes** | Integer, default 15 |
| **collection\_depth** | ENUM: full | translation\_only | basic |
| **teacher\_id** | User ID of session creator |
| **status** | ENUM: open | qc | ceremony | closed |
| **started\_at / ended\_at** | Unix timestamps |
| **participants** | JSONB — { participant\_id: { display\_name, joined\_at, is\_teacher } } |

## **8.2 Token (Submission)**

| Field | Type / Notes |
| :---- | :---- |
| **token\_id** | UUID, primary key |
| **session\_id** | Foreign key → session |
| **participant\_id** | Session-scoped participant ID |
| **collection\_mode** | ENUM: rwc | rsc — copied from session |
| **text** | The submitted word or sentence (UTF-8) |
| **translation** | Student-provided translation. Empty string if Basic mode. |
| **audio\_id** | Attachment ID from Starmus. NULL if no recording. |
| **grammar\_domain** | RSC only — one of 12 domain slugs. Empty string for RWC. |
| **grammar\_domain\_index** | RSC only — integer 1–12, position in sequence |
| **spelling\_signal** | ENUM: confirmed | variant | discovery |
| **spelling\_score** | Float 0–100 — trigram similarity against dictionary |
| **vote\_spelling** | JSONB — { yes: n, no: n, voters: \[\] } |
| **vote\_meaning** | JSONB — { yes: n, no: n, voters: \[\] } |
| **qc\_translations** | JSONB — array of { participant\_id, translation, submitted\_at } |
| **corrected\_text** | String — correction submitted during QC, if any. NULL if no correction. |
| **created\_at** | Unix timestamp — immutable after creation |

| Immutability rule:  Tokens are append-only from the moment of creation. |
| :---- |
| Corrections during QC are stored in corrected\_text — the original text field is never overwritten. |
| This preserves the full history: what was submitted, what was corrected, both matter linguistically. |

# **9\. Build Order**

Copilot builds in this order. Do not skip phases. Do not build Phase 4 before Phase 2 is working.

| Phase | Work | Done when |
| :---- | :---- | :---- |
| 1 — Scaffold | Monorepo setup. packages/client (Vite \+ React \+ TS), packages/server (Node \+ Express), packages/shared (types). PostgreSQL schema. socket.io wired. Dictionary JSON loaded. | npm run dev starts both client and server with no errors. |
| 2 — Session core | POST /session/create. POST /session/join. WebSocket: session:join event. Teacher T2 screen (join code \+ QR \+ live participant count). Student S1 screen (join). Basic connectivity. | Teacher creates session. Student joins on phone. Teacher sees student appear on monitor. |
| 3 — RWC Collection | Student S2 screen. Wordpad mounted. Special character bar (ŋ ɓ ɗ ñ). Three-step state machine (typed → translated → recorded). POST /token/save. Spelling signal returned. Teacher T2 rolling feed. | Student submits a word in Mandinka with translation and audio. Teacher sees it appear on monitor in real time. |
| 4 — RSC Collection | Student S3 screen. Grammar domain sequencing. Focus word underlining in red. Progress indicator 7 of 12\. RSC token save with grammar\_domain field. | Student completes all 12 grammar domains. System tracks which are done. |
| 5 — QC Phase | GET /session/:id/qc-words (selection algorithm). Teacher T3 screen. Student S4–S7 screens. Vote endpoints. Translation collection. Correction flow. All real-time via WebSocket. | Full QC round completes: word displayed, votes cast, translation collected, next word advances. |
| 6 — Awards | Awards calculation. Star assignment logic. Teacher's Star endpoint. Ceremony screens (T5, S8). All-time leaderboard. myCred integration hooks. | Full ceremony runs on all screens simultaneously. Fireworks display. Leaderboard shown. |
| 7 — Polish | PWA manifest. Offline submission queue (IndexedDB). Connectivity indicators. Error handling. Loading states. End-to-end test: one full session both modes. | App installs as PWA. Submission survives a 30-second network drop. Full session test passes. |

# **10\. Non-Negotiables**

These constraints apply from day one of any build. They may not be deferred, worked around, or overridden by any AI coding agent including GitHub Copilot.

| COPILOT INSTRUCTION:  If you are reading this spec as a coding agent — these rules are absolute. |
| :---- |
| Do not find creative workarounds. Do not 'simplify' by removing them. |
| If a rule blocks your approach, change the approach, not the rule. |
| Raise a question to the developer before violating any item below. |

| Rule | Detail |
| :---- | :---- |
| **Mobile first — always** | Every screen is designed for 360px first. Desktop is secondary. Never the other way around. |
| **Formal spelling model in user tools** | The wordpad guides students toward correct spelling. It does not accept approximations silently. ŋ is ŋ, not n. The dictionary is the authority. |
| **Token immutability** | Tokens are append-only. original text is never overwritten. Corrections stored separately in corrected\_text. |
| **Three-step sequence** | text → translation → audio, in that order, enforced by state machine. Submit is never active until required steps are complete for the selected depth. |
| **AI call sequence locked** | check\_saturation → analyze\_spelling → save\_token. Always in this order. save\_token is never called before the other two. |
| **No DVE runtime dependency** | RLC has no live connection to DVE, Dheghom, Mḗh₁n̥s, or any SPARXSTAR pipeline component. The dictionary is a read-only export. That is the only data dependency. |
| **No WordPress dependency** | RLC is a standalone Node \+ React application. No WordPress. No PHP. No WP hooks. No myCred direct calls — myCred integration is via API hooks only. |
| **Grammar domain is teacher-read-only in RSC** | The 12 grammar domains are fixed game structure. Teacher does not select them. The game sequences through all 12 automatically. |
| **Community validates — not the system alone** | Spelling and meaning votes are cast by the class. The system records and tallies. It does not override or ignore vote outcomes. |
| **ŋ must be easy to type** | If the special character bar does not make ŋ trivially accessible, students type n. Nobody learns the difference. This is a linguistic sovereignty issue, not a UI nicety. |

# **11\. Explicitly Deferred**

These items are not cut. They are not in scope for the initial build. Interfaces are designed to accommodate them when they arrive.

| Item | Notes |
| :---- | :---- |
| **sparxstar-3iatlas-games** | Repo named. Not started. Will consume the same dictionary export and session infrastructure. |
| **Sky AI spelling model** | A trained model that improves autocorrect over time. When it matures, it updates the dictionary export. RLC benefits automatically — no code change needed. |
| **Adult / advanced mode** | RLC grows into adult use as language coverage grows. Architecture supports this without redesign. |
| **Multi-language sessions** | Single language per session for now. Multi-language is a future configuration option. |
| **Offline-first full mode** | Phase 7 adds offline submission queuing. Full offline (no server at all) is a future phase. |
| **Data export pipeline** | How collected data flows out of RLC to wherever it goes next. That pipeline is not RLC's concern and is explicitly excluded from this spec. |

