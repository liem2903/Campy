import { randomUUID } from "node:crypto";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { sql } from "../src/db/client.js";
import { makeApp, signedUp } from "./helpers.js";

type App = ReturnType<typeof makeApp>;
type QuestionFields = { question?: unknown; answer?: unknown; tags?: unknown };

const queueQuestion = { question: "What is a queue?", answer: "First in, first out.", tags: [] };

function listQuestions(app: App, noteId: string, cookie: string) {
  return request(app).get(`/api/notes/${noteId}/questions`).set("Cookie", cookie);
}
function addQuestion(app: App, noteId: string, fields: QuestionFields, cookie: string) {
  return request(app).post(`/api/notes/${noteId}/questions`).set("Cookie", cookie).send(fields);
}
function editQuestion(app: App, questionId: string, fields: QuestionFields, cookie: string) {
  return request(app).put(`/api/questions/${questionId}`).set("Cookie", cookie).send(fields);
}
function deleteQuestion(app: App, questionId: string, cookie: string) {
  return request(app).delete(`/api/questions/${questionId}`).set("Cookie", cookie).send({});
}
async function createdNote(app: App, cookie: string) {
  const noteId = randomUUID();
  await request(app).post("/api/notes").set("Cookie", cookie).send({ id: noteId }).expect(201);
  return noteId;
}
async function addedQuestion(app: App, noteId: string, cookie: string, fields: QuestionFields = queueQuestion) {
  const res = await addQuestion(app, noteId, fields, cookie).expect(201);
  return res.body;
}
async function questionsOnNote(app: App, noteId: string, cookie: string) {
  const res = await listQuestions(app, noteId, cookie).expect(200);
  return res.body;
}
async function allTags(app: App, cookie: string) {
  const res = await request(app).get("/api/tags").set("Cookie", cookie).expect(200);
  return res.body;
}
function tagNames(tags: { name: string }[]) {
  return tags.map((tag) => tag.name);
}

// Read straight from the DB, so a buggy GET can't hide rows left behind.
async function storedRowsForQuestion(questionId: string) {
  const [{ questionRows }] = await sql<{ questionRows: number }[]>`
    select count(*)::int as "questionRows" from questions where id = ${questionId}
  `;
  const [{ tagLinkRows }] = await sql<{ tagLinkRows: number }[]>`
    select count(*)::int as "tagLinkRows" from question_tags where question_id = ${questionId}
  `;
  return { questionRows, tagLinkRows };
}
async function storedQuestionCountForNote(noteId: string) {
  const [{ questionRows }] = await sql<{ questionRows: number }[]>`
    select count(*)::int as "questionRows" from questions where note_id = ${noteId}
  `;
  return questionRows;
}

// Named 404 bodies, so nothing passes on the app's catch-all "Not found".
const noteNotFound = { error: "Note not found" };
const questionNotFound = { error: "Question not found" };
const badQuestionText = { error: "A question must be 1 to 500 characters" };
const badAnswerText = { error: "An answer must be 1 to 5000 characters" };
const badTagList = { error: "Tags must be a list of tag names" };
const badTagName = { error: "A tag name must be 1 to 50 characters" };
const tooManyTags = { error: "A question can have at most 20 tags" };

describe("the T2 slice", () => {
  it("add a question to a note, and it is still there when the note is opened again", async () => {
    const app = makeApp();
    const user = await signedUp(app);
    const noteId = await createdNote(app, user.cookie);

    const created = await addedQuestion(app, noteId, user.cookie);
    expect(await questionsOnNote(app, noteId, user.cookie)).toEqual([created]);
  });
});

describe("requests with no cookie", () => {
  it.each([
    ["GET", "get", `/api/notes/${randomUUID()}/questions`],
    ["POST", "post", `/api/notes/${randomUUID()}/questions`],
    ["PUT", "put", `/api/questions/${randomUUID()}`],
    ["DELETE", "delete", `/api/questions/${randomUUID()}`],
  ] as const)("%s is rejected with 401", async (_, method, path) => {
    const res = await request(makeApp())[method](path).send({});
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "You're not logged in" });
  });
});

