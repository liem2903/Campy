import { randomUUID } from "node:crypto";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { makeApp, signedUp } from "./helpers.js";

type App = ReturnType<typeof makeApp>;

const queueQuestion = { question: "What is a queue?", answer: "First in, first out.", tags: [] };
const blockNotInNote = { error: "That paragraph isn't in this note" };
const badBlockId = { error: "blockId must be a block id or null" };

function paragraph(id: string, text: string) {
  return { id, type: "text", properties: { text } };
}
function bulletItem(id: string, text: string, children: unknown[] = []) {
  return { id, type: "list_item", properties: { text, style: "bullet" }, children };
}
// A new note whose body is these blocks.
async function noteWithBlocks(app: App, cookie: string, blocks: unknown[]) {
  const noteId = randomUUID();
  await request(app).post("/api/notes").set("Cookie", cookie).send({ id: noteId }).expect(201);
  await saveBody(app, noteId, blocks, cookie);
  return noteId;
}
async function saveBody(app: App, noteId: string, blocks: unknown[], cookie: string) {
  await request(app).put(`/api/notes/${noteId}`).set("Cookie", cookie).send({ title: "T", blocks }).expect(200);
}
function addQuestion(app: App, noteId: string, fields: object, cookie: string) {
  return request(app).post(`/api/notes/${noteId}/questions`).set("Cookie", cookie).send(fields);
}
function editQuestion(app: App, questionId: string, fields: object, cookie: string) {
  return request(app).put(`/api/questions/${questionId}`).set("Cookie", cookie).send(fields);
}
async function onlyQuestionOnNote(app: App, noteId: string, cookie: string) {
  const res = await request(app).get(`/api/notes/${noteId}/questions`).set("Cookie", cookie).expect(200);
  expect(res.body).toHaveLength(1);
  return res.body[0];
}

describe("the T2b slice", () => {
  it("a question saved about a paragraph comes back linked to it", async () => {
    const app = makeApp();
    const user = await signedUp(app);
    const glycolysisId = randomUUID();
    const noteId = await noteWithBlocks(app, user.cookie, [paragraph(glycolysisId, "Glycolysis runs in the cytoplasm")]);

    const created = await addQuestion(app, noteId, { ...queueQuestion, blockId: glycolysisId }, user.cookie).expect(201);
    expect(created.body).toMatchObject({ blockId: glycolysisId, blockWasDeleted: false });
    expect(await onlyQuestionOnNote(app, noteId, user.cookie)).toEqual(created.body);
  });
});

describe("blockId on save", () => {
  it("left out or null means General", async () => {
    const app = makeApp();
    const user = await signedUp(app);
    const noteId = await noteWithBlocks(app, user.cookie, []);

    const leftOut = await addQuestion(app, noteId, queueQuestion, user.cookie).expect(201);
    const sentNull = await addQuestion(app, noteId, { ...queueQuestion, blockId: null }, user.cookie).expect(201);
    expect([leftOut.body.blockId, sentNull.body.blockId]).toEqual([null, null]);
  });

  it("a list item can be the block, nested or not", async () => {
    const app = makeApp();
    const user = await signedUp(app);
    const nestedItemId = randomUUID();
    const noteId = await noteWithBlocks(app, user.cookie, [bulletItem(randomUUID(), "outer", [bulletItem(nestedItemId, "inner")])]);

    const created = await addQuestion(app, noteId, { ...queueQuestion, blockId: nestedItemId }, user.cookie).expect(201);
    expect(created.body.blockId).toBe(nestedItemId);
  });

  it("a block id that isn't a UUID → 400 Bad Request", async () => {
    const app = makeApp();
    const user = await signedUp(app);
    const noteId = await noteWithBlocks(app, user.cookie, []);

    for (const blockId of ["nope", 7, {}]) {
      const res = await addQuestion(app, noteId, { ...queueQuestion, blockId }, user.cookie).expect(400);
      expect(res.body).toEqual(badBlockId);
    }
  });

  it("a block that isn't in the note → 400 Bad Request, on create and edit", async () => {
    const app = makeApp();
    const user = await signedUp(app);
    const otherNoteBlockId = randomUUID();
    await noteWithBlocks(app, user.cookie, [paragraph(otherNoteBlockId, "elsewhere")]);
    const noteId = await noteWithBlocks(app, user.cookie, []);
    const created = await addQuestion(app, noteId, queueQuestion, user.cookie).expect(201);

    for (const blockId of [otherNoteBlockId, randomUUID()]) {
      expect((await addQuestion(app, noteId, { ...queueQuestion, blockId }, user.cookie).expect(400)).body).toEqual(blockNotInNote);
      expect((await editQuestion(app, created.body.id, { ...queueQuestion, blockId }, user.cookie).expect(400)).body).toEqual(blockNotInNote);
    }
  });

  it("another user's block → 400 Bad Request, same as a missing one", async () => {
    const app = makeApp();
    const owner = await signedUp(app);
    const stranger = await signedUp(app);
    const ownersBlockId = randomUUID();
    await noteWithBlocks(app, owner.cookie, [paragraph(ownersBlockId, "private")]);
    const strangersNoteId = await noteWithBlocks(app, stranger.cookie, []);

    const res = await addQuestion(app, strangersNoteId, { ...queueQuestion, blockId: ownersBlockId }, stranger.cookie).expect(400);
    expect(res.body).toEqual(blockNotInNote);
  });

  it("editing can move a question to another block, or unlink it", async () => {
    const app = makeApp();
    const user = await signedUp(app);
    const [firstId, secondId] = [randomUUID(), randomUUID()];
    const noteId = await noteWithBlocks(app, user.cookie, [paragraph(firstId, "one"), paragraph(secondId, "two")]);
    const created = await addQuestion(app, noteId, { ...queueQuestion, blockId: firstId }, user.cookie).expect(201);

    const moved = await editQuestion(app, created.body.id, { ...queueQuestion, blockId: secondId }, user.cookie).expect(200);
    expect(moved.body.blockId).toBe(secondId);
    const unlinked = await editQuestion(app, created.body.id, { ...queueQuestion, blockId: null }, user.cookie).expect(200);
    expect(unlinked.body).toMatchObject({ blockId: null, blockWasDeleted: false });
  });
});

