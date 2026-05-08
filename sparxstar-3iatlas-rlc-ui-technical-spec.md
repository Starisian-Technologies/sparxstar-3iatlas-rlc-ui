SPARXSTAR 3iAtlas RLC UI --- Copilot Instructions
===============================================

Phases 4, 5, and 6
==================

* * * * *

What This Repository Is
-----------------------

sparxstar-3iatlas-rlc-ui is the React 19 + TypeScript + Vite PWA frontend for the 3iAtlas Rapid Language Collection classroom game. It has no WordPress dependency. It calls the sparxstar-3iatlas-rlc WordPress plugin REST API at /aiwa/v1/.

Do not add WordPress dependencies. Do not add a Node server. Do not add a database. The plugin is the server. This repo is the UI.

* * * * *

What Phases 1 and 2 Delivered (Do Not Rebuild)
----------------------------------------------

-   src/types/index.ts --- all game types, GRAMMAR_DOMAINS (12 entries), SPECIAL_CHARS

-   src/api/client.ts --- full REST client covering all endpoints

-   src/hooks/useSessionPoll.ts --- 2-second polling hook

-   src/components/AccessoryBar.tsx --- special character bar (ŋ ɓ ɗ ñ ɲ ʔ)

-   src/screens/teacher/SetupScreen.tsx --- T1 session setup

-   src/screens/teacher/MonitorScreen.tsx --- T2 live monitor

-   src/screens/student/JoinScreen.tsx --- S1 join screen

-   src/screens/student/RwcCollectionScreen.tsx --- S2 RWC word collection

-   src/App.tsx --- top-level router and game state

* * * * *

Backend --- What the Plugin Provides
----------------------------------

Repo: sparxstar-3iatlas-rlc (WordPress plugin) Namespace: Starisian\Sparxstar\Aiwa REST base: /aiwa/v1/

### Key Classes and Their Behaviour

AiwaSessionManager

-   create_session() --- creates aiwa_artifact post, generates 6-char join code

-   join_session() --- registers participant, returns session-scoped participant_id

-   close_session() --- sets status to closed, fires aiwa_session_closed

-   Session statuses: open | closed | archived

AiwaTokenManager

-   create_token() --- immutable. Text is never overwritten. Corrections create new tokens.

-   record_vote($token_id, $dimension, $vote_yes, $voter_id) --- vote dimensions: orthography | semantics | audio

-   Vote lock: optimistic transient lock prevents concurrent corruption

-   Duplicate vote guard: one vote per voter per dimension per token

-   SATURATION_THRESHOLD = 15 --- 15+ submissions of same word triggers reframe signal

-   CONSENSUS_THRESHOLD = 0.8 --- 80% agreement marks a dimension verified

-   Validity states: verified | disputed | incorrect | low_quality (audio only)

AiwaGamification --- WordPress hook → myCred (graceful no-op when myCred absent)

-   aiwa_token_submit → +10 XP (every word submission)

-   aiwa_audio_submit → +20 XP (audio recording submitted)

-   aiwa_voted → +5 XP (casting a consensus vote)

-   aiwa_consensus_reached → +100 Gold (token reaches consensus)

-   aiwa_discovery → +50 Gold (new word not in dictionary)

-   Point types: xp (session leaderboard) | gold (redeemable currency)

AiwaAiFunctions

-   check_saturation(word, session_id) → { count, saturated: bool, signal: 'reframe'|'continue' }

-   analyze_spelling(text) → trigram similarity against aiwa_word dictionary

-   Spelling signals: confirmed (exact match) | variant (fuzzy match 50--89) | discovery (no match <50)

AiwaValidation

-   run_promotion_pipeline(session_id) --- promotes tokens to aiwa_word after QC

-   Two-pile rule: every submission enters aiwa_token first. Promotion only after consensus.

-   Teacher must approve each word after consensus before expert-verified status.

### REST Endpoints (all under /aiwa/v1/)

|

Method

 |

Path

 |

Purpose

 |
| --- | --- | --- |
|

POST

 |

/session/create

 |

Create session --- returns { session_id, join_code }

 |
|

POST

 |

/session/join

 |

Join session --- returns { session_id, participant_id, language, mode, collection_depth }

 |
|

GET

 |

/session/{id}/status

 |

Poll status --- returns { status, participant_count, token_count, time_remaining_seconds, leaderboard[] }

 |
|

POST

 |

/session/{id}/close

 |

End collection phase

 |
|

GET

 |

/session/{id}/qc-words

 |

Returns ordered QcToken[] for QC review

 |
|

GET

 |

/session/{id}/awards

 |