describe("POST /api/notes/:id/questions", () => {
  it("creates a question and returns it with 201", async () => {
    const app = makeApp();
    const user = await signedUp(app);
    const noteId = await createdNote(app, user.cookie);

    const res = await addQuestion(app, noteId, queueQuestion, user.cookie);
    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      id: expect.any(String),
      noteId,
      blockId: null,
      blockWasDeleted: false,
      question: "What is a queue?",
      answer: "First in, first out.",
      tags: [],
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
  });

  it("keeps line breaks and spacing exactly as typed", async () => {
    const app = makeApp();
    const user = await signedUp(app);
    const noteId = await createdNote(app, user.cookie);
    const multiLine = { question: "  Two kinds?\nName both.", answer: "FIFO\n  and LIFO", tags: [] };

    const created = await addedQuestion(app, noteId, user.cookie, multiLine);
    expect(created).toMatchObject({ question: multiLine.question, answer: multiLine.answer });
  });

  it("finds or creates its tags, trimmed, lowercased and without duplicates, in name order", async () => {
    const app = makeApp();
    const user = await signedUp(app);
    const noteId = await createdNote(app, user.cookie);
    const { body: existingTag } = await request(app)
      .post("/api/tags").set("Cookie", user.cookie).send({ name: "queue" }).expect(201);

    const created = await addedQuestion(app, noteId, user.cookie, {
      ...queueQuestion,
      tags: ["Queue", " queue ", "fifo"],
    });
    expect(created.tags).toEqual([{ id: expect.any(String), name: "fifo" }, existingTag]);
    expect(await allTags(app, user.cookie)).toHaveLength(2);
  });

  it("stores only the tags sent, and doesn't add the note's tags itself", async () => {
    const app = makeApp();
    const user = await signedUp(app);
    const noteId = await createdNote(app, user.cookie);
    await request(app).post(`/api/notes/${noteId}/tags`).set("Cookie", user.cookie).send({ name: "data-structures" }).expect(200);

    const created = await addedQuestion(app, noteId, user.cookie, { ...queueQuestion, tags: ["fifo"] });
    expect(tagNames(created.tags)).toEqual(["fifo"]);
  });

  it("accepts 20 tags", async () => {
    const app = makeApp();
    const user = await signedUp(app);
    const noteId = await createdNote(app, user.cookie);
    const twentyTagNames = Array.from({ length: 20 }, (_, index) => `tag-${index}`);

    const created = await addedQuestion(app, noteId, user.cookie, { ...queueQuestion, tags: twentyTagNames });
    expect(created.tags).toHaveLength(20);
  });

  it("accepts a 500-character question and a 5000-character answer", async () => {
    const app = makeApp();
    const user = await signedUp(app);
    const noteId = await createdNote(app, user.cookie);

    await addQuestion(app, noteId, { question: "q".repeat(500), answer: "a".repeat(5000), tags: [] }, user.cookie).expect(201);
  });

  it.each([
    ["an empty question", { ...queueQuestion, question: "" }, badQuestionText],
    ["a blank question", { ...queueQuestion, question: "   \n " }, badQuestionText],
    ["a 501-character question", { ...queueQuestion, question: "q".repeat(501) }, badQuestionText],
    ["a non-text question", { ...queueQuestion, question: 42 }, badQuestionText],
    ["a missing question", { answer: "x", tags: [] }, badQuestionText],
    ["an empty answer", { ...queueQuestion, answer: "" }, badAnswerText],
    ["a blank answer", { ...queueQuestion, answer: "  " }, badAnswerText],
    ["a 5001-character answer", { ...queueQuestion, answer: "a".repeat(5001) }, badAnswerText],
    ["a missing answer", { question: "x", tags: [] }, badAnswerText],
    ["tags that aren't a list", { ...queueQuestion, tags: "queue" }, badTagList],
    ["a tag that isn't text", { ...queueQuestion, tags: [42] }, badTagList],
    ["missing tags", { question: "x", answer: "y" }, badTagList],
    ["a bad tag name", { ...queueQuestion, tags: ["fifo", ""] }, badTagName],
    ["21 tags", { ...queueQuestion, tags: Array.from({ length: 21 }, (_, index) => `tag-${index}`) }, tooManyTags],
  ])("rejects %s with 400 and saves nothing", async (_, fields, expectedError) => {
    const app = makeApp();
    const user = await signedUp(app);
    const noteId = await createdNote(app, user.cookie);

    const res = await addQuestion(app, noteId, fields, user.cookie);
    expect(res.status).toBe(400);
    expect(res.body).toEqual(expectedError);
    expect(await questionsOnNote(app, noteId, user.cookie)).toEqual([]);
    expect(await allTags(app, user.cookie)).toEqual([]);
  });

  it("returns 404 for another user's note, and saves nothing", async () => {
    const app = makeApp();
    const alice = await signedUp(app);
    const bob = await signedUp(app);
    const aliceNoteId = await createdNote(app, alice.cookie);

    const res = await addQuestion(app, aliceNoteId, { ...queueQuestion, tags: ["fifo"] }, bob.cookie);
    expect(res.status).toBe(404);
    expect(res.body).toEqual(noteNotFound);
    expect(await storedQuestionCountForNote(aliceNoteId)).toBe(0);
    expect(await allTags(app, bob.cookie)).toEqual([]);
  });

  it("returns 404 for an unknown UUID and for a non-UUID note id", async () => {
    const app = makeApp();
    const user = await signedUp(app);
    for (const unknownNoteId of [randomUUID(), "not-a-uuid"]) {
      const res = await addQuestion(app, unknownNoteId, queueQuestion, user.cookie);
      expect(res.status).toBe(404);
      expect(res.body).toEqual(noteNotFound);
    }
  });

  it("rejects a non-JSON body with 415", async () => {
    const app = makeApp();
    const user = await signedUp(app);
    const noteId = await createdNote(app, user.cookie);

    const res = await request(app)
      .post(`/api/notes/${noteId}/questions`).set("Cookie", user.cookie).type("form").send("question=x&answer=y");
    expect(res.status).toBe(415);
  });
});