describe("deleting a question's block", () => {
  it("autosave without the paragraph unlinks its question and marks it", async () => {
    const app = makeApp();
    const user = await signedUp(app);
    const [keptId, deletedId] = [randomUUID(), randomUUID()];
    const noteId = await noteWithBlocks(app, user.cookie, [paragraph(keptId, "kept"), paragraph(deletedId, "gone")]);
    await addQuestion(app, noteId, { ...queueQuestion, blockId: deletedId }, user.cookie).expect(201);

    await saveBody(app, noteId, [paragraph(keptId, "kept")], user.cookie);
    expect(await onlyQuestionOnNote(app, noteId, user.cookie)).toMatchObject({ blockId: null, blockWasDeleted: true });
  });

  it("deleting a list item also marks questions on the items nested in it", async () => {
    const app = makeApp();
    const user = await signedUp(app);
    const nestedItemId = randomUUID();
    const noteId = await noteWithBlocks(app, user.cookie, [bulletItem(randomUUID(), "outer", [bulletItem(nestedItemId, "inner")])]);
    await addQuestion(app, noteId, { ...queueQuestion, blockId: nestedItemId }, user.cookie).expect(201);

    await saveBody(app, noteId, [], user.cookie);
    expect(await onlyQuestionOnNote(app, noteId, user.cookie)).toMatchObject({ blockId: null, blockWasDeleted: true });
  });

  it("General questions are left alone", async () => {
    const app = makeApp();
    const user = await signedUp(app);
    const noteId = await noteWithBlocks(app, user.cookie, [paragraph(randomUUID(), "gone")]);
    await addQuestion(app, noteId, queueQuestion, user.cookie).expect(201);

    await saveBody(app, noteId, [], user.cookie);
    expect(await onlyQuestionOnNote(app, noteId, user.cookie)).toMatchObject({ blockId: null, blockWasDeleted: false });
  });

  it("the mark survives a text-only edit and clears when the question is linked again", async () => {
    const app = makeApp();
    const user = await signedUp(app);
    const [keptId, deletedId] = [randomUUID(), randomUUID()];
    const noteId = await noteWithBlocks(app, user.cookie, [paragraph(keptId, "kept"), paragraph(deletedId, "gone")]);
    const created = await addQuestion(app, noteId, { ...queueQuestion, blockId: deletedId }, user.cookie).expect(201);
    await saveBody(app, noteId, [paragraph(keptId, "kept")], user.cookie);

    const textEdit = await editQuestion(app, created.body.id, { ...queueQuestion, answer: "FIFO", blockId: null }, user.cookie).expect(200);
    expect(textEdit.body).toMatchObject({ blockId: null, blockWasDeleted: true });
    const relinked = await editQuestion(app, created.body.id, { ...queueQuestion, blockId: keptId }, user.cookie).expect(200);
    expect(relinked.body).toMatchObject({ blockId: keptId, blockWasDeleted: false });
  });

  it("deleting the note still deletes its linked questions", async () => {
    const app = makeApp();
    const user = await signedUp(app);
    const blockId = randomUUID();
    const noteId = await noteWithBlocks(app, user.cookie, [paragraph(blockId, "linked")]);
    await addQuestion(app, noteId, { ...queueQuestion, blockId }, user.cookie).expect(201);

    await request(app).delete(`/api/notes/${noteId}`).set("Cookie", user.cookie).send({}).expect(204);
    await request(app).get(`/api/notes/${noteId}/questions`).set("Cookie", user.cookie).expect(404);
  });
});

describe("races", () => {
  // Autosave locks blocks then questions; a question save must take them in the same order, or
  // the two deadlock (a 500).
  it("saving a question on a paragraph while autosave deletes it never fails with a 500", async () => {
    const app = makeApp();
    const user = await signedUp(app);
    for (let round = 0; round < 5; round++) {
      const [keptId, deletedId] = [randomUUID(), randomUUID()];
      const noteId = await noteWithBlocks(app, user.cookie, [paragraph(keptId, "kept"), paragraph(deletedId, "gone")]);
      const created = await addQuestion(app, noteId, { ...queueQuestion, blockId: deletedId }, user.cookie).expect(201);

      const [edit, autosave] = await Promise.all([
        editQuestion(app, created.body.id, { ...queueQuestion, blockId: deletedId }, user.cookie),
        request(app).put(`/api/notes/${noteId}`).set("Cookie", user.cookie).send({ title: "T", blocks: [paragraph(keptId, "kept")] }),
      ]);
      expect([200, 400]).toContain(edit.status);
      expect(autosave.status).toBe(200);
      expect(await onlyQuestionOnNote(app, noteId, user.cookie)).toMatchObject({ blockId: null, blockWasDeleted: true });
    }
  });
});
