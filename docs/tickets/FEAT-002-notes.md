# FEAT-002 - notes storage

**Sprint:** 1 · **Branch:** `feature/notes` (from `main`) · **Created:** 2026-10-12

## Context

Notes currently live only in the browser. `client/src/NotesProvider.tsx` stores `{ id, title, body, updatedAt }`
in `localStorage` (`campi.notes`), and `client/src/pages/NotePage.tsx` edits the body in a
plain `<textarea>`. So notes aren't tied to the logged-in user and don't follow them to another
browser.

The DB already has the tables: `notes` (`id, user_id, title, …`) and `blocks` (fractional
`position`, `parent_id`, `type`, `properties` jsonb, `version`), with row types in
`src/db/types.ts`. There is no notes API yet.

**Goal:** notes are stored in Postgres per user. The textarea stays. Each note's whole body is
stored in **one `text` block**, and a real block editor is a separate, later feature.

The work is split into **five tracer-bullet tickets, one per endpoint**. Each one is a thin
slice through DB → API → UI → test that runs and demos on its own. Shared setup goes into the
first ticket that needs it.

**Out of scope:** block editor, nested blocks, bullet points and other formatting (typing `- `
becomes a `list_item` block in the block editor feature), folders, conflict detection (Sprint 3), rate
limiting the notes endpoints, migrating existing localStorage notes, soft delete or trash.

## Shared decisions (apply to every ticket)

| Area | Decision |
|---|---|
| Body storage | One `text` block per note (`parent_id` null, `position` `'a0'`) holding the whole body in `properties.text`. The schema already supports this, so **no migration**. |
| API shape | `GET /api/notes` → `[{ id, title, updatedAt }]`, most recently edited first. `GET /api/notes/:id` → `{ id, title, body, updatedAt }`. `updatedAt` is an ISO string. snake_case → camelCase mapping happens in the controller. |
| Ownership | Every notes route sits behind `requireSession`. Every query is scoped by `user_id`. Another user's note → 404, the same response as a note that doesn't exist. A `:id` that isn't a UUID → 404 too, and never reaches SQL. (These are the items deferred from FEAT-001 Ticket 2.) |
| Transactions | Anything that writes both `notes` and `blocks` runs in one `sql.begin` in the service. Repositories take `db: Db = sql`. |
| Validation | Title: a string of ≤ 200 chars. It may be empty, and the UI shows "Untitled". Body: a string, capped by the default 100kb limit of `express.json` (→ 413). |
| Domain errors | `NoteNotFoundError` (→ 404 "Note not found") and `NoteIdTakenError` (→ 409) in `src/errors.ts`. |
| Conflicts | Last write wins. Concurrency is Sprint 3. |
| Rate limiting | None on notes endpoints. |
| Transition | Hybrid. Each ticket moves only its own piece of `NotesProvider` off localStorage, so every commit works end to end. Ticket 5 removes the last of the old `campi.notes` code. |
| Client types | `client/src/notes.ts` splits into `NoteSummary` (list) and `NoteDetail` (page) as soon as the server list arrives (Ticket 2). |
| Tests | Vitest + Supertest, `test/notes-*.test.ts`, reusing `test/helpers.ts`. Each test signs up its own users, and the `users` cascade cleans up their notes and blocks. |
| Workflow | Same as FEAT-001 (see CLAUDE.md): tests first, then top-down checkpoints, each one explained, quizzed and committed. The blast-radius tags below are estimates; re-check each one when its plan is presented. |

### Definition of done (every ticket)
- [ ] Built with the Workflow: tests first, then top-down checkpoints, each one explained and committed
- [ ] Acceptance tests written and passing (`npm test`)
- [ ] `npm run build` passes (strict TS, no `any`)
- [ ] Demo path works in `npm run dev:all`
- [ ] Feature described by the developer, `backend-reviewer` sub-agent run, findings addressed
- [ ] Committed on `feature/notes`

---

## Ticket 1: Create (carries the foundation)

**Slice:** Clicking "+ New page" creates the note on the server, scoped to the logged-in user.
The page opens immediately, without waiting for the server.

**Interim behavior:** the sidebar list, the note page and editing still use localStorage. The new
note is added there as well as on the server. The create retry loop stops when the note is deleted
locally, but not on logout: the localStorage list survives logout, so the note still "exists". This
closes in Ticket 2, when each user's list comes from the server.

### Checkpoint 0 🟢: Tests (written first, failing)
- [x] Move the `signedUp(app)` helper from `test/me.test.ts` into `test/helpers.ts` so every
  notes test can get a logged-in cookie
- [x] `test/notes-create.test.ts` with the acceptance tests below

