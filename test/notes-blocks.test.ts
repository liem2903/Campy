import { randomUUID } from "node:crypto";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { sql } from "../src/db/client.js";
import { makeApp, signedUp } from "./helpers.js";

type App = ReturnType<typeof makeApp>;
// The tree PUT takes and GET returns. Ticket 1 has paragraphs only, so no children yet.
type BlockInTree = { id: string; type: string; properties: Record<string, unknown>; children?: BlockInTree[] };

function paragraphBlock(text: string, id: string = randomUUID()): BlockInTree {
  return { id, type: "text", properties: { text } };
}

async function createdNote(app: App, cookie: string) {
  const id = randomUUID();
  await request(app).post("/api/notes").set("Cookie", cookie).send({ id }).expect(201);
  return id;
}

// blocks is unknown so the 400 cases can send any shape.
function saveNoteBlocks(app: App, noteId: string, blocks: unknown, cookie: string) {
  return request(app).put(`/api/notes/${noteId}`).set("Cookie", cookie).send({ title: "T", blocks });
}

async function blocksFromGet(app: App, noteId: string, cookie: string): Promise<BlockInTree[]> {
  const res = await request(app).get(`/api/notes/${noteId}`).set("Cookie", cookie).expect(200);
  return res.body.blocks;
}

// Every column a save could touch, so "nothing written" also catches moved positions and a
// bumped updated_at, which GET doesn't show.
async function storedNoteRows(noteId: string) {
  const notes = await sql`select title, updated_at from notes where id = ${noteId}`;
  const blocks = await sql`
    select id, parent_id, position, type, properties, updated_at from blocks
    where note_id = ${noteId} order by id
  `;
  return { notes, blocks };
}

async function storedBlockIdsSorted(noteId: string): Promise<string[]> {
  const rows = await sql<{ id: string }[]>`select id from blocks where note_id = ${noteId}`;
  return rows.map((row) => row.id).sort();
}

const notFound = { error: "Note not found" };
const invalidBlocks = { error: "Invalid blocks" };

