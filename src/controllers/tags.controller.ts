import type { NextFunction, Request, Response } from "express";
import { NoteNotFoundError, TagNameTakenError, TagNotFoundError } from "../errors.js";
import * as tagsService from "../services/tags.service.js";
import type { TagWithNoteCount } from "../services/tags.service.js";
import { INVALID_TAG_NAME, tagNameSchema, uuidPattern } from "./validation.js";

// GET /api/tags: this user's tags in name order, each with its note count.
export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tags = await tagsService.listTags(req.user!.id); // requireSession set it
    res.json(tags.map(toJsonWithNoteCount));
  } catch (err) {
    next(err);
  }
}

// POST /api/tags { name }: 201 Created with the new tag; 409 Conflict when the name is taken.
export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  const tagName = tagNameFromBody(req);
  if (tagName === null) {
    res.status(400).json({ error: INVALID_TAG_NAME });
    return;
  }
  try {
    const tag = await tagsService.createTag(req.user!.id, tagName); // requireSession set it
    res.status(201).json(tag);
  } catch (err) {
    sendDomainError(err, res, next);
  }
}

// PATCH /api/tags/:tagId { name }: 200 OK with the renamed tag; 409 Conflict when another of the
// user's tags has the name.
export async function rename(req: Request, res: Response, next: NextFunction): Promise<void> {
  const tagName = tagNameFromBody(req);
  if (tagName === null) {
    res.status(400).json({ error: INVALID_TAG_NAME });
    return;
  }
  try {
    // A non-UUID would make Postgres throw (a 500), so it never reaches the service.
    if (!uuidPattern.test(req.params.tagId)) throw new TagNotFoundError();
    const tag = await tagsService.renameTag(req.user!.id, req.params.tagId, tagName); // requireSession set it
    res.json(tag);
  } catch (err) {
    sendDomainError(err, res, next);
  }
}

// DELETE /api/tags/:tagId: deletes the tag and takes it off every note.
export async function remove(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!uuidPattern.test(req.params.tagId)) throw new TagNotFoundError();
    await tagsService.deleteTag(req.user!.id, req.params.tagId); // requireSession set it
    res.status(204).end();
  } catch (err) {
    sendDomainError(err, res, next);
  }
}

// POST /api/notes/:id/tags { name }: puts the tag on the note, creating it on first use.
// 200 OK, not 201 Created: the tag may already have existed.
export async function addToNote(req: Request, res: Response, next: NextFunction): Promise<void> {
  const tagName = tagNameFromBody(req);
  if (tagName === null) {
    res.status(400).json({ error: INVALID_TAG_NAME });
    return;
  }
  try {
    if (!uuidPattern.test(req.params.id)) throw new NoteNotFoundError();
    const tag = await tagsService.addTagToNote(req.user!.id, req.params.id, tagName); // requireSession set it
    res.json(tag);
  } catch (err) {
    sendDomainError(err, res, next);
  }
}

// DELETE /api/notes/:id/tags/:tagId: takes the tag off this note only. 204 No Content even when
// the note didn't have it, since the result is the same.
export async function removeFromNote(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!uuidPattern.test(req.params.id)) throw new NoteNotFoundError();
    if (!uuidPattern.test(req.params.tagId)) throw new TagNotFoundError();
    await tagsService.removeTagFromNote(req.user!.id, req.params.id, req.params.tagId); // requireSession set it
    res.status(204).end();
  } catch (err) {
    sendDomainError(err, res, next);
  }
}

// The cleaned-up name, or null when the body has no valid one.
function tagNameFromBody(req: Request): string | null {
  const parsedName = tagNameSchema.safeParse((req.body as { name?: unknown }).name);
  return parsedName.success ? parsedName.data : null;
}

// Domain errors → status codes. Anything else goes to the JSON error handler in app.ts.
function sendDomainError(err: unknown, res: Response, next: NextFunction): void {
  if (err instanceof NoteNotFoundError || err instanceof TagNotFoundError) {
    res.status(404).json({ error: err.message });
  } else if (err instanceof TagNameTakenError) {
    res.status(409).json({ error: err.message });
  } else {
    next(err);
  }
}

// DB row → API shape: camelCase.
function toJsonWithNoteCount(tag: TagWithNoteCount) {
  return { id: tag.id, name: tag.name, noteCount: tag.note_count };
}
