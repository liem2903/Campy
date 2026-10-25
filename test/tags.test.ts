import { randomUUID } from "node:crypto";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { makeApp, signedUp } from "./helpers.js";

type App = ReturnType<typeof makeApp>;

// One helper per request. Mutating ones always send a JSON body, like the client does, so the
// 415 check passes.
function listTags(app: App, cookie: string) {
  return request(app).get("/api/tags").set("Cookie", cookie);
}
function createTag(app: App, name: unknown, cookie: string) {
  return request(app).post("/api/tags").set("Cookie", cookie).send({ name });
}
function renameTag(app: App, tagId: string, name: unknown, cookie: string) {
  return request(app).patch(`/api/tags/${tagId}`).set("Cookie", cookie).send({ name });
}
function deleteTag(app: App, tagId: string, cookie: string) {
  return request(app).delete(`/api/tags/${tagId}`).set("Cookie", cookie).send({});
}
function tagNote(app: App, noteId: string, name: string, cookie: string) {
  return request(app).post(`/api/notes/${noteId}/tags`).set("Cookie", cookie).send({ name });
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

// The bodies name the tag, so a test can't pass on the app's catch-all 404 ("Not found").
const tagNotFound = { error: "Tag not found" };
const invalidName = { error: "A tag name must be 1 to 50 characters" };
const badNames = ["", "   ", "a".repeat(51), 42, undefined];

describe("GET /api/tags", () => {
  it("rejects a request with no cookie", async () => {
    const res = await request(makeApp()).get("/api/tags");
    expect(res.status).toBe(401);
  });

  it("lists the user's tags in name order, with how many notes each is on", async () => {
    const app = makeApp();
    const user = await signedUp(app);
    await createTag(app, "zebra", user.cookie).expect(201);
    await tagNote(app, await createdNote(app, user.cookie), "queue", user.cookie).expect(200);
    await tagNote(app, await createdNote(app, user.cookie), "queue", user.cookie).expect(200);

    const res = await listTags(app, user.cookie);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      { id: expect.any(String), name: "queue", noteCount: 2 },
      { id: expect.any(String), name: "zebra", noteCount: 0 },
    ]);
  });

  it("doesn't list another user's tags", async () => {
    const app = makeApp();
    const alice = await signedUp(app);
    const bob = await signedUp(app);
    await createTag(app, "secret", alice.cookie).expect(201);

    const res = await listTags(app, bob.cookie).expect(200);
    expect(res.body).toEqual([]);
  });
});

describe("POST /api/tags", () => {
  it("rejects a request with no cookie", async () => {
    const res = await request(makeApp()).post("/api/tags").send({ name: "queue" });
    expect(res.status).toBe(401);
  });

  it("creates a tag on no notes, trimmed and lowercased", async () => {
    const app = makeApp();
    const user = await signedUp(app);

    const res = await createTag(app, "  Queue ", user.cookie);
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ id: expect.any(String), name: "queue" });
    const listed = await listTags(app, user.cookie).expect(200);
    expect(listed.body).toEqual([{ id: res.body.id, name: "queue", noteCount: 0 }]);
  });

  it("accepts a 50-character name", async () => {
    const app = makeApp();
    const user = await signedUp(app);
    await createTag(app, "a".repeat(50), user.cookie).expect(201);
  });

  it("returns 409 when the user already has that name, in any case", async () => {
    const app = makeApp();
    const user = await signedUp(app);
    await createTag(app, "queue", user.cookie).expect(201);

    const res = await createTag(app, "QUEUE", user.cookie);
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: "A tag called queue already exists" });
  });

  it("lets two users have a tag with the same name", async () => {
    const app = makeApp();
    const alice = await signedUp(app);
    const bob = await signedUp(app);
    await createTag(app, "queue", alice.cookie).expect(201);
    await createTag(app, "queue", bob.cookie).expect(201);
  });

  it("returns 400 for an empty, blank, too long or non-text name", async () => {
    const app = makeApp();
    const user = await signedUp(app);
    for (const badName of badNames) {
      const res = await createTag(app, badName, user.cookie);
      expect(res.status).toBe(400);
      expect(res.body).toEqual(invalidName);
    }
  });
});

