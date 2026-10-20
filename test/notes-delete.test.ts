import { randomUUID } from "node:crypto";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { sql } from "../src/db/client.js";
import { makeApp, signedUp } from "./helpers.js";

type App = ReturnType<typeof makeApp>;

// Sends {} as JSON, like the client does, so the 415 check passes.
function deleteNote(app: App, id: string, cookie?: string) {
  const req = request(app).delete(`/api/notes/${id}`);
  return (cookie ? req.set("Cookie", cookie) : req).send({});
}

// Creates a note through the API, so it has its text block like a real one.
async function createdNote(app: App, cookie: string) {
  const id = randomUUID();
  await request(app).post("/api/notes").set("Cookie", cookie).send({ id }).expect(201);
  return id;
}

// How many notes rows and blocks rows the DB holds for this note id.
async function storedRowCounts(noteId: string) {
  const [{ count: noteRows }] = await sql<{ count: number }[]>`
    select count(*)::int as count from notes where id = ${noteId}
  `;
  const [{ count: blockRows }] = await sql<{ count: number }[]>`
    select count(*)::int as count from blocks where note_id = ${noteId}
  `;
  return { noteRows, blockRows };
}

// The 404 body names the note, so these tests can't pass on the app's
// catch-all 404 ("Not found") before the route exists.
const notFound = { error: "Note not found" };

describe("DELETE /api/notes/:id", () => {
  it("rejects a request with no cookie", async () => {
    const res = await deleteNote(makeApp(), randomUUID());
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "You're not logged in" });
  });

  it("deletes the user's own note and its blocks", async () => {
    const app = makeApp();
    const user = await signedUp(app);
    const id = await createdNote(app, user.cookie);
    expect(await storedRowCounts(id)).toEqual({ noteRows: 1, blockRows: 1 });

    const res = await deleteNote(app, id, user.cookie);
    expect(res.status).toBe(204);
    expect(await storedRowCounts(id)).toEqual({ noteRows: 0, blockRows: 0 });
    await request(app).get(`/api/notes/${id}`).set("Cookie", user.cookie).expect(404);
  });

  it("returns 404 for another user's note and leaves it alone", async () => {
    const app = makeApp();
    const alice = await signedUp(app);
    const bob = await signedUp(app);
    const aliceNote = await createdNote(app, alice.cookie);

    const res = await deleteNote(app, aliceNote, bob.cookie);
    expect(res.status).toBe(404);
    expect(res.body).toEqual(notFound);
    expect(await storedRowCounts(aliceNote)).toEqual({ noteRows: 1, blockRows: 1 });
  });

  it("returns 404 the second time a note is deleted", async () => {
    const app = makeApp();
    const user = await signedUp(app);
    const id = await createdNote(app, user.cookie);

    await deleteNote(app, id, user.cookie).expect(204);
    const res = await deleteNote(app, id, user.cookie);
    expect(res.status).toBe(404);
    expect(res.body).toEqual(notFound);
  });

  // An autosave PUT already on its way when the user deletes must not bring the note back.
  it("returns 404 to a PUT that arrives after the delete", async () => {
    const app = makeApp();
    const user = await signedUp(app);
    const id = await createdNote(app, user.cookie);

    await deleteNote(app, id, user.cookie).expect(204);
    const res = await request(app)
      .put(`/api/notes/${id}`)
      .set("Cookie", user.cookie)
      .send({ title: "Late", body: "Save" });
    expect(res.status).toBe(404);
    expect(res.body).toEqual(notFound);
    expect(await storedRowCounts(id)).toEqual({ noteRows: 0, blockRows: 0 });
  });

  it("returns 404 for a non-UUID id", async () => {
    const app = makeApp();
    const user = await signedUp(app);

    const res = await deleteNote(app, "not-a-uuid", user.cookie);
    expect(res.status).toBe(404);
    expect(res.body).toEqual(notFound);
  });

  it("rejects a non-JSON request with 415", async () => {
    const app = makeApp();
    const user = await signedUp(app);
    const id = await createdNote(app, user.cookie);

    const res = await request(app).delete(`/api/notes/${id}`).set("Cookie", user.cookie);
    expect(res.status).toBe(415);
    expect(await storedRowCounts(id)).toEqual({ noteRows: 1, blockRows: 1 });
  });
});
