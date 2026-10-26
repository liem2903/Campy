import { sql, type Db } from "../db/client.js";
import type { Note } from "../db/types.js";
import { BlockOfAnotherNoteError, NoteIdTakenError, NoteNotFoundError } from "../errors.js";
import * as blocksRepository from "../repositories/blocks.repository.js";
import * as notesRepository from "../repositories/notes.repository.js";
import * as tagsRepository from "../repositories/tags.repository.js";
import type { NoteBlock, NoteBlockRow } from "../repositories/blocks.repository.js";
import type { TagSummary } from "../repositories/tags.repository.js";

export type { Note, NoteBlock };
// A note with its blocks as a tree, in order, and its tags in name order.
export type NoteDetail = Note & { blocks: NoteBlock[]; tags: TagSummary[] };
export type CreateNoteResult = { note: NoteDetail; created: boolean };
// What the user edits: autosave sends both on every save.
export type NoteContent = { title: string; blocks: NoteBlock[] };

// Creates the note with no blocks. created: false = this user already owns the id.
// Throws NoteIdTakenError when another user owns it.
export async function createNote(userId: string, id: string): Promise<CreateNoteResult> {
  // Relies on READ COMMITTED: after a conflict, the lookup sees the other transaction's commit.
  return sql.begin(async (tx) => {
    const note = await notesRepository.insertNote(userId, id, tx);
    if (note) return { note: { ...note, blocks: [], tags: [] }, created: true };
    // The id exists. findNoteDetail only sees this user's notes, so null = someone else's.
    const existing = await findNoteDetail(userId, id, tx);
    if (!existing) throw new NoteIdTakenError();
    return { note: existing, created: false };
  });
}

// This user's note with its blocks and tags. Throws NoteNotFoundError when it's missing or another user's.
export async function getNote(userId: string, id: string): Promise<NoteDetail> {
  const note = await findNoteDetail(userId, id);
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
    // Checked before the upsert: a skipped parent would make its children's foreign key fail
    // mid-statement (a 500) before the count check below could turn it into a 400.
    if (await blocksRepository.isAnyBlockInAnotherNote(id, blockIds, tx)) {
      throw new BlockOfAnotherNoteError();
    }
    // Decision 7. Deletes come last so a re-parented block isn't caught by its old parent's cascade.
    await blocksRepository.moveBlocksToTemporaryPositions(id, tx);
    const writtenCount = await blocksRepository.upsertBlocks(id, blockRows, tx);
    // Fewer rows written = an id was taken by another note since the check above. Throwing rolls
    // back the title too. If that id has children, their foreign key fails inside the upsert
    // instead (a 500). Accepted: only two saves racing on the same new UUID can cause it, and the
    // rollback still writes nothing.
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
async function findNoteDetail(
  userId: string, id: string, db: Db = sql,
): Promise<NoteDetail | null> {
  const note = await notesRepository.findNoteByIdForUser(userId, id, db);
  if (!note) return null;
  const [blockRows, tags] = await Promise.all([
    blocksRepository.findBlocksOfNote(id, db),
    tagsRepository.findTagsOfNote(id, db),
  ]);
  return { ...note, blocks: blockTreeFromRows(blockRows), tags };
}

// Tree → the rows the DB stores: each block, then its whole subtree, so parents come before
// their children. A row keeps the block's children field; upsertBlocks ignores it.
function blockRowsFromTree(blocks: NoteBlock[], parentId: string | null = null): NoteBlockRow[] {
  return blocks.flatMap((block, index) => {
    const row = { ...block, parent_id: parentId, position: positionAt(index) };
    const subtreeRows = block.type === "list_item" ? blockRowsFromTree(block.children, block.id) : [];
    return [row, ...subtreeRows];
  });
}

// Rows → the API tree. Rows arrive ordered by position, so grouping them by parent keeps each
// sibling group in order without sorting again.
function blockTreeFromRows(rows: NoteBlockRow[]): NoteBlock[] {
  const rowsByParentId = new Map<string | null, NoteBlockRow[]>();
  for (const row of rows) {
    const siblingRows = rowsByParentId.get(row.parent_id) ?? [];
    siblingRows.push(row);
    rowsByParentId.set(row.parent_id, siblingRows);
  }
  // Drops the storage-only fields and attaches each list item's children.
  const toNoteBlock = (row: NoteBlockRow): NoteBlock => {
    if (row.type === "text") return { id: row.id, type: row.type, properties: row.properties };
    const childRows = rowsByParentId.get(row.id) ?? [];
    return { id: row.id, type: row.type, properties: row.properties, children: childRows.map(toNoteBlock) };
  };
  return (rowsByParentId.get(null) ?? []).map(toNoteBlock);
}

// Every save rewrites each sibling group whole, so a position can be the index, zero-padded so it
// sorts as text ("000002" < "000010"). The 100 KB body limit keeps a note far below 10^6 blocks.
function positionAt(index: number): string {
  return String(index).padStart(6, "0");
}
