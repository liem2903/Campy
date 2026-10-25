import { randomUUID } from "node:crypto";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { makeApp, signedUp } from "./helpers.js";

type App = ReturnType<typeof makeApp>;

function tagNote(app: App, noteId: string, name: unknown, cookie: string) {
  return request(app).post(`/api/notes/${noteId}/tags`).set("Cookie", cookie).send({ name });
}
function untagNote(app: App, noteId: string, tagId: string, cookie: string) {
  return request(app).delete(`/api/notes/${noteId}/tags/${tagId}`).set("Cookie", cookie).send({});
}
async function createdNote(app: App, cookie: string) {
  const noteId = randomUUID();
  await request(app).post("/api/notes").set("Cookie", cookie).send({ id: noteId }).expect(201);
  return noteId;
}
async function tagsOnNote(app: App, noteId: string, cookie: string) {
  const res = await request(app).get(`/api/notes/${noteId}`).set("Cookie", cookie).expect(200);
  return res.body.tags;
}
async function allTags(app: App, cookie: string) {
  const res = await request(app).get("/api/tags").set("Cookie", cookie).expect(200);
  return res.body;
}

const noteNotFound = { error: "Note not found" };
const tagNotFound = { error: "Tag not found" };

describe("the T1 slice", () => {
  it("tag a note, see it on the Tags page, rename it, the note shows the new name", async () => {
    const app = makeApp();
    const user = await signedUp(app);
    const noteId = await createdNote(app, user.cookie);

    const { body: tag } = await tagNote(app, noteId, "queue", user.cookie).expect(200);
    expect(await tagsOnNote(app, noteId, user.cookie)).toEqual([{ id: tag.id, name: "queue" }]);
    expect(await allTags(app, user.cookie)).toEqual([{ id: tag.id, name: "queue", noteCount: 1 }]);

    await request(app).patch(`/api/tags/${tag.id}`).set("Cookie", user.cookie).send({ name: "queues" }).expect(200);
    expect(await tagsOnNote(app, noteId, user.cookie)).toEqual([{ id: tag.id, name: "queues" }]);
  });
});

describe("POST /api/notes/:id/tags", () => {
  it("rejects a request with no cookie", async () => {
    const res = await request(makeApp()).post(`/api/notes/${randomUUID()}/tags`).send({ name: "queue" });
    expect(res.status).toBe(401);
  });

  it("creates a new tag and puts it on the note", async () => {
    const app = makeApp();
    const user = await signedUp(app);
    const noteId = await createdNote(app, user.cookie);

    const res = await tagNote(app, noteId, "queue", user.cookie);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: expect.any(String), name: "queue" });
    expect(await tagsOnNote(app, noteId, user.cookie)).toEqual([res.body]);
  });

  it("reuses a tag the user already has, matching it trimmed and lowercased", async () => {
    const app = makeApp();
    const user = await signedUp(app);
    const noteId = await createdNote(app, user.cookie);
    const { body: existingTag } = await request(app)
      .post("/api/tags").set("Cookie", user.cookie).send({ name: "queue" }).expect(201);

    const res = await tagNote(app, noteId, "  Queue ", user.cookie).expect(200);
    expect(res.body).toEqual(existingTag);
    expect(await allTags(app, user.cookie)).toHaveLength(1);
  });

  it("does nothing when the note already has the tag", async () => {
    const app = makeApp();
    const user = await signedUp(app);
    const noteId = await createdNote(app, user.cookie);
    const { body: tag } = await tagNote(app, noteId, "queue", user.cookie).expect(200);

    await tagNote(app, noteId, "queue", user.cookie).expect(200);
    expect(await tagsOnNote(app, noteId, user.cookie)).toEqual([tag]);
  });

  it("lists a note's tags in name order", async () => {
    const app = makeApp();
    const user = await signedUp(app);
    const noteId = await createdNote(app, user.cookie);
    await tagNote(app, noteId, "stack", user.cookie).expect(200);
    await tagNote(app, noteId, "queue", user.cookie).expect(200);

    const tags = await tagsOnNote(app, noteId, user.cookie);
    expect(tags.map((tag: { name: string }) => tag.name)).toEqual(["queue", "stack"]);
  });

  it("returns 400 for an empty, blank, too long or non-text name", async () => {
    const app = makeApp();
    const user = await signedUp(app);
    const noteId = await createdNote(app, user.cookie);
    for (const badName of ["", "   ", "a".repeat(51), 42, undefined]) {
      const res = await tagNote(app, noteId, badName, user.cookie);
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: "A tag name must be 1 to 50 characters" });
    }
  });

  it("returns 404 for another user's note, and creates no tag", async () => {
    const app = makeApp();
    const alice = await signedUp(app);
    const bob = await signedUp(app);
    const aliceNoteId = await createdNote(app, alice.cookie);

    const res = await tagNote(app, aliceNoteId, "queue", bob.cookie);
    expect(res.status).toBe(404);
    expect(res.body).toEqual(noteNotFound);
    expect(await tagsOnNote(app, aliceNoteId, alice.cookie)).toEqual([]);
    expect(await allTags(app, bob.cookie)).toEqual([]);
  });

  it("returns 404 for an unknown UUID and for a non-UUID note id", async () => {
    const app = makeApp();
    const user = await signedUp(app);
    for (const unknownNoteId of [randomUUID(), "not-a-uuid"]) {
      const res = await tagNote(app, unknownNoteId, "queue", user.cookie);
      expect(res.status).toBe(404);
      expect(res.body).toEqual(noteNotFound);
    }
  });
});

