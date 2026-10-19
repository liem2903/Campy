import type { NextFunction, Request, Response } from "express";
import { NoteIdTakenError, NoteNotFoundError } from "../errors.js";
import * as notesService from "../services/notes.service.js";
import type { Note, NoteWithBody } from "../services/notes.service.js";

// Lowercase only, so the id we send back always equals the one the client sent.
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const MAX_TITLE_LENGTH = 200;

// GET /api/notes: this user's notes, most recently edited first.
export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const notes = await notesService.listNotes(req.user!.id); // requireSession set it
    res.json(notes.map(toSummaryJson));
  } catch (err) {
    next(err);
  }
}

// GET /api/notes/:id: this user's note with its body. A missing note, another user's note and
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

// PUT /api/notes/:id { title, body }: replaces both and returns the new updatedAt.
// Autosave sends the whole note every time, so both fields are required.
export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  const { title, body } = req.body as { title?: unknown; body?: unknown };
  if (typeof title !== "string" || typeof body !== "string") {
    res.status(400).json({ error: "Title and body must be strings" });
    return;
  }
  if (title.length > MAX_TITLE_LENGTH) {
    res.status(400).json({ error: `Title must be ${MAX_TITLE_LENGTH} characters or fewer` });
    return;
  }

  try {
    // Same 404 as GET for a malformed id: it never reaches the service.
    if (!uuidPattern.test(req.params.id)) throw new NoteNotFoundError();
    const updatedAt = await notesService.updateNote(req.user!.id, req.params.id, { title, body }); // requireSession set it
    res.json({ updatedAt: updatedAt.toISOString() });
  } catch (err) {
    if (err instanceof NoteNotFoundError) {
      res.status(404).json({ error: err.message });
      return;
    }
    next(err); // includes a missing body block → 500 Internal Server Error, never a silent "Saved"
  }
}

// DB row → API shape: camelCase, and updatedAt as an ISO string.
function toJson(note: NoteWithBody) {
  return { ...toSummaryJson(note), body: note.body };
}

// List items leave out body: the sidebar only needs id, title and updatedAt.
function toSummaryJson(note: Note) {
  return { id: note.id, title: note.title, updatedAt: note.updated_at.toISOString() };
}