### Checkpoint 1 🟡: Page
- [x] `NotesProvider.createNote()` keeps returning the new `crypto.randomUUID()` synchronously,
  so `Sidebar` and `WorkspaceHome` navigate at once. It adds the note locally, then calls
  `createNoteOnServer(id)` in `api.ts`.
- [x] A failed create retries every 3s until it succeeds. On a 409, generate a new id, swap it
  into local state, `navigate(..., { replace: true })` to the new URL, and retry.
- [x] Stub `createNoteOnServer()` in `client/src/api.ts`

### Checkpoint 2 🟢: Client API
- [x] `createNoteOnServer(id)` → `POST /api/notes { id }` → `'created' | 'taken'` (409 → `'taken'`)

### Checkpoint 3 🔴: Route layer
🔴 because it changes shared app wiring: `src/app.ts` mounts a new router behind `requireSession`.
- [x] `src/routes/notes.routes.ts`: `notesRoutes(options)` puts `requireSession({ secureCookies })`
  on the whole router, plus `POST /` → `notes.create`
- [x] `src/app.ts`: `app.use("/api/notes", notesRoutes(options))`, mounted before the `/api` 404
- [x] Stub `src/controllers/notes.controller.ts`

### Checkpoint 4 🔴: Controller (+ domain errors)
🔴 because it edits `src/errors.ts`.
- [x] `notes.create`: `id` must be a UUID string (400 "Invalid note id"), then call the service
- [x] `201 { id, title, body, updatedAt }` when the note is created, or `200` with the same shape
  when this user already owns that id (an idempotent retry)
- [x] `NoteIdTakenError` → 409 "That note id is already taken"
- [x] Add `NoteNotFoundError` and `NoteIdTakenError` to `src/errors.ts`. Stub the service.

### Checkpoint 5 🟢: Service
- [x] `src/services/notes.service.ts` `createNote(userId, id)`, in one `sql.begin`:
  - insert the note. If the id already exists: owned by this user → return it (`created: false`),
    owned by someone else → `NoteIdTakenError`
  - insert its empty `text` block (`position 'a0'`, `properties { text: '' }`)
- [x] Stub the repositories