describe("DELETE /api/notes/:id/tags/:tagId", () => {
  it("rejects a request with no cookie", async () => {
    const res = await request(makeApp()).delete(`/api/notes/${randomUUID()}/tags/${randomUUID()}`).send({});
    expect(res.status).toBe(401);
  });

  it("takes the tag off this note only, and keeps the tag", async () => {
    const app = makeApp();
    const user = await signedUp(app);
    const firstNoteId = await createdNote(app, user.cookie);
    const secondNoteId = await createdNote(app, user.cookie);
    const { body: tag } = await tagNote(app, firstNoteId, "queue", user.cookie).expect(200);
    await tagNote(app, secondNoteId, "queue", user.cookie).expect(200);

    const res = await untagNote(app, firstNoteId, tag.id, user.cookie);
    expect(res.status).toBe(204);
    expect(await tagsOnNote(app, firstNoteId, user.cookie)).toEqual([]);
    expect(await tagsOnNote(app, secondNoteId, user.cookie)).toEqual([tag]);
    expect(await allTags(app, user.cookie)).toEqual([{ ...tag, noteCount: 1 }]);
  });

  it("returns 204 when the note doesn't have that tag", async () => {
    const app = makeApp();
    const user = await signedUp(app);
    const noteId = await createdNote(app, user.cookie);

    await untagNote(app, noteId, randomUUID(), user.cookie).expect(204);
  });

  it("returns 404 for another user's note, and leaves its tags alone", async () => {
    const app = makeApp();
    const alice = await signedUp(app);
    const bob = await signedUp(app);
    const aliceNoteId = await createdNote(app, alice.cookie);
    const { body: aliceTag } = await tagNote(app, aliceNoteId, "queue", alice.cookie).expect(200);

    const res = await untagNote(app, aliceNoteId, aliceTag.id, bob.cookie);
    expect(res.status).toBe(404);
    expect(res.body).toEqual(noteNotFound);
    expect(await tagsOnNote(app, aliceNoteId, alice.cookie)).toEqual([aliceTag]);
  });

  it("returns 404 for a non-UUID note id or tag id", async () => {
    const app = makeApp();
    const user = await signedUp(app);
    const noteId = await createdNote(app, user.cookie);

    const badNote = await untagNote(app, "not-a-uuid", randomUUID(), user.cookie);
    expect(badNote.status).toBe(404);
    expect(badNote.body).toEqual(noteNotFound);
    const badTag = await untagNote(app, noteId, "not-a-uuid", user.cookie);
    expect(badTag.status).toBe(404);
    expect(badTag.body).toEqual(tagNotFound);
  });
});