describe("PUT /api/notes/:id with blocks", () => {
  it("saves paragraphs, and GET returns them in order with the same ids", async () => {
    const app = makeApp();
    const user = await signedUp(app);
    const noteId = await createdNote(app, user.cookie);
    // The empty one is what TipTap sends for a blank line.
    const savedTree = [paragraphBlock("one"), paragraphBlock(""), paragraphBlock("three")];

    await saveNoteBlocks(app, noteId, savedTree, user.cookie).expect(200);
    expect(await blocksFromGet(app, noteId, user.cookie)).toEqual(savedTree);
  });

  it("stores each paragraph as its own top-level text block", async () => {
    const app = makeApp();
    const user = await signedUp(app);
    const noteId = await createdNote(app, user.cookie);
    const savedTree = [paragraphBlock("one"), paragraphBlock("two")];

    await saveNoteBlocks(app, noteId, savedTree, user.cookie).expect(200);
    const rowsInPositionOrder = await sql`
      select id, parent_id, type, properties from blocks where note_id = ${noteId} order by position
    `;
    expect(rowsInPositionOrder).toEqual(
      savedTree.map((block) => ({ id: block.id, parent_id: null, type: "text", properties: block.properties })),
    );
  });

  // Each row turns the first tree [a, b, c] into the next one the client sends.
  const treeEdits: [string, (firstTree: BlockInTree[]) => BlockInTree[]][] = [
    ["swaps two", ([a, b, c]) => [b, a, c]],
    ["reverses three", ([a, b, c]) => [c, b, a]],
    ["deletes the middle one", ([a, , c]) => [a, c]],
    ["inserts one in the middle", ([a, b, c]) => [a, paragraphBlock("new"), b, c]],
    ["replaces the middle one with a new one", ([a, , c]) => [a, paragraphBlock("new"), c]],
    ["edits one's text", ([a, b, c]) => [a, { ...b, properties: { text: "edited" } }, c]],
    ["saves the same tree again", (firstTree) => firstTree],
    ["deletes them all", () => []],
  ];

  it.each(treeEdits)("%s, keeping the ids of the blocks left", async (_, editTree) => {
    const app = makeApp();
    const user = await signedUp(app);
    const noteId = await createdNote(app, user.cookie);
    const firstTree = [paragraphBlock("a"), paragraphBlock("b"), paragraphBlock("c")];
    await saveNoteBlocks(app, noteId, firstTree, user.cookie).expect(200);

    const editedTree = editTree(firstTree);
    await saveNoteBlocks(app, noteId, editedTree, user.cookie).expect(200);
    expect(await blocksFromGet(app, noteId, user.cookie)).toEqual(editedTree);
    // Removed blocks are gone from the DB, not just hidden from GET.
    expect(await storedBlockIdsSorted(noteId)).toEqual(editedTree.map((block) => block.id).sort());
  });

  it("drops properties it doesn't know", async () => {
    const app = makeApp();
    const user = await signedUp(app);
    const noteId = await createdNote(app, user.cookie);
    const blockWithExtra = { ...paragraphBlock("milk"), properties: { text: "milk", color: "red" } };

    await saveNoteBlocks(app, noteId, [blockWithExtra], user.cookie).expect(200);
    expect(await blocksFromGet(app, noteId, user.cookie)).toEqual([paragraphBlock("milk", blockWithExtra.id)]);
  });

  const sharedId = randomUUID();
  it.each<[string, unknown]>([
    ["blocks is missing", undefined],
    ["blocks is not an array", { text: "milk" }],
    ["a block is null", [null]],
    ["a block is not an object", ["milk"]],
    ["an id is missing", [{ type: "text", properties: { text: "" } }]],
    ["an id is not a UUID", [{ ...paragraphBlock(""), id: "not-a-uuid" }]],
    ["an id is uppercase", [{ ...paragraphBlock(""), id: randomUUID().toUpperCase() }]],
    ["a type is unknown", [{ ...paragraphBlock(""), type: "heading" }]],
    ["properties is missing", [{ id: randomUUID(), type: "text" }]],
    ["properties is an array", [{ ...paragraphBlock(""), properties: ["milk"] }]],
    ["text is missing", [{ ...paragraphBlock(""), properties: {} }]],
    ["text is not a string", [{ ...paragraphBlock(""), properties: { text: 5 } }]],
    ["children is not an array", [{ ...paragraphBlock(""), children: "milk" }]],
    ["a text block has children", [{ ...paragraphBlock(""), children: [paragraphBlock("")] }]],
    ["two blocks share an id", [paragraphBlock("a", sharedId), paragraphBlock("b", sharedId)]],
  ])("returns 400 when %s, and writes nothing", async (_, badBlocks) => {
    const app = makeApp();
    const user = await signedUp(app);
    const noteId = await createdNote(app, user.cookie);
    await saveNoteBlocks(app, noteId, [paragraphBlock("kept")], user.cookie).expect(200);
    const rowsBefore = await storedNoteRows(noteId);

    const res = await saveNoteBlocks(app, noteId, badBlocks, user.cookie);
    expect(res.status).toBe(400);
    expect(res.body).toEqual(invalidBlocks);
    expect(await storedNoteRows(noteId)).toEqual(rowsBefore);
  });

  it.each(["the same user", "another user"])(
    "returns 400 for a block id from a note of %s, and leaves both notes alone",
    async (otherNoteOwner) => {
      const app = makeApp();
      const user = await signedUp(app);
      const otherOwner = otherNoteOwner === "the same user" ? user : await signedUp(app);
      const otherNoteId = await createdNote(app, otherOwner.cookie);
      const otherNotesBlock = paragraphBlock("theirs");
      await saveNoteBlocks(app, otherNoteId, [otherNotesBlock], otherOwner.cookie).expect(200);
      const noteId = await createdNote(app, user.cookie);
      await saveNoteBlocks(app, noteId, [paragraphBlock("mine")], user.cookie).expect(200);
      const otherRowsBefore = await storedNoteRows(otherNoteId);
      const ownRowsBefore = await storedNoteRows(noteId);

      // A valid new block goes first, so a missing rollback would leave it written.
      const stealingTree = [paragraphBlock("new"), { ...otherNotesBlock, properties: { text: "stolen" } }];
      const res = await saveNoteBlocks(app, noteId, stealingTree, user.cookie);
      expect(res.status).toBe(400);
      expect(res.body).toEqual(invalidBlocks);
      expect(await storedNoteRows(otherNoteId)).toEqual(otherRowsBefore);
      expect(await storedNoteRows(noteId)).toEqual(ownRowsBefore);
    },
  );

  it("returns 404 for another user's note, and leaves its blocks alone", async () => {
    const app = makeApp();
    const alice = await signedUp(app);
    const bob = await signedUp(app);
    const aliceNoteId = await createdNote(app, alice.cookie);
    const aliceBlock = paragraphBlock("secret");
    await saveNoteBlocks(app, aliceNoteId, [aliceBlock], alice.cookie).expect(200);
    const rowsBefore = await storedNoteRows(aliceNoteId);

    const hackedTree = [{ ...aliceBlock, properties: { text: "hacked" } }];
    const res = await saveNoteBlocks(app, aliceNoteId, hackedTree, bob.cookie);
    expect(res.status).toBe(404);
    expect(res.body).toEqual(notFound);
    expect(await storedNoteRows(aliceNoteId)).toEqual(rowsBefore);
  });
});

