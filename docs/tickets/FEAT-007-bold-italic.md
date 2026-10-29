# FEAT-007 - Bold and italic in notes

**Sprint:** 2 · **Branch:** `feature/bold-italic` (from `main`) · **Created:** 2026-10-29

## Context

A note body is a tree of `text` and `list_item` blocks (FEAT-004), each with a plain
`properties.text`. Blurting, questions and flashcards read that plain text. There's no inline
formatting yet.

**Goal:** make text bold or italic in the editor, with a keyboard shortcut or from a small menu
that appears over selected text, and get the formatting back after a reload.

**Out of scope:** underline, strikethrough, code, links, colours. Each one would be a new mark
type with the same shape as the ones added here.

## Shared decisions (2026-10-29)

| # | Area | Decision |
|---|---|---|
| 1 | Storage | Option A: mark ranges next to the plain text, `properties: { text, marks?: [{ type: 'bold' \| 'italic', from, to }] }`. `text` stays plain, so every current reader of it is unchanged. `properties` is already `jsonb`, so **no migration**. |
| 2 | Offsets | `from`/`to` are UTF-16 offsets into `text` (JS string indexes, the same as ProseMirror's in-paragraph positions), `to` exclusive. |
| 3 | Optional | A block with no formatting has no `marks` key, so existing notes and drafts stay the same. |
| 4 | Validation (`PUT`) | 400 Bad Request when `marks` isn't an array, a mark's `type` isn't `bold`/`italic`, `from`/`to` aren't integers, or `0 ≤ from < to ≤ text.length` fails. The check runs on the text after NUL removal. Unknown keys inside a mark are dropped. Overlapping marks are allowed: TipTap merges them on load. |
| 5 | Applying | Ctrl/⌘+B, Ctrl/⌘+I and markdown typing (`**bold**`, `*italic*`) from TipTap's Bold/Italic extensions, plus a floating **B / I** menu on text selection (BubbleMenu), for the phone layout. The shortcuts are listed in the shortcuts panel. |
| 6 | Viewer | The read-only `NoteBodyViewer` shows the formatting too (the extensions are shared). |
| 7 | Testing | Back-end acceptance tests (Vitest + Supertest). The editor is checked with a manual browser checklist. |

---

## Ticket 1: Bold and italic, saved and reloaded 🔴

**Slice:** type `milk and eggs` → select `milk` → ⌘B → select `eggs` → tap **I** in the menu →
"Saved" → reload → `milk` is bold and `eggs` is italic, in the editor and in the viewer.

🔴 because it changes the shared block contract (`BlockProperties` in `src/db/types.ts`, the block
schema in `notes.controller.ts`, and `client/src/blockTreeConversion.ts`).

### Checkpoints (top-down; the exact split is settled in each plan)
- [x] **0 🟢 Tests:** the acceptance tests below
- [x] **1 🟡 Page:** Bold/Italic extensions, BubbleMenu with B / I, shortcuts panel rows
- [x] **2 🔴 Client types + conversion:** `marks` on the client block types; marks ↔ TipTap text nodes in `blockTreeConversion.ts`
- [x] **3 🔴 Controller + types:** the `marks` schema and range check (decision 4), `BlockProperties`

### Acceptance tests
- [x] Bold and italic marks on a paragraph and a list item round-trip through `PUT` → `GET`
- [x] A block saved without marks comes back without a `marks` key
- [x] Unknown keys inside a mark are dropped
- [x] Each rule in decision 4 → 400 Bad Request, nothing written

### Manual checklist
- [x] ⌘B / ⌘I toggle; `**x**` and `*x*` convert as you type
- [x] Selecting text shows the B / I menu; the active one is highlighted; it works on a phone width
- [x] Bold and italic inside a list item survive a reload
- [ ] The viewer (blurt reveal) shows the formatting
