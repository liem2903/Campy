# FEAT-003 - blurting

**Sprint:** 2 · **Branch:** `feature/blurting` (from `main`) · **Created:** 2026-10-20

> **Updated 2026-10-21:** built **after** FEAT-004 (block editor). Ticket B (AI gap check) is
> **dropped**: no AI checks in blurting. The reveal shows the note in a read-only TipTap editor
> (A3). See `docs/tickets/FEAT-004-block-editor.md`.

## Context

Blurting is a study technique: hide the material, write down everything you remember, then
compare. Campi notes are stored per user on the server (FEAT-002). After FEAT-004, a note's body
is a tree of blocks (paragraphs and list items) edited in TipTap.

**Goal:** from any note, open a blurt page that hides the body, type everything you remember, then
reveal the note next to your blurt.

The work is one tracer-bullet ticket, Ticket A.

**Out of scope:**
- Related-notes suggestions ("what else connects to this"). A later feature, since it searches
  across all notes.
- Covering block by block. A later feature, now that notes are real blocks (FEAT-004).
- Covering by heading section. Sections aren't stored, so there's nothing to cover by.
- Saving blurt attempts or AI feedback. Every attempt is thrown away after use.
- "Extra" items (things you wrote that aren't in the note).

## Shared decisions (grilled 2026-10-20)

| # | Area | Decision |
|---|---|---|
| 1 | What's hidden | The whole note body. The title stays visible as the recall cue. |
| 2 | Where | Its own page, `/notes/:id/blurt`. |
| 3 | Entry points | A "Blurt" button in the note page header **and** on each note in the sidebar. |
| 4 | Input | A plain textarea (re-confirmed 2026-10-25). Recall doesn't need list formatting, and the draft stays a plain string. |
| 5 | Storage | Nothing in the database. **No migration.** |
| 6 | Unfinished blurt | Not stored (changed 2026-10-25). While writing, a hint says it isn't saved, closing or reloading the tab asks "Leave site?" (`beforeunload`), and "Close ✕" asks first. Only when the blurt isn't empty. No warning once revealed. |
| 7 | Empty note | Allowed. The reveal just shows an empty note. |
| 8 | Workflow | Same as FEAT-001/002 (see CLAUDE.md): tests first, then top-down checkpoints, each one explained, quizzed and committed. Blast-radius tags below are estimates; re-check each when its plan is presented. |

### Definition of done (every ticket)
- [ ] Built with the Workflow: tests first, then top-down checkpoints, each one explained and committed
- [ ] Acceptance tests written and passing (`npm test`)
- [ ] `npm run build` passes (strict TS, no `any`)
- [ ] Demo path works in `npm run dev:all`
- [ ] Back-end tickets: feature described by the developer, `backend-reviewer` sub-agent run, findings addressed
- [ ] Committed on `feature/blurting`

---

## Ticket A: Blurt and self-compare

**Slice:** Press "Blurt" on a note → the blurt page shows only the title and an empty textarea →
type → "Done" → your blurt and the note appear side by side.

### Decisions

| # | Area | Decision |
|---|---|---|
| A1 | Loading the body | The body is **not fetched until Done**, so it never reaches the browser while you blurt and is always the latest version at reveal. The reveal has its own loading state and a "Couldn't load the note. Retry" error state. |
| A2 | Loading the title | Needed at page start. Options (call `getNoteFromServer` and use only the title, read it from `NotesProvider`'s list, or a title-only fetch) go in the Checkpoint 1 plan. |
| A3 | Layout: focus sheet (picked from a 4-way prototype, 2026-10-25) | The blurt page is a full-screen sheet over the whole app, sidebar included, so nothing else can cue you. A thin top bar shows "Blurting · <title>", a timer, a live word count and "Close ✕" (back to `/notes/:id`). **Writing:** big centered serif title, then a borderless textarea filling the rest, then "I'm done →" centered underneath. **Reveal:** the sheet splits in half, "From memory" (your blurt, on a tinted background) on the left and "The note" (title + read-only TipTap viewer) on the right, each scrolling on its own, with the A4 actions in a bottom bar. Design pass (`emil-design-eng`, 2026-10-25): both main buttons are pills with an icon in a circle ("I'm done →", "Blurt again ↺") that nudges right on hover (mouse only); "I'm done" is disabled while the blurt is empty; the sheet fades and grows slightly in (240ms), and the reveal halves fade and rise with the note 60ms behind; fixed-width timer digits; brand-coloured cursor; reduced motion = fade only. Prototype kept on branch `prototype/blurt-layouts`. |
| A3b | Timer and word count | Timer counts up from page open, stops at Done and restarts on "Blurt again". Display only, nothing stored. Word count = whitespace-separated words in the blurt. |
| A4 | Reveal actions | "Blurt again" (hides the note, empty textarea, new attempt) and "Back to note" (`/notes/:id`). |
| A4b | Keyboard | Ctrl/⌘ + Enter in the textarea = "I'm done" (only when the blurt isn't empty). On the reveal, plain R = "Blurt again" (ignored with Ctrl/⌘/Alt, so Ctrl+R still reloads, and ignored while typing in a field). Each shortcut is shown as a small key hint next to its button. |
| A5 | Missing note | Another user's or a deleted note → the existing "This page doesn't exist" view, as on `NotePage`. |
| A6 | Back end | No new endpoint. Reuses `GET /api/notes/:id` via `getNoteFromServer`. |

### Testing (decided 2026-10-20)
No front-end test setup: Ticket A's acceptance checks are a **manual checklist** run in the browser
(`npm run dev:all`) before committing each checkpoint. There is no Checkpoint 0.

Split into four checkpoints on 2026-10-25 so each stays under 50 lines.

### Checkpoint 1 🟢: Read-only note viewer
- [ ] Move the TipTap body extensions out of `NoteEditor.tsx` so the editor and a viewer share them
- [ ] A read-only component that shows a note's blocks (A3)

### Checkpoint 2 🔴: Page, route and leave warning
- [ ] `client/src/pages/BlurtPage.tsx`: the focus sheet (A3): top bar with title, timer, word count and Close, centered title as the cue, textarea, "I'm done →"
- [ ] Route `notes/:noteId/blurt` in `client/src/App.tsx`, inside the logged-in layout
- [ ] Leave warning while writing (6)
- [ ] Move the "This page doesn't exist" view out of `NotePage` into `NoteNotFound`, shared with the blurt page (A5)

### Checkpoint 3 🟡: Reveal
- [x] On Done: fetch the body (A1), then split the sheet into "From memory" | "The note" (A3) with its two actions (A4) in a bottom bar
- [x] Each column scrolls on its own (capped at the screen height), so a long note can be read while the blurt stays in view. No pagination (decided 2026-10-25)

### Checkpoint 4 🟡: Entry points
- [ ] "Blurt" button in the `NotePage` header
- [ ] "Blurt" button on each note in `Sidebar` (e.g. on hover, next to "×")

### Acceptance tests
- [ ] The blurt page shows the note's title and an empty textarea, and **no body text**
- [ ] The body is not requested until Done
- [ ] Done shows the blurt and the note body side by side
- [ ] While writing a non-empty blurt: a hint says it isn't saved, reload/close asks "Leave site?", and "Close ✕" asks first. An empty blurt leaves without asking.
- [ ] "Blurt again" hides the body and empties the textarea. "Back to note" opens `/notes/:id`.
- [ ] Another user's note id → "This page doesn't exist"
- [ ] An empty note can be blurted, and the reveal shows an empty body
- [ ] The body fetch failing at Done → error message with "Retry", and the blurt is kept

**Demo:** Open a note → "Blurt" → a full-screen sheet with only the title, timer and word count → type what you remember → "I'm done" → the sheet splits, blurt left and note right → "Blurt again" → empty again.
Start a blurt from the sidebar without opening the note first.

---

## ~~Ticket B: AI gap check~~ (dropped 2026-10-21, kept for reference only)

**Slice:** On the reveal screen, "Check my gaps with AI" sends your blurt to the server, which
asks Claude to compare it with the note, and shows what you **missed**, got **wrong** and got
**right**, each with quotes.

### Decisions

| # | Area | Decision |
|---|---|---|
| B1 | Trigger | On request only: a "Check my gaps with AI" button on the reveal screen. Nothing goes to the LLM otherwise. |
| B2 | Endpoint | `POST /api/notes/:id/blurt-check` with `{ blurt }`, behind `requireSession`. |
| B3 | Note text | The **server** loads the note for the logged-in user (not sent by the client), so the endpoint can't be used to send arbitrary text to Claude. Missing, another user's or non-UUID id → 404 Not Found. |
| B4 | Provider and model | Anthropic, `@anthropic-ai/sdk`, **Claude Sonnet 5.5** (`claude-sonnet-5-5`). Estimated ~3¢ per check. |
| B5 | Output shape | Structured JSON (structured outputs), validated by the server: `{ missed: [{ summary, noteQuote }], wrong: [{ summary, blurtQuote, noteQuote }], right: [{ summary, blurtQuote }] }`. |
| B6 | Quote check | The server checks each quote appears in the note or blurt (ignoring case and extra whitespace) and **drops** items that don't match. |
| B7 | All dropped | If Claude returned items but every one was dropped → "Couldn't verify the AI's answer. Try again." (never "No gaps found"). |
| B8 | Blurt length | Max 10,000 characters → 413 Content Too Large. The textarea shows a counter near the limit. Notes are not capped. |
| B9 | Rate limit | Per user, ~10 checks per hour, keyed by user id, in `src/middleware/rateLimiters.ts` → 429 Too Many Requests "You've used your checks for this hour". |
| B10 | Failures | Claude down, timing out or refusing → 502 Bad Gateway "The AI checker is unavailable right now". Every error shows its message plus a "Try again" button. The side-by-side stays usable. |
| B11 | No API key | The server still starts. `ANTHROPIC_API_KEY` unset → this endpoint gives 503 Service Unavailable "AI checks aren't set up". Ticket A works without a key. |
| B12 | Statelessness | Nothing is stored: blurt in, feedback out. |

### Before starting
- [ ] Get an Anthropic API key with billing set up, and add `ANTHROPIC_API_KEY` to `.env`
  (and a commented line to `.env.example`)
- [ ] Decide in Checkpoint 0 how tests fake Claude so `npm test` never calls the real API (e.g. an
  `AppOptions` entry holding the checker function, like `limits` for rate limiters)

### Checkpoint 0 🟢: Tests
- [ ] `test/notes-blurt-check.test.ts` with the acceptance tests below, using a fake Claude

### Checkpoint 1 🟡: Page
- [ ] "Check my gaps with AI" button on the reveal, with loading, results and error states
- [ ] Three labelled lists: Missed (summary + note quote), Wrong (summary + "You wrote" + "Your
  note"), Right (summary + your quote)
- [ ] Character counter on the blurt textarea near 10,000
- [ ] Stub `checkBlurtGaps()` in `client/src/api.ts`

### Checkpoint 2 🟢: Client API
- [ ] `checkBlurtGaps(noteId, blurt)` → `POST /api/notes/:id/blurt-check` → the three lists, or a
  typed failure carrying the server's message

### Checkpoint 3 🔴: Route + rate limiter
🔴 because it edits shared middleware (`rateLimiters.ts`) and `AppOptions`.
- [ ] `POST /:id/blurt-check` → `notes.checkBlurt` (or a new blurt controller), behind the per-user
  limiter (B9). Stub the controller method.

### Checkpoint 4 🔴: Controller (+ domain errors)
🔴 because it edits `src/errors.ts`.
- [ ] Validate: non-UUID id → 404, `blurt` must be a string → 400, over 10,000 chars → 413
- [ ] Map errors: `NoteNotFoundError` → 404, checker unavailable → 502, no API key → 503, nothing
  verified → 502 with the B7 message
- [ ] New domain errors in `src/errors.ts` (names settled in the checkpoint plan). Stub the service.

### Checkpoint 5 🟡: Service
- [ ] `checkBlurtAgainstNote(userId, noteId, blurt)`: load the note (`findNoteWithBody`), call
  the checker, apply the quote check (B6, B7)

### Checkpoint 6 🔴: Claude client
🔴 because it adds a dependency (`@anthropic-ai/sdk`) and an env var.
- [ ] `src/llm/` (exact location settled in the plan): one function that sends the note and blurt
  to `claude-sonnet-5-5` with structured outputs and returns the parsed lists, or throws a typed
  error for "no key" and "unavailable"

### Acceptance tests
- [ ] No cookie → 401 Unauthorized
- [ ] Own note + blurt → 200 with `missed`, `wrong`, `right` from the (fake) checker
- [ ] Items whose quotes aren't in the note/blurt are dropped; the rest are returned
- [ ] Every item dropped → 502 Bad Gateway with "Couldn't verify the AI's answer. Try again."
- [ ] Another user's note, unknown id, non-UUID id → 404 Not Found, and the checker isn't called
- [ ] Missing or non-string `blurt` → 400 Bad Request
- [ ] Blurt of 10,001 characters → 413 Content Too Large, and the checker isn't called
- [ ] Checker throws "unavailable" → 502 Bad Gateway
- [ ] No API key → 503 Service Unavailable
- [ ] Over the per-user limit → 429 Too Many Requests
- [ ] Non-JSON body → 415 Unsupported Media Type

**Demo:** Blurt a note, leaving out one fact and getting one wrong → "Done" → "Check my gaps
with AI" → the left-out fact is under Missed with a quote from the note, the mistake is under Wrong
with both quotes, and what you remembered is under Right. Remove `ANTHROPIC_API_KEY` and restart →
the check says "AI checks aren't set up", and self-compare still works.

---

## Overall verification (after Ticket B)
- [ ] `npm run build` and `npm test` pass
- [ ] Full flow in `npm run dev:all`: open a note → Blurt → Done → side by
  side → AI check → Blurt again