function listItemBlock(
  text: string, style: "bullet" | "numbered", children: BlockInTree[] = [], id: string = randomUUID(),
): BlockInTree {
  return { id, type: "list_item", properties: { text, style }, children };
}

// One chain of list items, each the only child of the one above, `depth` levels deep.
function listNestedToDepth(depth: number): BlockInTree[] {
  let tree: BlockInTree[] = [];
  for (let level = depth; level >= 1; level--) tree = [listItemBlock(`level ${level}`, "bullet", tree)];
  return tree;
}

function idsInTreeSorted(tree: BlockInTree[]): string[] {
  const idsInTree = (blocks: BlockInTree[]): string[] =>
    blocks.flatMap((block) => [block.id, ...idsInTree(block.children ?? [])]);
  return idsInTree(tree).sort();
}

describe("PUT /api/notes/:id with lists", () => {
  it("saves nested bullet and numbered items, and GET returns the same tree", async () => {
    const app = makeApp();
    const user = await signedUp(app);
    const noteId = await createdNote(app, user.cookie);
    const savedTree = [
      listItemBlock("milk", "bullet"),
      listItemBlock("bread", "bullet", [
        listItemBlock("wholemeal", "bullet", [listItemBlock("seeded", "bullet")]),
      ]),
      paragraphBlock("then"),
      listItemBlock("eggs", "numbered", [listItemBlock("free range", "numbered")]),
    ];

    await saveNoteBlocks(app, noteId, savedTree, user.cookie).expect(200);
    expect(await blocksFromGet(app, noteId, user.cookie)).toEqual(savedTree);
  });

  it("stores each nested item with its parent's id", async () => {
    const app = makeApp();
    const user = await signedUp(app);
    const noteId = await createdNote(app, user.cookie);
    const wholemeal = listItemBlock("wholemeal", "bullet");
    const bread = listItemBlock("bread", "bullet", [wholemeal]);

    await saveNoteBlocks(app, noteId, [bread], user.cookie).expect(200);
    const rows = await sql<{ id: string; parent_id: string | null }[]>`
      select id, parent_id from blocks where note_id = ${noteId}
    `;
    const parentIdByBlockId = Object.fromEntries(rows.map((row) => [row.id, row.parent_id]));
    expect(parentIdByBlockId).toEqual({ [bread.id]: null, [wholemeal.id]: bread.id });
  });

  // Each row turns [milk, bread > wholemeal] into the next tree the client sends.
  type ListEdit = (milk: BlockInTree, bread: BlockInTree, wholemeal: BlockInTree) => BlockInTree[];
  const listEdits: [string, ListEdit][] = [
    ["indents an item under a new parent", (milk, bread, wholemeal) =>
      [{ ...milk, children: [wholemeal] }, { ...bread, children: [] }]],
    ["outdents an item to the top level", (milk, bread, wholemeal) =>
      [milk, { ...bread, children: [] }, wholemeal]],
    // The cascade trap from decision 7: deleting bread must not take wholemeal with it.
    ["moves an item while deleting its old parent", (milk, _bread, wholemeal) =>
      [{ ...milk, children: [wholemeal] }]],
    ["deletes a parent along with its children", (milk) => [milk]],
    ["switches an item from bullet to numbered", (milk, bread) =>
      [{ ...milk, properties: { text: "milk", style: "numbered" } }, bread]],
  ];

  it.each(listEdits)("%s, keeping the ids of the items left", async (_, editList) => {
    const app = makeApp();
    const user = await signedUp(app);
    const noteId = await createdNote(app, user.cookie);
    const wholemeal = listItemBlock("wholemeal", "bullet");
    const milk = listItemBlock("milk", "bullet");
    const bread = listItemBlock("bread", "bullet", [wholemeal]);
    await saveNoteBlocks(app, noteId, [milk, bread], user.cookie).expect(200);

    const editedTree = editList(milk, bread, wholemeal);
    await saveNoteBlocks(app, noteId, editedTree, user.cookie).expect(200);
    expect(await blocksFromGet(app, noteId, user.cookie)).toEqual(editedTree);
    expect(await storedBlockIdsSorted(noteId)).toEqual(idsInTreeSorted(editedTree));
  });

  it("accepts a list nested 9 deep", async () => {
    const app = makeApp();
    const user = await signedUp(app);
    const noteId = await createdNote(app, user.cookie);
    const deepestAllowedTree = listNestedToDepth(9);

    await saveNoteBlocks(app, noteId, deepestAllowedTree, user.cookie).expect(200);
    expect(await blocksFromGet(app, noteId, user.cookie)).toEqual(deepestAllowedTree);
  });

  const sharedNestedId = randomUUID();
  it.each<[string, unknown]>([
    ["a list item has no style", [{ ...listItemBlock("", "bullet"), properties: { text: "" } }]],
    ["a list item's style is unknown",
      [{ ...listItemBlock("", "bullet"), properties: { text: "", style: "dash" } }]],
    ["a list item's children is not an array", [{ ...listItemBlock("", "bullet"), children: "milk" }]],
    ["a list item has a text child", [listItemBlock("", "bullet", [paragraphBlock("")])]],
    ["a nested item shares its parent's id",
      [listItemBlock("a", "bullet", [listItemBlock("b", "bullet", [], sharedNestedId)], sharedNestedId)]],
    ["a list nests 10 deep", listNestedToDepth(10)],
  ])("returns 400 when %s, and writes nothing", async (_, badBlocks) => {
    const app = makeApp();
    const user = await signedUp(app);
    const noteId = await createdNote(app, user.cookie);
    await saveNoteBlocks(app, noteId, [listItemBlock("kept", "bullet")], user.cookie).expect(200);
    const rowsBefore = await storedNoteRows(noteId);

    const res = await saveNoteBlocks(app, noteId, badBlocks, user.cookie);
    expect(res.status).toBe(400);
    expect(res.body).toEqual(invalidBlocks);
    expect(await storedNoteRows(noteId)).toEqual(rowsBefore);
  });

  // Without the pre-check, the skipped parent would make the child's foreign key fail mid-upsert (a 500).
  it("returns 400 when another note's block is used as a parent, and leaves both notes alone", async () => {
    const app = makeApp();
    const user = await signedUp(app);
    const otherNoteId = await createdNote(app, user.cookie);
    const otherNotesItem = listItemBlock("theirs", "bullet");
    await saveNoteBlocks(app, otherNoteId, [otherNotesItem], user.cookie).expect(200);
    const noteId = await createdNote(app, user.cookie);
    const otherRowsBefore = await storedNoteRows(otherNoteId);
    const ownRowsBefore = await storedNoteRows(noteId);

    const stealingTree = [{ ...otherNotesItem, children: [listItemBlock("mine", "bullet")] }];
    const res = await saveNoteBlocks(app, noteId, stealingTree, user.cookie);
    expect(res.status).toBe(400);
    expect(res.body).toEqual(invalidBlocks);
    expect(await storedNoteRows(otherNoteId)).toEqual(otherRowsBefore);
    expect(await storedNoteRows(noteId)).toEqual(ownRowsBefore);
  });
});

