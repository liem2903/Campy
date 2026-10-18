import { randomUUID } from "node:crypto";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { sql } from "../src/db/client.js";
import { makeApp, signedUp } from "./helpers.js";

type App = ReturnType<typeof makeApp>;

function getNote(app: App, id: string, cookie?: string) {
  const req = request(app).get(`/api/notes/${id}`);
  return cookie ? req.set("Cookie", cookie) : req;
}

// Inserts a note and its top-level text blocks straight into the DB.
// Each body is one block, at positions a0, a1, … in the order given.
async function seedNote(userId: string, title: string, bodies: string[], updatedAt: string) {
  const id = randomUUID();
  await sql`
    insert into notes (id, user_id, title, updated_at)
    values (${id}, ${userId}, ${title}, ${updatedAt})
  `;
  for (const [i, text] of bodies.entries()) {
    await sql`
      insert into blocks (note_id, position, type, properties)
      values (${id}, ${`a${i}`}, 'text', ${sql.json({ text })})
    `;
  }
  return id;
}

// The 404 body names the note, so these tests can't pass on the app's
// catch-all 404 ("Not found") before the route exists.
const notFound = { error: "Note not found" };

describe("GET /api/notes/:id", () => {
  it("rejects a request with no cookie", async () => {
    const res = await getNote(makeApp(), randomUUID());
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "You're not logged in" });
  });

  it("returns the user's own note with its body", async () => {
    const app = makeApp();
    const user = await signedUp(app);
    const id = await seedNote(user.id, "Chem", ["Atoms"], "2026-01-01T10:00:00.000Z");

    const res = await getNote(app, id, user.cookie);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id, title: "Chem", body: "Atoms", updatedAt: "2026-01-01T10:00:00.000Z" });
  });

  it("returns the first top-level text block when there are several", async () => {
    const app = makeApp();
    const user = await signedUp(app);
    // Inserted a0 then a1; the body must come from position, not luck.
    const id = await seedNote(user.id, "Chem", ["First", "Second"], "2026-01-01T10:00:00.000Z");

    const res = await getNote(app, id, user.cookie).expect(200);
    expect(res.body.body).toBe("First");
  });

  it("returns 404 for another user's note, same as a missing one", async () => {
    const app = makeApp();
    const alice = await signedUp(app);
    const bob = await signedUp(app);
    const aliceNote = await seedNote(alice.id, "Alice's", ["secret"], "2026-01-01T10:00:00.000Z");

    const res = await getNote(app, aliceNote, bob.cookie);
    expect(res.status).toBe(404);
    expect(res.body).toEqual(notFound);
  });

  it("returns 404 for an unknown UUID", async () => {
    const app = makeApp();
    const user = await signedUp(app);

    const res = await getNote(app, randomUUID(), user.cookie);
    expect(res.status).toBe(404);
    expect(res.body).toEqual(notFound);
  });

  it("returns 404 for a non-UUID id", async () => {
    const app = makeApp();
    const user = await signedUp(app);

    const res = await getNote(app, "not-a-uuid", user.cookie);
    expect(res.status).toBe(404);
    expect(res.body).toEqual(notFound);
  });
});