describe("PATCH /api/tags/:tagId", () => {
  it("rejects a request with no cookie", async () => {
    const res = await request(makeApp()).patch(`/api/tags/${randomUUID()}`).send({ name: "queue" });
    expect(res.status).toBe(401);
  });

  it("renames the tag, trimmed and lowercased", async () => {
    const app = makeApp();
    const user = await signedUp(app);
    const { body: tag } = await createTag(app, "queue", user.cookie).expect(201);

    const res = await renameTag(app, tag.id, " Queues ", user.cookie);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: tag.id, name: "queues" });
  });

  it("allows renaming a tag to its own name", async () => {
    const app = makeApp();
    const user = await signedUp(app);
    const { body: tag } = await createTag(app, "queue", user.cookie).expect(201);

    await renameTag(app, tag.id, "QUEUE", user.cookie).expect(200);
  });

  it("returns 409 when another of the user's tags has that name, and changes nothing", async () => {
    const app = makeApp();
    const user = await signedUp(app);
    const { body: queueTag } = await createTag(app, "queue", user.cookie).expect(201);
    await createTag(app, "stack", user.cookie).expect(201);

    const res = await renameTag(app, queueTag.id, "stack", user.cookie);
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: "A tag called stack already exists" });
    const listed = await listTags(app, user.cookie).expect(200);
    expect(listed.body.map((tag: { name: string }) => tag.name)).toEqual(["queue", "stack"]);
  });

  it("returns 400 for an empty, blank, too long or non-text name", async () => {
    const app = makeApp();
    const user = await signedUp(app);
    const { body: tag } = await createTag(app, "queue", user.cookie).expect(201);
    for (const badName of badNames) {
      const res = await renameTag(app, tag.id, badName, user.cookie);
      expect(res.status).toBe(400);
      expect(res.body).toEqual(invalidName);
    }
  });

  it("returns 404 for another user's tag, and leaves it alone", async () => {
    const app = makeApp();
    const alice = await signedUp(app);
    const bob = await signedUp(app);
    const { body: aliceTag } = await createTag(app, "queue", alice.cookie).expect(201);

    const res = await renameTag(app, aliceTag.id, "hacked", bob.cookie);
    expect(res.status).toBe(404);
    expect(res.body).toEqual(tagNotFound);
    const listed = await listTags(app, alice.cookie).expect(200);
    expect(listed.body[0].name).toBe("queue");
  });

  it("returns 404 for an unknown UUID and for a non-UUID id", async () => {
    const app = makeApp();
    const user = await signedUp(app);
    for (const unknownTagId of [randomUUID(), "not-a-uuid"]) {
      const res = await renameTag(app, unknownTagId, "queue", user.cookie);
      expect(res.status).toBe(404);
      expect(res.body).toEqual(tagNotFound);
    }
  });
});

describe("DELETE /api/tags/:tagId", () => {
  it("rejects a request with no cookie", async () => {
    const res = await request(makeApp()).delete(`/api/tags/${randomUUID()}`).send({});
    expect(res.status).toBe(401);
  });

  it("deletes the tag and takes it off every note", async () => {
    const app = makeApp();
    const user = await signedUp(app);
    const firstNoteId = await createdNote(app, user.cookie);
    const secondNoteId = await createdNote(app, user.cookie);
    const { body: tag } = await tagNote(app, firstNoteId, "queue", user.cookie).expect(200);
    await tagNote(app, secondNoteId, "queue", user.cookie).expect(200);

    const res = await deleteTag(app, tag.id, user.cookie);
    expect(res.status).toBe(204);
    expect((await listTags(app, user.cookie)).body).toEqual([]);
    expect(await tagsOnNote(app, firstNoteId, user.cookie)).toEqual([]);
    expect(await tagsOnNote(app, secondNoteId, user.cookie)).toEqual([]);
  });

  it("returns 404 for another user's tag, and leaves it alone", async () => {
    const app = makeApp();
    const alice = await signedUp(app);
    const bob = await signedUp(app);
    const { body: aliceTag } = await createTag(app, "queue", alice.cookie).expect(201);

    const res = await deleteTag(app, aliceTag.id, bob.cookie);
    expect(res.status).toBe(404);
    expect(res.body).toEqual(tagNotFound);
    expect((await listTags(app, alice.cookie)).body).toHaveLength(1);
  });

  it("returns 404 for an unknown UUID and for a non-UUID id", async () => {
    const app = makeApp();
    const user = await signedUp(app);
    for (const unknownTagId of [randomUUID(), "not-a-uuid"]) {
      const res = await deleteTag(app, unknownTagId, user.cookie);
      expect(res.status).toBe(404);
      expect(res.body).toEqual(tagNotFound);
    }
  });
});
