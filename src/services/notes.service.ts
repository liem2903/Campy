import { sql, type Db } from "../db/client.js";
import type { Note } from "../db/types.js";
import { BlockOfAnotherNoteError, NoteIdTakenError, NoteNotFoundError } from "../errors.js";
import * as blocksRepository from "../repositories/blocks.repository.js";
import * as notesRepository from "../repositories/notes.repository.js";
import type { NoteBlock, NoteBlockRow } from "../repositories/blocks.repository.js";

export type { Note, NoteBlock };
// A note with its blocks as a tree, in order.
export type NoteWithBlocks = Note & { blocks: NoteBlock[] };
export type CreateNoteResult = { note: NoteWithBlocks; created: boolean };
// What the user edits: autosave sends both on every save.
export type NoteContent = { title: string; blocks: NoteBlock[] };

// Creates the note with no blocks. created: false = this user already owns the id.
// Throws NoteIdTakenError when another user owns it.
export async function createNote(userId: string, id: string): Promise<CreateNoteResult> {
  // Relies on READ COMMITTED: after a conflict, the lookup sees the other transaction's commit.
  return sql.begin(async (tx) => {
    const note = await notesRepository.insertNote(userId, id, tx);
    if (note) return { note: { ...note, blocks: [] }, created: true };
    // The id exists. findNoteWithBlocks only sees this user's notes, so null = someone else's.
    const existing = await findNoteWithBlocks(userId, id, tx);
    if (!existing) throw new NoteIdTakenError();
    return { note: existing, created: false };
  });
}

// This user's note with its blocks. Throws NoteNotFoundError when it's missing or another user's.
export async function getNote(userId: string, id: string): Promise<NoteWithBlocks> {
  const note = await findNoteWithBlocks(userId, id);
  if (!note) throw new NoteNotFoundError();
  return note;
}

// Replaces the note's title and blocks together and returns its new updated_at.
// Throws NoteNotFoundError when the note is missing or another user's, and
// BlockOfAnotherNoteError when a block id belongs to a different note.
export async function updateNote(
  userId: string, id: string, { title, blocks }: NoteContent,
): Promise<Date> {
  const blockRows = blockRowsFromTree(blocks);
  const blockIds = blockRows.map((row) => row.id);
  return sql.begin(async (tx) => {
    // The title update is scoped by user_id, so it doubles as the ownership check.
    const updatedAt = await notesRepository.updateTitle(userId, id, title, tx);
    if (!updatedAt) throw new NoteNotFoundError();
    // Decision 7. Deletes come last so a re-parented block isn't caught by its old parent's cascade.
    await blocksRepository.moveBlocksToTemporaryPositions(id, tx);
    const writtenCount = await blocksRepository.upsertBlocks(id, blockRows, tx);
    // Fewer rows written = some id belongs to another note. Throwing rolls back the title too.
    if (writtenCount < blockRows.length) throw new BlockOfAnotherNoteError();
    await blocksRepository.deleteBlocksMissingFrom(id, blockIds, tx);
    return updatedAt;
  });
}

// This user's notes, most recently edited first.
export async function listNotes(userId: string): Promise<Note[]> {
  return notesRepository.listNotes(userId);
}

// Deletes this user's note; its blocks go with it. Throws NoteNotFoundError when the note is
// missing or another user's.
export async function deleteNote(userId: string, id: string): Promise<void> {
  // One statement, and the cascade runs inside it, so no transaction is needed.
  const deletedCount = await notesRepository.deleteNote(userId, id);
  if (deletedCount === 0) throw new NoteNotFoundError();
}

// Used inside createNote's transaction and on its own, so it takes a Db like a repository.
async function findNoteWithBlocks(
  userId: string, id: string, db: Db = sql,
): Promise<NoteWithBlocks | null> {
  const note = await notesRepository.findNoteByIdForUser(userId, id, db);
  if (!note) return null;
  const blockRows = await blocksRepository.findBlocksOfNote(id, db);
  return { ...note, blocks: blockRows.map(noteBlockFromRow) };
}

// Tree → the rows the DB stores. Ticket 1 is top-level paragraphs; Ticket 2 recurses into children.
function blockRowsFromTree(blocks: NoteBlock[]): NoteBlockRow[] {
  return blocks.map((block, index) => ({ ...block, parent_id: null, position: positionAt(index) }));
}

// Row → the API shape, dropping the storage-only fields.
function noteBlockFromRow({ id, type, properties }: NoteBlockRow): NoteBlock {
  return { id, type, properties };
}

// Every save rewrites each sibling group whole, so a position can be the index, zero-padded so it
// sorts as text ("000002" < "000010"). The 100 KB body limit keeps a note far below 10^6 blocks.
function positionAt(index: number): string {
  return String(index).padStart(6, "0");
}