describe("GET /api/notes/:id/questions", () => {
  it("lists the note's questions oldest first", async () => {
    const app = makeApp();
    const user = await signedUp(app);
    const noteId = await createdNote(app, user.cookie);
    for (const question of ["first", "second", "third"]) {
      await addedQuestion(app, noteId, user.cookie, { ...queueQuestion, question });
    }

    const listed = await questionsOnNote(app, noteId, user.cookie);
    expect(listed.map((row: { question: string }) => row.question)).toEqual(["first", "second", "third"]);
  });

  it("lists only this note's questions", async () => {
    const app = makeApp();
    const user = await signedUp(app);
    const firstNoteId = await createdNote(app, user.cookie);
    const secondNoteId = await createdNote(app, user.cookie);
    const onFirstNote = await addedQuestion(app, firstNoteId, user.cookie);
    await addedQuestion(app, secondNoteId, user.cookie);

    expect(await questionsOnNote(app, firstNoteId, user.cookie)).toEqual([onFirstNote]);
  });

  it("returns an empty list for a note with no questions", async () => {
    const app = makeApp();
    const user = await signedUp(app);
    const noteId = await createdNote(app, user.cookie);

    expect(await questionsOnNote(app, noteId, user.cookie)).toEqual([]);
  });

  it("returns 404 for another user's note, an unknown UUID and a non-UUID id", async () => {
    const app = makeApp();
    const alice = await signedUp(app);
    const bob = await signedUp(app);
    const aliceNoteId = await createdNote(app, alice.cookie);
    await addedQuestion(app, aliceNoteId, alice.cookie);

    for (const noteIdBobCantSee of [aliceNoteId, randomUUID(), "not-a-uuid"]) {
      const res = await listQuestions(app, noteIdBobCantSee, bob.cookie);
      expect(res.status).toBe(404);
      expect(res.body).toEqual(noteNotFound);
    }
  });
});

