import type { NextFunction, Request, Response } from "express";
import { NoteIdTakenError } from "../errors.js";
import * as notesService from "../services/notes.service.js";
import type { NoteWithBody } from "../services/notes.service.js";

// Lowercase only, so the id we send back always equals the one the client sent.
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// GET /api/notes: this user's notes, most recently edited first.
export function list(_req: Request, _res: Response, _next: NextFunction): void {
  throw new Error("Not implemented");
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

// DB row → API shape: camelCase, and updatedAt as an ISO string.
function toJson(note: NoteWithBody) {
  return { id: note.id, title: note.title, body: note.body, updatedAt: note.updated_at.toISOString() };
}