Returns { stars[], leaderboard[], total_tokens, discovery_count }

 |
|

POST

 |

/session/{id}/teachers-star

 |

Assign Teacher's Star --- body: { participant_id }

 |
|

POST

 |

/token/save

 |

Submit word/sentence --- returns { token_id, spelling_signal, saturation_signal, spelling_score, xp_awarded }

 |
|

POST

 |

/token/{id}/vote

 |

Cast vote --- body: { dimension, vote_yes }

 |
|

POST

 |

/token/{id}/translate

 |

Submit QC translation --- body: { translation }

 |
|

POST

 |

/token/{id}/correct

 |

Submit correction --- body: { corrected_text }

 |

* * * * *

Phase 4 --- RSC Collection (Sentence Collection)
----------------------------------------------

Goal: When the session mode is rsc, students write one sentence per grammar domain, cycling through all 12 domains in fixed order. Complete when all 12 are submitted.

### Files to Create

src/screens/student/RscCollectionScreen.tsx

### Behaviour

-   Import GRAMMAR_DOMAINS from src/types/index.ts --- 12 entries, fixed order, do not reorder

-   Track which domains are complete --- store as Set<number> keyed by domain.index

-   Show progress indicator: "7 of 12 sentences complete"

-   Show domain tiles --- grey (not done), green (submitted), highlighted (current)

-   Current domain is the lowest-index incomplete domain

-   When a student submits domain 12, collection is complete --- show waiting screen

-   Focus word underlining: as student types, identify the grammar focus element in red

-   Use the domain.focus_element field from GRAMMAR_DOMAINS for context

-   Underline is visual only --- not validation. Underlining logic is per-domain.

-   Example: Domain is "Noun phrase" → underline the first noun in the sentence

-   Simple approach: highlight the first word for noun/adjective/adverb domains; highlight conjunctions (and/but/because) for conjunction domain; etc.

-   Never block submission --- underlining is guidance, not a gate

-   Same three-step state machine as RWC: sentence → translation → recording

-   Same AccessoryBar for special characters

-   collection_mode sent to API is 'rsc'

-   Include grammar_domain (slug) in the SaveTokenPayload

### Wire into App.tsx

-   When session mode is rsc, route student to RscCollectionScreen after join

-   RscCollectionScreen receives same props as RwcCollectionScreen

* * * * *

Phase 5 --- QC Review Phase
-------------------------

Goal: After the teacher ends the collection phase, the plugin selects 5--10 tokens for community review. Every participant's screen shows the same sequence simultaneously.

### Files to Create