### Checkpoint 6 🟢: Repositories
- [x] `src/repositories/notes.repository.ts`: `insertNote(userId, id, db)` using
  `on conflict (id) do nothing returning *`, and `findNoteWithBody(userId, id, db)` (brought forward
  from Ticket 3: a retry must return the whole note, and null after a conflict = another user's id)
  Filter on `user_id`, left join the top-level `text` block and `coalesce(properties->>'text', '')`
  so an owned note is never null (null would turn the user's own retry into 409).
- [x] `src/repositories/blocks.repository.ts`: `insertBlock(noteId, block, db)`

### Acceptance tests
- [x] No cookie → 401
- [x] Valid `{ id }` → 201 with `{ id, title: '', body: '', updatedAt }`
- [x] Creates exactly one `notes` row owned by the user and one top-level `text` block with `text: ''`
- [x] Same user posts the same id again → 200 with the same note, still one note and one block
- [x] Another user posts that id → 409, and the original note is unchanged
- [x] Missing or non-UUID `id` → 400
- [x] Non-JSON body → 415

**Demo:** Log in → "+ New page" → the page opens → a `notes` row appears in Supabase Studio
(`localhost:54323`) for that user.

---

## Ticket 2: List (sidebar)

**Slice:** The sidebar shows the logged-in user's notes from the server, most recently edited first,
and survives a change of browser.

**Interim behavior:** each note's body still goes to localStorage until Ticket 4. Title edits only
change the in-memory list, so a reload shows the server's title until Ticket 4.
Logging in as a different user no longer shows the previous user's notes.

### Checkpoint 0 🟢: Tests
- [x] `test/notes-list.test.ts` with the acceptance tests below

### Checkpoint 1 🔴: Page + client types
🔴 because it changes the client `Note` type used by `NotesProvider`, `Sidebar`, `WorkspaceHome`
and `NotePage`.
- [x] `client/src/notes.ts`: `NoteSummary { id, title, updatedAt }` and `NoteDetail` (+ `body`)
- [x] `NotesProvider` loads the list from `listNotes()` whenever the logged-in user changes (not on
  mount: it sits outside `RequireAuth`) and keeps `loading` until it has it. A stale flag drops a late
  answer for a previous user. Failed loads retry every 3s, with a message after 3 failures.
  `HomePage`, `AllNotesPage` and `NotePage` wait for it before showing empty or "doesn't exist" states.
- [x] Sidebar order: most recently edited first, as the server returns it
- [x] Sidebar shows only the 8 most recent (`notes.slice(0, 8)`) plus an "All notes →" link; the
  All Notes page shows the full list. Both read the one list `NotesProvider` loaded (no `?limit`;
  pagination later if lists get large).
- [x] Stub `listNotes()` in `client/src/api.ts`

### Checkpoint 2 🟢: Client API
- [x] `listNotes()` → `GET /api/notes` → `NoteSummary[]`

### Checkpoint 3 🟡: Route
- [ ] `GET /` → `notes.list` in `notes.routes.ts`. Stub the controller method.

### Checkpoint 4 🟡: Controller
- [ ] `notes.list` → `200 [{ id, title, updatedAt }]`. Stub the service.

### Checkpoint 5 🟡: Service
- [ ] `listNotes(userId)` → `notes.repository.listNotes(userId)`. Stub the repository function.

### Checkpoint 6 🟡: Repository
- [ ] `listNotes(userId, db)`: this user's notes ordered by `updated_at desc`
  (served by `notes_user_id_updated_at_idx`)

### Acceptance tests
- [ ] No cookie → 401
- [ ] New user → `[]`
- [ ] Returns only this user's notes, never another user's
- [ ] Ordered by `updatedAt` descending
- [ ] Items have exactly `id`, `title`, `updatedAt` (no body)

**Demo:** Create two notes → open the app in a private window, log in → both are in the sidebar.

---

## Ticket 3: Open (note page)

**Slice:** Opening `/notes/:id` loads that note's title and body from the server. Another user's
note shows the "doesn't exist" page.

**Interim behavior:** edits still go to localStorage until Ticket 4. While they do, `NotePage`
shows a local copy for that id if there is one, and the server copy otherwise.

### Checkpoint 0 🟢: Tests
- [ ] `test/notes-open.test.ts` with the acceptance tests below. This includes the
  **cross-user 404 deferred from FEAT-001 Ticket 2**.

### Checkpoint 1 🟡: Page
- [ ] `NotePage` fetches `getNote(noteId)` when `noteId` changes: blank while loading, the
  existing "This page doesn't exist" view on 404
- [ ] Ignore a response for a note the user has already navigated away from
- [ ] Stub `getNote()` in `client/src/api.ts`

### Checkpoint 2 🟢: Client API
- [ ] `getNote(id)` → `GET /api/notes/:id` → `NoteDetail`

### Checkpoint 3 🟡: Route
- [ ] `GET /:id` → `notes.get` in `notes.routes.ts`. Stub the controller method.

### Checkpoint 4 🟡: Controller
- [ ] `notes.get`: a non-UUID `id` → 404 without calling the service. `NoteNotFoundError` →
  404 "Note not found". Otherwise `200 { id, title, body, updatedAt }`. Stub the service.

### Checkpoint 5 🟡: Service
- [ ] `getNote(userId, id)`: throws `NoteNotFoundError` when the note is missing or belongs to
  another user. Stub the repository function.

### Checkpoint 6 🟡: Repository
- [ ] `notes.repository.findNoteWithBody(userId, id, db)`: joins `notes` to its top-level block
  and returns `body` from `properties->>'text'`

### Acceptance tests
- [ ] No cookie → 401
- [ ] Own note → 200 `{ id, title, body, updatedAt }`
- [ ] Another user's note → 404, the same body as a missing note
- [ ] Unknown UUID → 404
- [ ] Non-UUID id → 404

**Demo:** Open a note → reload → it loads. Log in as a second user and paste the first user's note
URL → "This page doesn't exist".

---

## Ticket 4: Autosave

**Slice:** Typing saves the title and body to the server automatically, with a visible save
status. Nothing is lost on navigation, logout, a dropped connection or an expired session.

### Checkpoint 0 🟢: Tests
- [ ] `test/notes-update.test.ts` with the acceptance tests below

### Checkpoint 1 🟡: Page: debounced save + status
- [ ] `client/src/useAutosave.ts`: holds the latest `{ title, body }` and saves 500ms after the
  last keystroke. Status is "Saving…", "Saved" or "Couldn't save", shown on `NotePage`.
- [ ] Saves for a note wait until its create (Ticket 1) has succeeded
- [ ] Only one save is in flight at a time. Edits made during a save are sent after it.
- [ ] Stub `updateNote()` in `client/src/api.ts`

### Checkpoint 2 🟡: Page: retry, flush, leave guard
- [ ] A failed save keeps the text in the editor and retries every 3s until it succeeds
- [ ] Flush the pending save immediately on in-app navigation and before logout
- [ ] A `beforeunload` "Leave site?" prompt while a save is pending or has failed

### Checkpoint 3 🟡: Page: 401 stash
- [ ] Before the 401 redirect to `/login`, store the unsaved `{ title, body }` in localStorage
  under `campi.draft.<noteId>`
- [ ] After login, `NotePage` restores a draft for that note, saves it, then deletes the draft
  (this replaces Ticket 3's interim local-copy overlay)

### Checkpoint 4 🟢: Client API
- [ ] `updateNote(id, { title, body })` → `PATCH /api/notes/:id` → `{ updatedAt }`

### Checkpoint 5 🟡: Route
- [ ] `PATCH /:id` → `notes.update` in `notes.routes.ts`. Stub the controller method.

### Checkpoint 6 🟡: Controller
- [ ] `notes.update`: both `title` and `body` are required strings. Title > 200 chars → 400
  "Title must be 200 characters or fewer". Non-UUID id or `NoteNotFoundError` → 404.
- [ ] `200 { updatedAt }`. Stub the service.

### Checkpoint 7 🟡: Service
- [ ] `updateNote(userId, id, { title, body })` in one `sql.begin`: update the title (zero rows →
  `NoteNotFoundError`), then the body block. Stub the repository functions.

### Checkpoint 8 🟡: Repositories
- [ ] `notes.repository.updateTitle(userId, id, title, db)`: scoped by `user_id`, `returning
  updated_at`
- [ ] `blocks.repository.updateBodyText(noteId, text, db)`: sets the top-level block's
  `properties.text`. The `updated_at` triggers bump both rows.

### Acceptance tests
- [ ] No cookie → 401
- [ ] Valid update → 200; a following `GET /api/notes/:id` returns the new title and body
- [ ] `updatedAt` moves forward, and the note moves to the top of `GET /api/notes`
- [ ] Another user's note → 404, and the note is unchanged
- [ ] Title of 201 chars → 400. Missing or non-string `title`/`body` → 400.
- [ ] Body over 100kb → 413
- [ ] Non-JSON body → 415

**Demo:** Type → "Saved" → reload, and the text is still there. Stop the server mid-typing →
"Couldn't save" → restart it → it saves on its own. Delete the `sid` cookie mid-typing → log in →
the text is restored and saved.

---

## Ticket 5: Delete (+ remove localStorage)

**Slice:** Deleting a note asks for confirmation, then removes it and its blocks from the server.
After this ticket, notes no longer touch localStorage.

### Checkpoint 0 🟢: Tests
- [ ] `test/notes-delete.test.ts` with the acceptance tests below

### Checkpoint 1 🟡: Page
- [ ] The sidebar "×" opens a confirm dialog ("Delete "<title>"? This can't be undone."), then
  calls `deleteNote(id)` and navigates to `/` if it was the open note
- [ ] Cancel a pending autosave for that note so it can't recreate the note or hit a 404
- [ ] Remove the remaining `campi.notes` code from `NotesProvider`. Only `campi.draft.<id>`
  (the Ticket 4 stash) stays.
- [ ] Stub `deleteNote()` in `client/src/api.ts`

### Checkpoint 2 🟢: Client API
- [ ] `deleteNote(id)` → `DELETE /api/notes/:id`

### Checkpoint 3 🟡: Route
- [ ] `DELETE /:id` → `notes.remove` in `notes.routes.ts`. Stub the controller method.

### Checkpoint 4 🟡: Controller
- [ ] `notes.remove` → 204. Non-UUID id or `NoteNotFoundError` → 404. Stub the service.

### Checkpoint 5 🟡: Service
- [ ] `deleteNote(userId, id)`: zero rows deleted → `NoteNotFoundError`. Stub the repository
  function.

### Checkpoint 6 🟡: Repository
- [ ] `notes.repository.deleteNote(userId, id, db)`: scoped by `user_id`, returns the row count.
  Blocks go through `on delete cascade`.

### Acceptance tests
- [ ] No cookie → 401
- [ ] Own note → 204. The `notes` row and its blocks are gone, and `GET /api/notes/:id` → 404.
- [ ] Another user's note → 404, and the note still exists
- [ ] Deleting twice → the second call is 404
- [ ] Non-JSON `Content-Type` → 415 (the client sends `{}` like logout)

**Demo:** Delete a note → confirm → it leaves the sidebar and stays gone after a reload.
Cancel → nothing changes.

---

## Overall verification (after Ticket 5)
- [ ] `npm run build` and `npm test` pass (notes + auth tests)
- [ ] Full flow in `npm run dev:all` (or the `run-campi` skill): sign up → new note → type →
  "Saved" → reload → still there → second user can't see it → delete with confirm
- [ ] No `campi.notes` key in localStorage after using the app