describe("PUT /api/questions/:questionId", () => {
  it("replaces the text and the question's tags", async () => {
    const app = makeApp();
    const user = await signedUp(app);
    const noteId = await createdNote(app, user.cookie);
    const created = await addedQuestion(app, noteId, user.cookie, { ...queueQuestion, tags: ["fifo", "queue"] });

    const res = await editQuestion(app, created.id, { question: "What is a stack?", answer: "Last in, first out.", tags: ["queue", "lifo"] }, user.cookie);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: created.id, noteId, question: "What is a stack?", answer: "Last in, first out.", createdAt: created.createdAt });
    expect(tagNames(res.body.tags)).toEqual(["lifo", "queue"]);
    expect(await questionsOnNote(app, noteId, user.cookie)).toEqual([res.body]);
  });

  it("removes every tag when sent an empty list", async () => {
    const app = makeApp();
    const user = await signedUp(app);
    const noteId = await createdNote(app, user.cookie);
    const created = await addedQuestion(app, noteId, user.cookie, { ...queueQuestion, tags: ["fifo"] });

    const res = await editQuestion(app, created.id, { ...queueQuestion, tags: [] }, user.cookie).expect(200);
    expect(res.body.tags).toEqual([]);
    expect(await storedRowsForQuestion(created.id)).toEqual({ questionRows: 1, tagLinkRows: 0 });
  });

  it.each([
    ["a blank question", { ...queueQuestion, question: " " }, badQuestionText],
    ["a 5001-character answer", { ...queueQuestion, answer: "a".repeat(5001) }, badAnswerText],
    ["missing tags", { question: "x", answer: "y" }, badTagList],
    ["a bad tag name", { ...queueQuestion, tags: ["a".repeat(51)] }, badTagName],
  ])("rejects %s with 400 and changes nothing", async (_, fields, expectedError) => {
    const app = makeApp();
    const user = await signedUp(app);
    const noteId = await createdNote(app, user.cookie);
    const created = await addedQuestion(app, noteId, user.cookie, { ...queueQuestion, tags: ["fifo"] });

    const res = await editQuestion(app, created.id, fields, user.cookie);
    expect(res.status).toBe(400);
    expect(res.body).toEqual(expectedError);
    expect(await questionsOnNote(app, noteId, user.cookie)).toEqual([created]);
  });

  it("returns 404 for another user's question, and changes nothing", async () => {
    const app = makeApp();
    const alice = await signedUp(app);
    const bob = await signedUp(app);
    const aliceNoteId = await createdNote(app, alice.cookie);
    const aliceQuestion = await addedQuestion(app, aliceNoteId, alice.cookie);

    const res = await editQuestion(app, aliceQuestion.id, { ...queueQuestion, question: "hacked", tags: ["bob-tag"] }, bob.cookie);
    expect(res.status).toBe(404);
    expect(res.body).toEqual(questionNotFound);
    expect(await questionsOnNote(app, aliceNoteId, alice.cookie)).toEqual([aliceQuestion]);
    expect(await allTags(app, bob.cookie)).toEqual([]);
  });

  it("returns 404 for an unknown UUID, a non-UUID id, and a deleted question", async () => {
    const app = makeApp();
    const user = await signedUp(app);
    const noteId = await createdNote(app, user.cookie);
    const deleted = await addedQuestion(app, noteId, user.cookie);
    await deleteQuestion(app, deleted.id, user.cookie).expect(204);

    for (const missingQuestionId of [randomUUID(), "not-a-uuid", deleted.id]) {
      const res = await editQuestion(app, missingQuestionId, queueQuestion, user.cookie);
      expect(res.status).toBe(404);
      expect(res.body).toEqual(questionNotFound);
    }
  });
});

describe("DELETE /api/questions/:questionId", () => {
  it("deletes the question and its tag links, but keeps the tags", async () => {
    const app = makeApp();
    const user = await signedUp(app);
    const noteId = await createdNote(app, user.cookie);
    const created = await addedQuestion(app, noteId, user.cookie, { ...queueQuestion, tags: ["fifo"] });

    const res = await deleteQuestion(app, created.id, user.cookie);
    expect(res.status).toBe(204);
    expect(await questionsOnNote(app, noteId, user.cookie)).toEqual([]);
    expect(await storedRowsForQuestion(created.id)).toEqual({ questionRows: 0, tagLinkRows: 0 });
    expect(tagNames(await allTags(app, user.cookie))).toEqual(["fifo"]);
  });

  it("returns 404 for another user's question, and leaves it alone", async () => {
    const app = makeApp();
    const alice = await signedUp(app);
    const bob = await signedUp(app);
    const aliceNoteId = await createdNote(app, alice.cookie);
    const aliceQuestion = await addedQuestion(app, aliceNoteId, alice.cookie);

    const res = await deleteQuestion(app, aliceQuestion.id, bob.cookie);
    expect(res.status).toBe(404);
    expect(res.body).toEqual(questionNotFound);
    expect(await questionsOnNote(app, aliceNoteId, alice.cookie)).toEqual([aliceQuestion]);
  });

  it("returns 404 the second time, and for a non-UUID id", async () => {
    const app = makeApp();
    const user = await signedUp(app);
    const noteId = await createdNote(app, user.cookie);
    const created = await addedQuestion(app, noteId, user.cookie);
    await deleteQuestion(app, created.id, user.cookie).expect(204);

    for (const missingQuestionId of [created.id, "not-a-uuid"]) {
      const res = await deleteQuestion(app, missingQuestionId, user.cookie);
      expect(res.status).toBe(404);
      expect(res.body).toEqual(questionNotFound);
    }
  });
});

