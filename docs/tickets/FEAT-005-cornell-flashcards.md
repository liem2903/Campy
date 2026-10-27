# FEAT-005 - Cornell questions and flashcards

**Sprint:** 2 · **Branch:** `feature/cornell-flashcards` (from `main`) · **Created:** 2026-10-21

Build order: FEAT-004 block editor → FEAT-003 blurting → **FEAT-005** (this). Tickets in order:
**T1 tags → T2 questions → T3 note quiz → T4 flashcards.**

## Context

Notes are block trees edited in TipTap (FEAT-004), and a note can be blurted (FEAT-003). There is
nothing yet for active recall.

**Goal:** while taking notes, write question/answer pairs beside them, like the Cornell cue
column. Tag notes (and questions) by topic. Quiz yourself on one note's questions, and review all
questions as Anki-style spaced-repetition flashcards, optionally filtered by tag.

**Out of scope:**
- Questions pointing at a block (a nullable `questions.block_id` can come later).
- Rich-text questions or answers (plain text converts cleanly into a paragraph later).
- Saving note-quiz scores, flashcard statistics, graphs, review history.
- Reordering questions by hand, merging tags.
- AI anything.

## Shared decisions (grilled 2026-10-21)

| # | Area | Decision |
|---|---|---|
| 1 | Ownership | Every endpoint is behind `requireSession`. Another user's note, question or tag → 404 Not Found. |
| 2 | Migrations | Each ticket adds its own tables or columns in its own migration, when its code needs them. |
| 3 | Testing | Back-end acceptance tests (Vitest + Supertest). UI checked with a manual browser checklist. |
| 4 | Workflow | Same as FEAT-001/002 (see CLAUDE.md). Blast-radius tags are estimates; re-check each when its plan is presented. |

---

## T1: Tags (on notes) + Tags page

**Slice:** tag a note `queue` → the chip shows under the title → open the Tags page → `queue: 1
note` → rename it to `queues` → the note shows `queues`.

| # | Area | Decision |
|---|---|---|
| T1.1 | Storage | `tags (id, user_id → users cascade, name, unique (user_id, name))` and `note_tags (note_id, tag_id, user_id, pk (note_id, tag_id))`, with foreign keys `(note_id, user_id) → notes (id, user_id)` and `(tag_id, user_id) → tags (id, user_id)`, both cascade, so Postgres refuses a link between two users' note and tag. |
| T1.2 | Names | Lowercased and trimmed on the server. 1–50 characters, else 400 Bad Request. |
| T1.3 | On a note | Chips under the title. "+ tag" opens an input that autocompletes from your tags; Enter creates a new tag on first use. "×" removes. Saves straight away (no Save button). |
| T1.4 | Unused tags | Stay until deleted on the Tags page. |
| T1.5 | Tags page | Lists each tag with counts (`queue: 3 notes, 2 questions`; questions once T2 exists). Rename onto an existing name → **refused** ("A tag called queue already exists", 409 Conflict). Delete asks first ("Remove `queue` from 3 notes and 2 questions?") and only removes the tag. A "+ New tag" input creates a tag with no note. |
| T1.6 | Endpoints (grilled 2026-10-25) | `GET /api/notes/:id` gains `tags: [{ id, name }]`. `GET /api/tags` → `[{ id, name, noteCount }]` (one endpoint for the autocomplete and the Tags page). `POST /api/tags { name }` → 201 Created, existing name → 409 Conflict. `POST /api/notes/:id/tags { name }` → finds or creates, then attaches, in one transaction → `{ id, name }`; already attached is a no-op. `DELETE /api/notes/:id/tags/:tagId` → 204 No Content, takes it off that note only. `PATCH /api/tags/:tagId { name }` → 200 OK, taken name → 409 Conflict. `DELETE /api/tags/:tagId` → 204 No Content, cascade removes it from every note. |
| T1.7 | Edge cases (review 2026-10-26) | `DELETE /api/notes/:id/tags/:tagId` with an unknown tag or another user's tag → still 204 No Content: the note ends up without it either way, and the delete is filtered by `user_id`, so it can't touch another user's link. Adding or removing a tag does **not** bump the note's `updated_at`; tagging isn't editing the note. |

---

## T1b: Filter notes by tag (added 2026-10-25, not grilled yet; deferred until after T4 on 2026-10-26)

**Slice:** pick tag `queue` → the sidebar and the All Notes page show only notes tagged `queue`.

Open: server-side (`GET /api/notes?tag=…`) vs note list carrying each note's tags and filtering in
the browser; one tag or several; where the picker lives; whether the filter is remembered.

---

## T2: Questions (Cornell cue column)

**Slice:** in a note, press Ctrl+Alt+M → a card opens → type a question and answer → Save →
reload → the card is still there, oldest first.

