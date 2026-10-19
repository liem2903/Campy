import { randomUUID } from "node:crypto";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { sql } from "../src/db/client.js";
import { makeApp, signedUp } from "./helpers.js";

type App = ReturnType<typeof makeApp>;

function updateNote(app: App, id: string, body: object, cookie?: string) {
  const req = request(app).put(`/api/notes/${id}`);
  return (cookie ? req.set("Cookie", cookie) : req).send(body);
}

// Creates a note through the API, so it has its text block like a real one.
async function createdNote(app: App, cookie: string) {
  const id = randomUUID();
  await request(app).post("/api/notes").set("Cookie", cookie).send({ id }).expect(201);
  return id;
}

// The note's title and body, read straight from the DB.
async function storedNote(noteId: string) {
  const [note] = await sql<{ title: string; body: string }[]>`
    select n.title, b.properties->>'text' as body
    from notes n join blocks b on b.note_id = n.id and b.parent_id is null
    where n.id = ${noteId}
  `;
  return note;
}

// The 404 body names the note, so these tests can't pass on the app's
// catch-all 404 ("Not found") before the route exists.
const notFound = { error: "Note not found" };

describe("PUT /api/notes/:id", () => {
  it("rejects a request with no cookie", async () => {
    const res = await updateNote(makeApp(), randomUUID(), { title: "T", body: "B" });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "You're not logged in" });
  });

  it("saves the title and body, and GET returns them", async () => {
    const app = makeApp();
    const user = await signedUp(app);
    const id = await createdNote(app, user.cookie);

    const res = await updateNote(app, id, { title: "Chem", body: "Atoms" }, user.cookie);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ updatedAt: expect.any(String) });

    const opened = await request(app).get(`/api/notes/${id}`).set("Cookie", user.cookie).expect(200);
    expect(opened.body).toEqual({ id, title: "Chem", body: "Atoms", updatedAt: res.body.updatedAt });
  });

  it("moves updatedAt forward and the note to the top of the list", async () => {
    const app = makeApp();
    const user = await signedUp(app);
    const older = await createdNote(app, user.cookie);
    const newer = await createdNote(app, user.cookie);
    const [{ updated_at: before }] = await sql<{ updated_at: Date }[]>`
      select updated_at from notes where id = ${older}
    `;

    const res = await updateNote(app, older, { title: "Edited", body: "" }, user.cookie).expect(200);
    expect(new Date(res.body.updatedAt).getTime()).toBeGreaterThan(before.getTime());

    const list = await request(app).get("/api/notes").set("Cookie", user.cookie).expect(200);
    expect(list.body.map((note: { id: string }) => note.id)).toEqual([older, newer]);
  });

  it("returns 404 for another user's note and leaves it unchanged", async () => {
    const app = makeApp();
    const alice = await signedUp(app);
    const bob = await signedUp(app);
    const aliceNote = await createdNote(app, alice.cookie);

    const res = await updateNote(app, aliceNote, { title: "Hacked", body: "Hacked" }, bob.cookie);
    expect(res.status).toBe(404);
    expect(res.body).toEqual(notFound);
    expect(await storedNote(aliceNote)).toEqual({ title: "", body: "" });
  });

  it("returns 404 for an unknown UUID and for a non-UUID id", async () => {
    const app = makeApp();
    const user = await signedUp(app);

    for (const id of [randomUUID(), "not-a-uuid"]) {
      const res = await updateNote(app, id, { title: "T", body: "B" }, user.cookie);
      expect(res.status).toBe(404);
      expect(res.body).toEqual(notFound);
    }
  });

  it("accepts a 200-character title and rejects 201 characters", async () => {
    const app = makeApp();
    const user = await signedUp(app);
    const id = await createdNote(app, user.cookie);

    await updateNote(app, id, { title: "x".repeat(200), body: "" }, user.cookie).expect(200);
    const res = await updateNote(app, id, { title: "x".repeat(201), body: "" }, user.cookie);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Title must be 200 characters or fewer" });
  });

  it("rejects a missing or non-string title or body with 400", async () => {
    const app = makeApp();
    const user = await signedUp(app);
    const id = await createdNote(app, user.cookie);

    const badBodies = [{ body: "B" }, { title: "T" }, { title: 1, body: "B" }, { title: "T", body: null }];
    for (const badBody of badBodies) {
      const res = await updateNote(app, id, badBody, user.cookie);
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: "Title and body must be strings" });
    }
    expect(await storedNote(id)).toEqual({ title: "", body: "" });
  });

  it("rejects a body over 100kb with 413", async () => {
    const app = makeApp();
    const user = await signedUp(app);
    const id = await createdNote(app, user.cookie);

    const res = await updateNote(app, id, { title: "", body: "x".repeat(101 * 1024) }, user.cookie);
    expect(res.status).toBe(413);
  });


  it("rejects a non-JSON body with 415", async () => {
    const app = makeApp();
    const user = await signedUp(app);
    const id = await createdNote(app, user.cookie);

    const res = await request(app)
      .put(`/api/notes/${id}`)
      .set("Cookie", user.cookie)
      .type("form")
      .send("title=T&body=B");
    expect(res.status).toBe(415);
    expect(res.body).toEqual({ error: "Requests must be sent as JSON" });
  });
});