describe("PUT /api/notes/:id with bold and italic", () => {
  it("saves marks on a paragraph and a list item, and GET returns them", async () => {
    const app = makeApp();
    const user = await signedUp(app);
    const noteId = await createdNote(app, user.cookie);
    const formattedParagraph = paragraphBlock("milk and eggs");
    formattedParagraph.properties.marks = [
      // Overlapping marks are allowed: "milk and" is bold, "and eggs" italic, so "and" is both.
      { type: "bold", from: 0, to: 8 },
      { type: "italic", from: 5, to: 13 },
    ];
    const formattedItem = listItemBlock("bread", "bullet");
    formattedItem.properties.marks = [{ type: "bold", from: 0, to: 5 }];

    await saveNoteBlocks(app, noteId, [formattedParagraph, formattedItem], user.cookie).expect(200);
    expect(await blocksFromGet(app, noteId, user.cookie)).toEqual([formattedParagraph, formattedItem]);
  });

  // toEqual treats a key set to undefined as missing, so check the key itself.
  it("returns a block saved without marks with no marks key", async () => {
    const app = makeApp();
    const user = await signedUp(app);
    const noteId = await createdNote(app, user.cookie);

    await saveNoteBlocks(app, noteId, [paragraphBlock("milk")], user.cookie).expect(200);
    const [returnedParagraph] = await blocksFromGet(app, noteId, user.cookie);
    expect(returnedParagraph.properties).not.toHaveProperty("marks");
  });

  it("drops keys it doesn't know inside a mark", async () => {
    const app = makeApp();
    const user = await signedUp(app);
    const noteId = await createdNote(app, user.cookie);
    const sentParagraph = paragraphBlock("milk");
    sentParagraph.properties.marks = [{ type: "bold", from: 0, to: 4, color: "red" }];

    await saveNoteBlocks(app, noteId, [sentParagraph], user.cookie).expect(200);
    const [returnedParagraph] = await blocksFromGet(app, noteId, user.cookie);
    expect(returnedParagraph.properties.marks).toEqual([{ type: "bold", from: 0, to: 4 }]);
  });

  // Each row is the marks sent on a paragraph whose text is "milk" (length 4).
  it.each<[string, unknown]>([
    ["marks is not an array", { type: "bold", from: 0, to: 4 }],
    ["a mark is not an object", ["bold"]],
    ["a mark type is unknown", [{ type: "highlight", from: 0, to: 4 }]],
    ["from is missing", [{ type: "bold", to: 4 }]],
    ["from is not an integer", [{ type: "bold", from: 0.5, to: 4 }]],
    ["from is negative", [{ type: "bold", from: -1, to: 4 }]],
    ["to is past the end of the text", [{ type: "bold", from: 0, to: 5 }]],
    ["from equals to (an empty range)", [{ type: "bold", from: 2, to: 2 }]],
    ["from is after to", [{ type: "bold", from: 3, to: 1 }]],
  ])("returns 400 when %s, and writes nothing", async (_, badMarks) => {
    const app = makeApp();
    const user = await signedUp(app);
    const noteId = await createdNote(app, user.cookie);
    await saveNoteBlocks(app, noteId, [paragraphBlock("kept")], user.cookie).expect(200);
    const rowsBefore = await storedNoteRows(noteId);

    const badParagraph = { ...paragraphBlock(""), properties: { text: "milk", marks: badMarks } };
    const res = await saveNoteBlocks(app, noteId, [badParagraph], user.cookie);
    expect(res.status).toBe(400);
    expect(res.body).toEqual(invalidBlocks);
    expect(await storedNoteRows(noteId)).toEqual(rowsBefore);
  });

  it("returns 400 when a list item's mark runs past its text", async () => {
    const app = makeApp();
    const user = await signedUp(app);
    const noteId = await createdNote(app, user.cookie);
    const badItem = listItemBlock("milk", "bullet");
    badItem.properties.marks = [{ type: "bold", from: 0, to: 9 }];

    const res = await saveNoteBlocks(app, noteId, [badItem], user.cookie);
    expect(res.status).toBe(400);
    expect(res.body).toEqual(invalidBlocks);
  });
});