| # | Area | Decision |
|---|---|---|
| T2.1 | Storage (revised 2026-10-26) | `questions (id uuid default gen_random_uuid(), user_id, note_id, question text 1–500, answer text 1–5000, created_at, updated_at, unique (id, user_id))`, foreign key `(note_id, user_id) → notes (id, user_id)` cascade, index `(note_id, created_at)`. Server-generated ids. One note per question (a column, not a join table): the same question text in two notes is two separate rows, told apart by their note and tags. Plus `question_tags (question_id, tag_id, user_id, pk (question_id, tag_id))` with foreign keys `(question_id, user_id) → questions (id, user_id)` and `(tag_id, user_id) → tags (id, user_id)`, both cascade, same pattern as `note_tags`. |
| T2.2 | Where | A cue column beside the note body (below it on phones), oldest first, answers collapsed. A "Hide questions" toggle collapses it to a "3 questions" badge; remembered in localStorage. |
| T2.3 | Adding | "+ Question" button at the top of the column, or **Ctrl+Alt+M** (Cmd+Option+M on Mac). The button shows the key. |
| T2.4 | Shortcuts panel | `?` opens a "Keyboard shortcuts" panel listing every shortcut (add question, Tab inserts 4 spaces, list keys). |
| T2.5 | Cards | Plain text, multi-line. Edited in place. **Save** button, no autosave. **Cancel / Esc** reverts to the last saved text (or removes a never-saved card). Save disabled until both fields have text. |
| T2.6 | Delete | "×" asks "Delete this question?" first. |
| T2.7 | Leaving | Unsaved card edits → warn ("You have an unsaved question. Leave anyway?") on note switch and tab close. |
| T2.8 | Question tags (revised 2026-10-26) | One plain list per question, every tag removable. A new card's tag input is **pre-filled on the client** with the note's tags; remove any before Save. Save sends tag **names** (found or created, like T1). The server stores exactly what's sent, never adds the note's tags itself. A one-off copy: tagging the note later doesn't reach existing questions. No inherited tags. |
| T2.9 | Endpoints | `GET /api/notes/:id/questions` (oldest first), `POST /api/notes/:id/questions` `{ question, answer, tags }` → 201 Created, `PUT /api/questions/:questionId` → 200 OK (full replace, like notes), `DELETE /api/questions/:questionId` → 204 No Content. Empty or too-long field → 400 Bad Request. |
| T2.10 | Note delete | Deletes its questions (cascade), and anything hanging off them. |
| T2.11 | Built 2026-10-26 | One card open for editing at a time (opening another asks if it has changes). Ctrl/⌘ + Enter saves a card. A tag still typed in the card's input is saved with it. The leave warning (T2.7) covers link clicks and tab close/reload; the back button and the sidebar's New page button aren't caught (the router has no navigation blocker). |

---

## T3: Note quiz

**Slice:** on a note with questions, press "Quiz" → one question at a time → reveal, mark Right or
Wrong → "4 / 5 right" → "Blurt" or "Review notes".

| # | Area | Decision |
|---|---|---|
| T3.1 | Entry | "Quiz" button in the note page header, **only when the note has questions**. Opens `/notes/:id/quiz`. |
| T3.2 | Page | Title visible as the cue; body and cue column hidden. |
| T3.3 | Flow | One question at a time, in created order. "Show answer" (Space), then **Right / Wrong**. |
| T3.4 | End | Score (right / wrong), then **Blurt** (FEAT-003 blurt page) or **Review notes** (`/notes/:id`). |
| T3.5 | Storage | Nothing saved. Never touches the flashcard schedule. No new endpoint (uses T2's `GET`). |

---

## T4: Flashcards (Anki-style)

**Slice:** open "Flashcards" → "5 due · 3 new" → Start → reveal, grade 1–4 → end summary →
tomorrow the cards graded Good are not due, the ones graded Again are.

| # | Area | Decision |
|---|---|---|
| T4.1 | Storage | Schedule columns on `questions`: `ease` (default 2.5), `interval_days` (default 0), `due_on date` (null = new card), `last_graded_on date`. `users.new_cards_per_day` (default 20). |
| T4.2 | Grades | **Again / Hard / Good / Easy** (keys 1–4), each showing its next interval. SM-2: interval 1 → 6 → `interval × ease`; Again → interval 1, ease −0.2 (min 1.3); Easy → ease +0.15. |
| T4.3 | Again in session | The card goes to the end of the queue until passed. Only the **first** grade of the day changes the schedule. |
| T4.4 | Days | Calendar days in the user's time zone (browser sends it, e.g. `Australia/Sydney`); the day starts at **4 am**. |
| T4.5 | New-card cap | Per day, set on a settings page (default 20). |
| T4.6 | Edits | Editing a question keeps its schedule. |
| T4.7 | Page | "Flashcards" in the sidebar → `/flashcards`. Start screen: "N due · M new", optional tag filter (empty = everything; several tags = cards with **any** of them, by the question's own tags), Start. Nothing due → "All done for today. Next card due tomorrow (4)". Also reachable from a "Study" link per tag on the Tags page → `/flashcards?tag=<id>` (same screen, tag pre-selected). One schedule per question: grading from a tag session counts everywhere (added 2026-10-26). |
| T4.8 | Session | Progress ("8 left"), question, Show answer (Space), grade. Each grade saves at once, so leaving mid-session loses nothing. End: "Done: 17 cards" with counts per button, "Back". |

---

## Overall verification
- [ ] `npm run build` and `npm test` pass
- [ ] Every ticket's slice works in `npm run dev:all`
- [ ] `backend-reviewer` run on the back-end changes, findings addressed