src/screens/qc/QcScreen.tsx --- shared screen for all participants src/screens/teacher/QcTeacherScreen.tsx --- teacher controls (advance, assign Teacher's Star) src/hooks/useQcSession.ts --- polls QC state every 2 seconds

### QC Sequence (one token at a time, same order for all participants)

Step 1 --- Audio (if recorded)

-   Show the submitted word/sentence

-   If audio exists: show playback button (placeholder --- Starmus recorder not yet wired)

-   If no audio: show "No recording" notice

-   Teacher advances manually from QcTeacherScreen

Step 2 --- Spelling/Meaning vote

-   RWC tokens: vote on orthography (spelling)

-   RSC tokens: vote on semantics (meaning and grammar)

-   Show Yes / No buttons --- minimum 44px touch targets

-   Show live vote count as votes come in (poll every 2 seconds)

-   Call POST /token/{id}/vote with { dimension: 'orthography'|'semantics', vote_yes: bool }

-   One vote per participant per token --- disable buttons after voting

-   Award +5 XP visually after vote (backend awards via aiwa_voted hook)

Step 3 --- Correction (shown only to token submitter if majority voted No)

-   Show edit field pre-populated with original text

-   Submit via POST /token/{id}/correct

-   Other participants see "Correction in progress..."

Step 4 --- Translation collection

-   All participants type their translation

-   Submit via POST /token/{id}/translate

-   Show live feed of translations appearing from classmates (poll)

-   Multiple translations are valuable --- do not deduplicate or hide them

-   After submitting, participant sees "Waiting for others..."

Step 5 --- Advance

-   Teacher presses "Next word" in QcTeacherScreen

-   Moves to next QcToken in the ordered list from /session/{id}/qc-words

-   When all QC tokens are reviewed, teacher assigns Teacher's Star then advances to ceremony

### QC State Management

-   Load QcToken[] once from GET /session/{id}/qc-words

-   Track current index locally --- teacher controls advancement

-   Poll current token's vote counts every 2 seconds via GET /session/{id}/status

-   Do not re-fetch the full QC word list --- it is fixed at the start of QC phase

### Teacher Star Assignment

-   Before ceremony, show QcTeacherScreen with participant list

-   Teacher taps one student name

-   Call POST /session/{id}/teachers-star with { participant_id }

-   Only one Teacher's Star per session --- disable after assignment

* * * * *

Phase 6 --- Awards Ceremony
-------------------------

Goal: All participants see the same ceremony simultaneously. Stars revealed one at a time with animation. Leaderboard shown. Fireworks at the end.

### Files to Create

src/screens/ceremony/CeremonyScreen.tsx  src/components/Fireworks.tsx --- CSS animation, no canvas library

### Ceremony Sequence

Call GET /session/{id}/awards once at ceremony start. Response: { stars[], leaderboard[], total_tokens, discovery_count }

Step 1 --- Results summary

-   Total words/sentences collected

-   Discovery count (new words not in dictionary)

-   Class total

Step 2 --- Star announcements (reveal one at a time, 2-second delay between each) Reveal in this order:

|

Star

 |

Awarded to

 |

Default Gold

 |
| --- | --- | --- |
|

Most Words / Sentences

 |

Highest submission count

 |

500

 |
|

Best Accuracy

 |

Highest pass rate on spelling/meaning vote

 |

400

 |
|

Discovery Star

 |

Most new words (discovery signal)

 |

600

 |
|

Speed Star

 |

Fastest average submission

 |

300

 |
|

Audio Star

 |

Most audio recordings

 |

350

 |
|

Teacher's Star

 |

Teacher-assigned

 |

500

 |
|

Teacher Award

 |

Teacher for QC participation

 |

400

 |

-   Each star: show category name, winner's display name, Gold bonus

-   Highlight the winner's name with animation (scale up, gold color)

-   Stars not awarded (no data) are silently skipped --- never show "no winner"

Step 3 --- Final leaderboard

-   All participants ranked by XP + Gold for this session

-   Teacher included in leaderboard

-   Show rank, display name, XP, Gold

Step 4 --- Fireworks

-   Full-screen CSS animation --- no canvas, no library

-   Use @keyframes --- burst of colored dots from center

-   Wrap in @media (prefers-reduced-motion: no-preference) --- off by default

-   Duration: 3 seconds, then fade out

Step 5 --- Session complete

-   Show "Session complete" message

-   "Play again" button → returns to landing screen

-   No auto-navigation --- teacher controls when to dismiss

* * * * *

Non-Negotiable Rules (From Spec Section 10)
-------------------------------------------

These rules apply to every component in every phase. Do not work around them.

Mobile first --- always Every screen is designed for 360px viewport first. Desktop is secondary. Never design desktop first and scale down.

Touch targets Minimum 44px height on ALL interactive elements --- buttons, vote options, tab tiles, progress indicators if tappable. No exceptions.

Font sizes Minimum 16px for all input fields and body text. Prevents iOS auto-zoom on focus.

Special character bar  AccessoryBar must appear above the keyboard on every screen that has a text input for word or sentence entry. Import from src/components/AccessoryBar.tsx. ŋ must be the first character. This is not optional.

Token immutability Corrections during QC are new tokens --- the original is never overwritten. The UI must never imply that the original submission has been deleted or replaced. Show "correction submitted" --- never "word updated" or "word changed".

Three-step sequence enforcement In both RWC and RSC collection: text → translation → recording. The submit button is never active until required steps for the selected depth are complete. basic depth: text only. translation_only: text + translation. full: all three.

Saturation signal When SaveTokenResponse.saturation_signal === 'saturated', show the student a gentle redirect message: "Great! We have lots of that word --- try a different one." Never show an error. Never block them. Just redirect.

One vote per participant per dimension per token Disable vote buttons immediately after the participant votes. Do not re-enable. The backend enforces this --- the UI must reinforce it visually.

Community validates --- not the system alone Vote counts are shown live as they come in. Never hide or delay vote results. The class sees the count update in real time. This is the community validating together.

No DVE runtime dependency This UI does not call DVE, Mḗh₁n̥s, Dheghom, Helios, or Sirus directly. It calls /aiwa/v1/ only. The plugin handles any downstream integration.

No WordPress dependency No @wordpress/ packages. No WP REST API calls outside of /aiwa/v1/. No WordPress authentication --- session identity is via participant_id only.

* * * * *

Coding Standards
----------------

TypeScript

-   Strict mode. No any. No @ts-ignore.

-   All props interfaces explicitly typed.

-   All API responses typed against src/types/index.ts.

React

-   Functional components only. No class components.

-   useCallback on all event handlers passed as props.

-   void prefix on async calls in event handlers: onClick={() => void handleJoin()}

Accessibility

-   Every interactive element has aria-label if its text is not self-describing.

-   Vote buttons: aria-label="Vote yes" / aria-label="Vote no".

-   Live regions: use role="status" or aria-live="polite" for vote count updates.

-   Loading states: aria-busy="true" on the element that is loading.

Styling

-   Inline styles only --- no CSS modules, no Tailwind, no styled-components.

-   Brand blue: #1B3A6B. Gold: #C9A84C. Background: #f4f4f4. Text: #1a1a1a.

-   Border radius: 8px for inputs, 10px for buttons, 12px for cards.

-   Never use position: fixed for content --- use position: sticky or flex layout.

File structure

src/

  screens/

    teacher/  ←  T1,  T2,  T3,  T4,  T5

    student/  ←  S1,  S2,  S3,  S4,  S5,  S6,  S7,  S8

    qc/ ←  shared  QC  screen

    ceremony/ ←  ceremony  screen

  components/ ←  reusable:  AccessoryBar,  and  any  new  shared  components

  hooks/  ←  useSessionPoll,  useQcSession,  and  any  new  hooks

  api/  ←  client.ts  only  ---  do  not  create  additional  API  files

  types/  ←  index.ts  only  ---  add  types  here,  do  not  create  new  type  files

One screen per file. One hook per file. No barrel files.

* * * * *

Recorder Placeholder
--------------------

The recording step in both RWC and RSC collection screens currently shows a placeholder:

<div>

  Starmus  recorder  mounts  here

  (@sparxstar/starmus-audio  ---  to  be  wired  in)

</div>

Do not replace this placeholder. Do not implement audio recording. When @sparxstar/starmus-audio is ready, it will be wired in as a separate task. The placeholder must remain so the three-step sequence still works end to end. In full depth mode: show the placeholder and a "Skip recording" button that allows the student to submit without audio during development.

* * * * *

Polling Strategy
----------------

Phase 5 and 6 use polling --- not WebSockets. Poll every 2 seconds using useSessionPoll. For QC-specific state (current vote counts on a specific token), extend useSessionPoll or create useQcSession that polls GET /session/{id}/status and extracts the relevant token's vote counts from the leaderboard/status response.

Do not introduce socket.io or any WebSocket library. Polling is the agreed approach for Phase 5 and 6. Real-time via WebSockets is a future phase.

* * * * *

API Error Handling
------------------

Every API call must have a try/catch. Errors are shown to the user in plain language --- never technical error messages, never raw API responses, never stack traces.

Standard error display pattern:

{error  &&  (

  <div  role="alert"  style={{

    background:  '#ffeded',  border:  '1px  solid  #f09595',

    borderRadius:  8,  padding:  '10px  14px',  fontSize:  14,  color:  '#a32d2d',

  }}>

    {error}

  </div>

)}

Network failures during collection phase must not lose the student's typed input. Keep input state in React state --- it survives a failed API call.

* * * * *

Build Order Within Each Phase
-----------------------------

Build in this order within each phase. Do not skip steps.

Phase 4:

1.  RscCollectionScreen --- domain sequencing, progress tiles, focus word underlining

2.  Wire into App.tsx --- route rsc mode students here after join

Phase 5:

1.  useQcSession hook --- poll QC state

2.  QcScreen --- student view: audio step, vote step, correction step, translation step

3.  QcTeacherScreen --- teacher controls: advance, Teacher's Star assignment

4.  Wire QC into App.tsx --- teacher navigates here after closing collection

Phase 6:

1.  Fireworks component --- CSS animation only

2.  CeremonyScreen --- results summary, star announcements, leaderboard, fireworks

3.  Wire ceremony into App.tsx --- teacher navigates here after QC complete

* * * * *

Definition of Done --- Per Phase
------------------------------

Phase 4 done when: A student in RSC mode can complete all 12 grammar domains in sequence. Progress indicator shows correct count. Focus word underlines as they type. Submission calls /token/save with correct grammar_domain slug.

Phase 5 done when: Teacher loads QC word list. All participants see the same token. Votes are cast and live counts update via polling. Corrections work. Translations are collected. Teacher's Star is assigned. Teacher advances to ceremony.

Phase 6 done when: Ceremony screen loads awards from API. Stars reveal one at a time with delay. Leaderboard shows all participants ranked. Fireworks animation plays. "Play again" returns to landing screen.

* * * * *

sparxstar-3iatlas-rlc-ui | Phases 4--6 | Starisian Technologies | CONFIDENTIAL - PATENT PENDING