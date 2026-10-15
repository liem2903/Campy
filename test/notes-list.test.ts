import { randomUUID } from "node:crypto";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { sql } from "../src/db/client.js";
import { makeApp, signedUp } from "./helpers.js";

type App = ReturnType<typeof makeApp>;

function listNotes(app: App, cookie?: string) {
  const req = request(app).get("/api/notes");
  return cookie ? req.set("Cookie", cookie) : req;
}

// Inserts a note straight into the DB with a chosen updated_at. The updated_at
// trigger only fires on UPDATE, so an INSERT keeps the value we pass.
async function seedNote(userId: string, title: string, updatedAt: string) {
  const id = randomUUID();
  await sql`
    insert into notes (id, user_id, title, updated_at)
    values (${id}, ${userId}, ${title}, ${updatedAt})
  `;
  return id;
}

const ids = (body: { id: string }[]) => body.map((note) => note.id);

describe("GET /api/notes", () => {
  it("rejects a request with no cookie", async () => {
    const res = await listNotes(makeApp());
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "You're not logged in" });
  });

  it("returns an empty list for a new user", async () => {
    const app = makeApp();
    const user = await signedUp(app);

    const res = await listNotes(app, user.cookie);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("returns only this user's notes", async () => {
    const app = makeApp();
    const alice = await signedUp(app);
    const bob = await signedUp(app);
    const aliceNote = await seedNote(alice.id, "Alice's", "2026-01-01T10:00:00.000Z");
    await seedNote(bob.id, "Bob's", "2026-01-01T11:00:00.000Z");

    const res = await listNotes(app, alice.cookie).expect(200);
    expect(ids(res.body)).toEqual([aliceNote]);
  });

  it("orders notes by updatedAt, newest first", async () => {
    const app = makeApp();
    const user = await signedUp(app);
    // Inserted so that neither insertion order nor its reverse matches the answer:
    // only a real sort on updated_at desc passes (not "no sort" or created_at).
    const b = await seedNote(user.id, "B", "2026-01-01T11:00:00.000Z");
    const c = await seedNote(user.id, "C", "2026-01-01T12:00:00.000Z");
    const a = await seedNote(user.id, "A", "2026-01-01T10:00:00.000Z");

    const res = await listNotes(app, user.cookie).expect(200);
    expect(ids(res.body)).toEqual([c, b, a]);
  });

  it("returns exactly id, title and updatedAt for each note", async () => {
    const app = makeApp();
    const user = await signedUp(app);
    const id = await seedNote(user.id, "Chem", "2026-01-01T10:00:00.000Z");

    const res = await listNotes(app, user.cookie).expect(200);
    expect(res.body).toEqual([{ id, title: "Chem", updatedAt: "2026-01-01T10:00:00.000Z" }]);
  });
});
