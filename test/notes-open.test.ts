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

// Inserts a note and its top-level text blocks straight into the DB, at positions a0, a1, …
// in the order given. Rows go in last-first, so GET's order has to come from position.
async function seedNote(userId: string, title: string, texts: string[], updatedAt: string) {
  const id = randomUUID();
  const blockIds = texts.map(() => randomUUID());
  await sql`
    insert into notes (id, user_id, title, updated_at)
    values (${id}, ${userId}, ${title}, ${updatedAt})
  `;
  for (const [i, text] of [...texts.entries()].reverse()) {
    await sql`
      insert into blocks (id, note_id, position, type, properties)
      values (${blockIds[i]}, ${id}, ${`a${i}`}, 'text', ${sql.json({ text })})
    `;
  }
  return { id, blockIds };
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

  it("returns the user's own note with its blocks", async () => {
    const app = makeApp();
    const user = await signedUp(app);
    const { id, blockIds } = await seedNote(user.id, "Chem", ["Atoms"], "2026-01-01T10:00:00.000Z");

    const res = await getNote(app, id, user.cookie);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      id,
      title: "Chem",
      updatedAt: "2026-01-01T10:00:00.000Z",
      blocks: [{ id: blockIds[0], type: "text", properties: { text: "Atoms" } }],
      tags: [],
    });
  });

  it("returns the blocks in position order", async () => {
    const app = makeApp();
    const user = await signedUp(app);
    const { id } = await seedNote(user.id, "Chem", ["First", "Second", "Third"], "2026-01-01T10:00:00.000Z");

    const res = await getNote(app, id, user.cookie).expect(200);
    const texts = res.body.blocks.map((block: { properties: { text: string } }) => block.properties.text);
    expect(texts).toEqual(["First", "Second", "Third"]);
  });

  it("returns blocks: [] for a note with no blocks", async () => {
    const app = makeApp();
    const user = await signedUp(app);
    const { id } = await seedNote(user.id, "Empty", [], "2026-01-01T10:00:00.000Z");

    const res = await getNote(app, id, user.cookie).expect(200);
    expect(res.body.blocks).toEqual([]);
  });

  it("returns 404 for another user's note, same as a missing one", async () => {
    const app = makeApp();
    const alice = await signedUp(app);
    const bob = await signedUp(app);
    const { id: aliceNote } = await seedNote(alice.id, "Alice's", ["secret"], "2026-01-01T10:00:00.000Z");

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
