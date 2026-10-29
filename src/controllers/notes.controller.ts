import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { BlockOfAnotherNoteError, NoteIdTakenError, NoteNotFoundError } from "../errors.js";
import * as notesService from "../services/notes.service.js";
import type { Note, NoteBlock, NoteDetail, NoteWithTagIds } from "../services/notes.service.js";
import type { TextMark } from "../db/types.js";
import { uuidPattern } from "./validation.js";
const MAX_TITLE_LENGTH = 200;
const INVALID_BLOCKS = "Invalid blocks";
// Top level is depth 1.
const MAX_LIST_DEPTH = 9;

// A bold or italic run. Whether it fits inside its block's text is checked by marksFitText.
const textMarkSchema = z.object({
  type: z.enum(["bold", "italic"]),
  from: z.number().int().nonnegative(),
  to: z.number().int(),
});

// z.object drops keys it doesn't list (e.g. properties.color), so only known fields reach the service.
const textBlockSchema = z.object({
  id: z.string().regex(uuidPattern),
  type: z.literal("text"),
  properties: z
    .object({ text: z.string().transform(withoutNul), marks: z.array(textMarkSchema).optional() })
    .refine(marksFitText),
  // Listed so it's rejected, not silently dropped: a text block can't have children.
  children: z.never().optional(),
});

// One schema per depth, so the depth limit is part of the shape: an item at MAX_LIST_DEPTH only
// accepts an empty children array. A function declaration so it's hoisted above noteBlocksSchema.
function listItemSchemaAtDepth(depth: number): z.ZodType<NoteBlock, unknown> {
  return z.object({
    id: z.string().regex(uuidPattern),
    type: z.literal("list_item"),
    properties: z
      .object({
        text: z.string().transform(withoutNul),
        style: z.enum(["bullet", "numbered"]),
        marks: z.array(textMarkSchema).optional(),
      })
      .refine(marksFitText),
    children: depth < MAX_LIST_DEPTH
      ? z.array(listItemSchemaAtDepth(depth + 1)).default([])
      : z.tuple([]).default([]),
  });
}

// The tree PUT takes. Ids must be unique at every depth: a repeat would make the upsert write one
// row twice, which Postgres rejects with a 500. The type is a compile error if the schema and
// NoteBlock drift apart.
const noteBlocksSchema: z.ZodType<NoteBlock[], unknown> = z
  .array(z.union([textBlockSchema, listItemSchemaAtDepth(1)]))
  .refine((blocks) => {
    const allIds = idsInTree(blocks);
    return new Set(allIds).size === allIds.length;
  });

// GET /api/notes: this user's notes, most recently edited first, each with its tag ids.
export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const notes = await notesService.listNotes(req.user!.id); // requireSession set it
    res.json(notes.map(toListItemJson));
  } catch (err) {
    next(err);
  }
}

// GET /api/notes/:id: this user's note with its blocks and tags. A missing note, another user's note and
// a malformed id all get the same 404, so a response never reveals which.
export async function get(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // A non-UUID would make Postgres throw (a 500), so it never reaches the service.
    if (!uuidPattern.test(req.params.id)) throw new NoteNotFoundError();
    const note = await notesService.getNote(req.user!.id, req.params.id); // requireSession set it
    res.json(toJson(note));
  } catch (err) {
    if (err instanceof NoteNotFoundError) {
      res.status(404).json({ error: err.message });
      return;
    }
    next(err);
  }
}

// POST /api/notes { id }: 201 when created, 200 when this user already owns the id (a retry).
export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  const { id } = req.body as { id?: unknown };
  if (typeof id !== "string" || !uuidPattern.test(id)) {
    res.status(400).json({ error: "Invalid note id" });
    return;
  }

  try {
    const { note, created } = await notesService.createNote(req.user!.id, id); // requireSession set it
    res.status(created ? 201 : 200).json(toJson(note));
  } catch (err) {
    if (err instanceof NoteIdTakenError) {
      res.status(409).json({ error: err.message });
      return;
    }
    next(err); // unexpected → the JSON error handler in app.ts
  }
}

// PUT /api/notes/:id { title, blocks }: replaces both and returns the new updatedAt.
// Autosave sends the whole note every time, so both fields are required.
export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  const { title, blocks } = req.body as { title?: unknown; blocks?: unknown };
  if (typeof title !== "string") {
    res.status(400).json({ error: "Title must be a string" });
    return;
  }
  // Postgres text can't store \u0000. Rejecting it would leave the user stuck on a character they
  // can't see, so drop it.
  const titleWithoutNul = withoutNul(title);
  if (titleWithoutNul.length > MAX_TITLE_LENGTH) {
    res.status(400).json({ error: `Title must be ${MAX_TITLE_LENGTH} characters or fewer` });
    return;
  }
  // One message for every shape problem: only a buggy or hostile client sends a bad tree.
  const parsedBlocks = noteBlocksSchema.safeParse(blocks);
  if (!parsedBlocks.success) {
    res.status(400).json({ error: INVALID_BLOCKS });
    return;
  }

  try {
    // Same 404 as GET for a malformed id: it never reaches the service.
    if (!uuidPattern.test(req.params.id)) throw new NoteNotFoundError();
    const content = { title: titleWithoutNul, blocks: parsedBlocks.data };
    const updatedAt = await notesService.updateNote(req.user!.id, req.params.id, content); // requireSession set it
    res.json({ updatedAt: updatedAt.toISOString() });
  } catch (err) {
    if (err instanceof NoteNotFoundError) {
      res.status(404).json({ error: err.message });
      return;
    }
    // Same message as a bad shape, so the response never reveals that the id exists elsewhere.
    if (err instanceof BlockOfAnotherNoteError) {
      res.status(400).json({ error: INVALID_BLOCKS });
      return;
    }
    next(err);
  }
}

// DELETE /api/notes/:id: deletes this user's note and its blocks. Same 404 rules as GET.
export async function remove(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!uuidPattern.test(req.params.id)) throw new NoteNotFoundError();
    await notesService.deleteNote(req.user!.id, req.params.id); // requireSession set it
    res.status(204).end();
  } catch (err) {
    if (err instanceof NoteNotFoundError) {
      res.status(404).json({ error: err.message });
      return;
    }
    next(err);
  }
}

// A function declaration so it's hoisted: noteBlocksSchema, near the top, uses it.
function withoutNul(text: string): string {
  return text.replaceAll("\u0000", "");
}

// Each mark covers at least one character and ends inside the text (checked after NUL removal).
// A function declaration so the block schemas, near the top, can use it.
function marksFitText(properties: { text: string; marks?: TextMark[] }): boolean {
  return (properties.marks ?? []).every((mark) => mark.from < mark.to && mark.to <= properties.text.length);
}

// Every block's id, at every depth. A function declaration so noteBlocksSchema can use it.
function idsInTree(blocks: NoteBlock[]): string[] {
  return blocks.flatMap((block) =>
    block.type === "list_item" ? [block.id, ...idsInTree(block.children)] : [block.id]);
}

// DB row → API shape: camelCase, and updatedAt as an ISO string.
function toJson(note: NoteDetail) {
  return { ...toSummaryJson(note), blocks: note.blocks, tags: note.tags };
}

function toSummaryJson(note: Note) {
  return { id: note.id, title: note.title, updatedAt: note.updated_at.toISOString() };
}

// List items leave out blocks: the sidebar needs id, title and updatedAt, the tag filter tagIds.
function toListItemJson(note: NoteWithTagIds) {
  return { ...toSummaryJson(note), tagIds: note.tag_ids };
}
