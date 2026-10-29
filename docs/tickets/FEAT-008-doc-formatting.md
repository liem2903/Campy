# FEAT-008 - Doc formatting (underline, strikethrough, headings) + rich blurts

**Sprint:** 2 · **Branch:** `feature/doc-formatting` (from `main`) · **Created:** 2026-10-29

## Context

A note body is a tree of `text` and `list_item` blocks (FEAT-004). Each block has a plain
`properties.text` plus optional `marks` ranges for bold and italic (FEAT-007). The blurt page
(FEAT-003) uses a plain textarea, and nothing in it is saved.

**Goal:** basic doc editing in notes: underline, strikethrough and H1–H3 headings. The
blurt page gets the same editor, so you can blurt with dot points, bold, headings and the rest.

**Out of scope:** links (dropped 2026-10-29), code (inline and blocks), font sizes other than heading levels, colours, tables,
images, saving blurts.

## Shared decisions (reviewed 2026-10-29)

| # | Area | Decision |
|---|---|---|
| 1 | Storage | Same as FEAT-007: `text` stays plain and formatting lives in `marks` ranges. `properties` is `jsonb`, and the `block_type` enum already has `heading`, so **no migration**. |
| 2 | Mark types | `TextMark` gets `underline` and `strike`. The names match TipTap's, so conversion doesn't need a name map. |
| 3 | Headings | A new top-level block type `heading` with `{ text, level: 1 \| 2 \| 3, marks? }`. No children, and not allowed inside list items. Each level gets its own size in CSS. |
| 4 | Validation (`PUT`) | Same rules as FEAT-007 decision 4, plus: an unknown mark type, or a heading with a `level` outside 1–3 or with children → 400 Bad Request. |
| 5 | Applying | Ctrl/⌘+U = underline; Ctrl/⌘+Shift+S and `~~x~~` = strikethrough; `# `, `## ` and `### ` = headings (plus TipTap's Ctrl/⌘+Alt+1/2/3). The bubble menu gets **U** and **S**. All of them go in the shortcuts panel. |
| 6 | Other readers | Questions, flashcards and blurting read `properties.text`, which stays plain, so they don't change. Cornell question anchors (`blockIdAtSelectionStart`, `blockTextsInReadingOrder`) have to count headings as blocks. |
| 7 | Rich blurts | The blurt textarea becomes a TipTap editor using `noteBodyContentExtensions` and the bubble menu, without UniqueID because nothing is saved. Still nothing is stored, so it's **client only**. On the reveal, the blurt shows with its formatting, read-only. |
| 8 | Testing | Back-end acceptance tests (Vitest + Supertest) for tickets 1–2. Manual browser checklists for the editor and the blurt page. |
| 9 | Workflow | Same as earlier features (see CLAUDE.md). Blast-radius tags are estimates; each gets re-checked when its plan is presented. |

Resolved 2026-10-29: links dropped, three heading levels, rich blurts last.

---

## Ticket 1: Underline and strikethrough 🔴

**Slice:** select `milk` → ⌘U → select `eggs` → tap **S** → "Saved" → reload → `milk` is
underlined and `eggs` is struck through, in the editor and in the viewer.

🔴 because it changes the shared `TextMark` type (`src/db/types.ts`, `client/src/notes.ts`), the
mark schema in `notes.controller.ts` and `blockTreeConversion.ts`.

### Acceptance tests
- [ ] Underline and strike marks round-trip through `PUT` → `GET` on a paragraph and a list item
- [ ] An unknown mark type → 400 Bad Request, nothing written

### Manual checklist
- [ ] ⌘U, ⌘⇧S and `~~x~~` work; U and S in the bubble menu show as pressed when active
- [ ] Both survive a reload and show in the viewer

---

## Ticket 2: Headings H1–H3 🔴

**Slice:** type `# Cells`, Enter, a paragraph, `## Mitochondria` → reload → both headings come
back at their sizes, stored as `heading` blocks with levels 1 and 2.

🔴 because it adds a block type to the shared block contract (controller schema,
`BlockProperties`, `NoteBlock` on both sides, `blockTreeConversion.ts`, the service's row mapping).

### Acceptance tests
- [ ] Heading blocks at levels 1–3, with marks, round-trip in order with the same ids
- [ ] Level 0 or 4, a missing level, or a heading with children → 400 Bad Request, nothing written

### Manual checklist
- [ ] `# `, `## `, `### ` and ⌘⌥1/2/3 work; ⌘⌥ + the same level turns it back into a paragraph
- [ ] A question anchored to a paragraph stays linked after `# ` turns that paragraph into a heading (the id is kept)
- [ ] A Cornell question can be anchored to a heading
- [ ] Headings show in the viewer at their sizes

---

## Ticket 3: Gentler flashcard start 🟡 (added 2026-10-29)

**Slice:** grade a new card Good → tomorrow it shows **now / 1d / 3d / 4d** (was 1d / 1d / 6d / 8d)
→ Good → due in 3 days.

🟡 because it changes how existing grading behaves (`flashcardSchedule.ts`) and one label in
`FlashcardStudySession.tsx`. No API or schema change.

| # | Decision |
|---|---|
| 3.1 | Good on a card at 1 day → **3 days** (SM-2's 6 was too big a jump). Easy follows: 3 × 1.3 ≈ 4. Every other rule stays (FEAT-005 T4.10). Cards already past that step keep their interval. |
| 3.2 | The Again button's label is **"now"**, not "1d": the card comes back at the end of the session. It's still also due tomorrow. |

### Acceptance tests
- [x] A card at 1 day gives 1 / 1 / 3 / 4 days
- [x] A new card graded Again then Good is due in 3 days
- [x] The grade endpoint returns `good: 3, easy: 4` after a first Good

### Manual checklist
- [ ] Again shows "now"; the other buttons show days

---

## Ticket 4: Rich blurts 🟡

**Slice:** open a blurt → type `* mitochondria`, Enter, `**ATP**` → "I'm done" → the left
column shows your dot points with bold, next to the note.

🟡 because it's client only (`BlurtPage.tsx`, `BlurtReveal.tsx`) and only uses existing shared
extensions; no contracts change.

### Manual checklist
- [ ] Every format from tickets 1–2, plus lists, bold and italic, works in the blurt editor, bubble menu included
- [ ] The word count, leave warning (non-empty blurt only) and ⌘+Enter = "I'm done" still work
- [ ] The reveal shows the blurt with its formatting, read-only; "Blurt again" empties it, and R still works
- [ ] Nothing about the blurt is sent to the server