describe("deleting what a question hangs off", () => {
  it("deleting a note deletes its questions and their tag links", async () => {
    const app = makeApp();
    const user = await signedUp(app);
    const noteId = await createdNote(app, user.cookie);
    const created = await addedQuestion(app, noteId, user.cookie, { ...queueQuestion, tags: ["fifo"] });

    await request(app).delete(`/api/notes/${noteId}`).set("Cookie", user.cookie).send({}).expect(204);
    expect(await storedRowsForQuestion(created.id)).toEqual({ questionRows: 0, tagLinkRows: 0 });
  });

  it("deleting a tag on the Tags page takes it off the question, and keeps the question", async () => {
    const app = makeApp();
    const user = await signedUp(app);
    const noteId = await createdNote(app, user.cookie);
    const created = await addedQuestion(app, noteId, user.cookie, { ...queueQuestion, tags: ["fifo", "queue"] });
    const fifoTag = created.tags.find((tag: { name: string }) => tag.name === "fifo");

    await request(app).delete(`/api/tags/${fifoTag.id}`).set("Cookie", user.cookie).send({}).expect(204);
    const [afterTagDeleted] = await questionsOnNote(app, noteId, user.cookie);
    expect(tagNames(afterTagDeleted.tags)).toEqual(["queue"]);
  });
});

// Run a few rounds so either request has a fair chance of winning.
describe("races", () => {
  it("editing and deleting a question at once never errors, and it ends up deleted", async () => {
    const app = makeApp();
    const user = await signedUp(app);
    const noteId = await createdNote(app, user.cookie);
    for (let round = 0; round < 5; round++) {
      const created = await addedQuestion(app, noteId, user.cookie);

      const [edit, deletion] = await Promise.all([
        editQuestion(app, created.id, { ...queueQuestion, tags: ["fifo"] }, user.cookie),
        deleteQuestion(app, created.id, user.cookie),
      ]);
      expect([200, 404]).toContain(edit.status);
      expect(deletion.status).toBe(204);
      expect(await storedRowsForQuestion(created.id)).toEqual({ questionRows: 0, tagLinkRows: 0 });
    }
  });

  it("adding a question while its note is deleted never errors, and leaves no question behind", async () => {
    const app = makeApp();
    const user = await signedUp(app);
    for (let round = 0; round < 5; round++) {
      const noteId = await createdNote(app, user.cookie);

      const [addition, noteDeletion] = await Promise.all([
        addQuestion(app, noteId, { ...queueQuestion, tags: ["fifo"] }, user.cookie),
        request(app).delete(`/api/notes/${noteId}`).set("Cookie", user.cookie).send({}),
      ]);
      expect([201, 404]).toContain(addition.status);
      expect(noteDeletion.status).toBe(204);
      expect(await storedQuestionCountForNote(noteId)).toBe(0);
    }
  });

  it("editing a question while its note is deleted never errors, and leaves no question behind", async () => {
    const app = makeApp();
    const user = await signedUp(app);
    for (let round = 0; round < 5; round++) {
      const noteId = await createdNote(app, user.cookie);
      const created = await addedQuestion(app, noteId, user.cookie);

      const [edit, noteDeletion] = await Promise.all([
        editQuestion(app, created.id, { ...queueQuestion, tags: ["fifo"] }, user.cookie),
        request(app).delete(`/api/notes/${noteId}`).set("Cookie", user.cookie).send({}),
      ]);
      expect([200, 404]).toContain(edit.status);
      expect(noteDeletion.status).toBe(204);
      expect(await storedRowsForQuestion(created.id)).toEqual({ questionRows: 0, tagLinkRows: 0 });
    }
  });

  // Each save locks the tags it upserts. Sent in opposite orders, they'd deadlock (a 500) unless
  // the server locks them in one fixed order.
  it("two saves sharing tags in opposite orders both succeed", async () => {
    const app = makeApp();
    const user = await signedUp(app);
    const noteId = await createdNote(app, user.cookie);
    for (let round = 0; round < 5; round++) {
      const first = await addedQuestion(app, noteId, user.cookie);
      const second = await addedQuestion(app, noteId, user.cookie);
      const sharedTagNames = Array.from({ length: 10 }, (_, index) => `shared-${round}-${index}`);

      const [firstSave, secondSave] = await Promise.all([
        editQuestion(app, first.id, { ...queueQuestion, tags: sharedTagNames }, user.cookie),
        editQuestion(app, second.id, { ...queueQuestion, tags: [...sharedTagNames].reverse() }, user.cookie),
      ]);
      expect([firstSave.status, secondSave.status]).toEqual([200, 200]);
    }
  });
});