describe("PUT /api/notes/:id with underline and strikethrough", () => {
  it("saves underline and strike marks on a paragraph and a list item, and GET returns them", async () => {
    const app = makeApp();
    const user = await signedUp(app);
    const noteId = await createdNote(app, user.cookie);
    const formattedParagraph = paragraphBlock("milk and eggs");
    formattedParagraph.properties.marks = [
      { type: "underline", from: 0, to: 4 },
      { type: "strike", from: 9, to: 13 },
    ];
    const formattedItem = listItemBlock("bread", "bullet");
    // All four marks on one run: they can be combined.
    formattedItem.properties.marks = [
      { type: "bold", from: 0, to: 5 },
      { type: "italic", from: 0, to: 5 },
      { type: "underline", from: 0, to: 5 },
      { type: "strike", from: 0, to: 5 },
    ];

    await saveNoteBlocks(app, noteId, [formattedParagraph, formattedItem], user.cookie).expect(200);
    expect(await blocksFromGet(app, noteId, user.cookie)).toEqual([formattedParagraph, formattedItem]);
  });
});

function headingBlock(text: string, level: unknown): BlockInTree {
  return { id: randomUUID(), type: "heading", properties: { text, level } };
}

describe("PUT /api/notes/:id with headings", () => {
  it("saves headings at each level between paragraphs, and GET returns them in order with the same ids", async () => {
    const app = makeApp();
    const user = await signedUp(app);
    const noteId = await createdNote(app, user.cookie);
    const formattedHeading = headingBlock("Cells", 1);
    formattedHeading.properties.marks = [{ type: "italic", from: 0, to: 5 }];
    const sentBlocks = [
      formattedHeading,
      paragraphBlock("the basic unit of life"),
      headingBlock("Mitochondria", 2),
      headingBlock("ATP", 3),
    ];

    await saveNoteBlocks(app, noteId, sentBlocks, user.cookie).expect(200);
    expect(await blocksFromGet(app, noteId, user.cookie)).toEqual(sentBlocks);
  });

  // Typing "# " in the editor keeps the paragraph's id, so a question pointing at it stays linked.
  it("turns a paragraph into a heading in place, keeping its id", async () => {
    const app = makeApp();
    const user = await signedUp(app);
    const noteId = await createdNote(app, user.cookie);
    const paragraphThenHeadingId = randomUUID();
    await saveNoteBlocks(app, noteId, [paragraphBlock("Cells", paragraphThenHeadingId)], user.cookie).expect(200);

    const sameBlockAsHeading = { ...headingBlock("Cells", 1), id: paragraphThenHeadingId };
    await saveNoteBlocks(app, noteId, [sameBlockAsHeading], user.cookie).expect(200);
    expect(await blocksFromGet(app, noteId, user.cookie)).toEqual([sameBlockAsHeading]);
    expect(await storedBlockIdsSorted(noteId)).toEqual([paragraphThenHeadingId]);
  });

  it.each<[string, unknown]>([
    ["level is 0", headingBlock("Cells", 0)],
    ["level is 4", headingBlock("Cells", 4)],
    ["level is missing", { id: randomUUID(), type: "heading", properties: { text: "Cells" } }],
    ["level is a string", headingBlock("Cells", "1")],
    ["a heading has children", { ...headingBlock("Cells", 1), children: [listItemBlock("milk", "bullet")] }],
    ["a heading is a list item's child", { ...listItemBlock("milk", "bullet"), children: [headingBlock("Cells", 1)] }],
    // "ATP" has length 3, so to: 9 runs past the end.
    ["a heading's mark runs past its text", { ...headingBlock("", 3), properties: { text: "ATP", level: 3, marks: [{ type: "bold", from: 0, to: 9 }] } }],
    ["a heading's mark type is unknown", { ...headingBlock("", 3), properties: { text: "ATP", level: 3, marks: [{ type: "highlight", from: 0, to: 3 }] } }],
  ])("returns 400 when %s, and writes nothing", async (_, badBlock) => {
    const app = makeApp();
    const user = await signedUp(app);
    const noteId = await createdNote(app, user.cookie);
    await saveNoteBlocks(app, noteId, [paragraphBlock("kept")], user.cookie).expect(200);
    const rowsBefore = await storedNoteRows(noteId);

    const res = await saveNoteBlocks(app, noteId, [badBlock], user.cookie);
    expect(res.status).toBe(400);
    expect(res.body).toEqual(invalidBlocks);
    expect(await storedNoteRows(noteId)).toEqual(rowsBefore);
  });
});
