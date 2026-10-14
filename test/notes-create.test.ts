import { randomUUID } from "node:crypto";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { sql } from "../src/db/client.js";
import { makeApp, signedUp } from "./helpers.js";

type App = ReturnType<typeof makeApp>;

function createNote(app: App, body: object, cookie?: string) {
  const req = request(app).post("/api/notes");
  return (cookie ? req.set("Cookie", cookie) : req).send(body);
}

// The rows stored under a note id, read straight from the DB.
async function rowsFor(noteId: string) {
  const notes = await sql<{ user_id: string; title: string; updated_at: Date }[]>`
    select user_id, title, updated_at from notes where id = ${noteId}
  `;
  const blocks = await sql<{ parent_id: string | null; position: string; type: string; properties: unknown }[]>`
    select parent_id, position, type, properties from blocks where note_id = ${noteId}
  `;
  return { notes, blocks };
}

describe("POST /api/notes", () => {
  it("rejects a request with no cookie", async () => {
    const res = await createNote(makeApp(), { id: randomUUID() });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "You're not logged in" });
  });

  it("creates an empty note", async () => {
    const app = makeApp();
    const user = await signedUp(app);
    const id = randomUUID();

    const res = await createNote(app, { id }, user.cookie);
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ id, title: "", body: "", updatedAt: expect.any(String) });
    expect(new Date(res.body.updatedAt).toISOString()).toBe(res.body.updatedAt);
  });

  it("stores one note owned by the user and one empty top-level text block", async () => {
    const app = makeApp();
    const user = await signedUp(app);
    const id = randomUUID();

    await createNote(app, { id }, user.cookie).expect(201);
    const { notes, blocks } = await rowsFor(id);
    expect(notes).toEqual([{ user_id: user.id, title: "", updated_at: expect.any(Date) }]);
    expect(blocks).toEqual([{ parent_id: null, position: "a0", type: "text", properties: { text: "" } }]);
  });

  it("returns the same note when the same user retries the id", async () => {
    const app = makeApp();
    const user = await signedUp(app);
    const id = randomUUID();

    const first = await createNote(app, { id }, user.cookie).expect(201);
    const retry = await createNote(app, { id }, user.cookie);
    expect(retry.status).toBe(200);
    expect(retry.body).toEqual(first.body);
    const { notes, blocks } = await rowsFor(id);
    expect(notes).toHaveLength(1);
    expect(blocks).toHaveLength(1);
  });

  it("handles two simultaneous creates of one id by the same user", async () => {
    const app = makeApp();
    const user = await signedUp(app);
    const id = randomUUID();

    const [a, b] = await Promise.all([
      createNote(app, { id }, user.cookie),
      createNote(app, { id }, user.cookie),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 201]);
    expect(a.body).toEqual(b.body);
    const { notes, blocks } = await rowsFor(id);
    expect(notes).toHaveLength(1);
    expect(blocks).toHaveLength(1);
  });

  it("rejects an id another user already owns with 409", async () => {
    const app = makeApp();
    const owner = await signedUp(app);
    const other = await signedUp(app);
    const id = randomUUID();
    await createNote(app, { id }, owner.cookie).expect(201);
    const before = await rowsFor(id);

    const res = await createNote(app, { id }, other.cookie);
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: "That note id is already taken" });
    expect(await rowsFor(id)).toEqual(before);
  });

  it.each([
    ["missing", {}],
    ["not a string", { id: 123 }],
    ["not a UUID", { id: "not-a-uuid" }],
    ["uppercase", { id: randomUUID().toUpperCase() }],
  ])("rejects an id that is %s with 400", async (_, body) => {
    const app = makeApp();
    const user = await signedUp(app);

    const res = await createNote(app, body, user.cookie);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Invalid note id" });
  });

  it("rejects a non-JSON body with 415", async () => {
    const app = makeApp();
    const user = await signedUp(app);

    const res = await request(app)
      .post("/api/notes")
      .set("Cookie", user.cookie)
      .type("form")
      .send(`id=${randomUUID()}`);
    expect(res.status).toBe(415);
    expect(res.body).toEqual({ error: "Requests must be sent as JSON" });
  });
});
