import request from "supertest";
import { createApp } from "../src/app.js";
import { deleteTestUsers, sql, testApp, uniqueEmail, validPassword } from "./helpers.js";

afterAll(async () => {
  await deleteTestUsers();
  await sql.end();
});

function setCookieHeader(res: request.Response): string {
  const header = res.headers["set-cookie"] as unknown as string[] | undefined;
  return header?.find((c) => c.startsWith("sid=")) ?? "";
}

describe("POST /api/auth/signup", () => {
  it("creates the user and sets a secure session cookie", async () => {
    const email = uniqueEmail();
    const res = await request(createApp()) // default options: Secure on
      .post("/api/auth/signup")
      .send({ email, password: validPassword });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ id: expect.any(String), email });
    const cookie = setCookieHeader(res);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/Secure/);
    expect(cookie).toMatch(/SameSite=Lax/);

    const sessions = await sql`select 1 from sessions where user_id = ${res.body.id}`;
    expect(sessions).toHaveLength(1);
  });

  it("stores an argon2id hash, never the raw password", async () => {
    const email = uniqueEmail();
    await request(testApp())
      .post("/api/auth/signup")
      .send({ email, password: validPassword })
      .expect(201);

    const [user] = await sql<{ password_hash: string }[]>`
      select password_hash from users where email = ${email}
    `;
    expect(user.password_hash.startsWith("$argon2id$")).toBe(true);
    expect(user.password_hash).not.toContain(validPassword);
  });

  it("rejects a taken email, including a different case, with 409", async () => {
    const app = testApp();
    const email = uniqueEmail();
    await request(app).post("/api/auth/signup").send({ email, password: validPassword }).expect(201);

    await request(app).post("/api/auth/signup").send({ email, password: validPassword }).expect(409);
    await request(app)
      .post("/api/auth/signup")
      .send({ email: email.toUpperCase(), password: validPassword })
      .expect(409);
  });

  it("rejects an invalid email or a 7-character password with 400", async () => {
    const app = testApp();
    await request(app)
      .post("/api/auth/signup")
      .send({ email: "not-an-email", password: validPassword })
      .expect(400);
    await request(app)
      .post("/api/auth/signup")
      .send({ email: uniqueEmail(), password: "1234567" })
      .expect(400);
    await request(app).post("/api/auth/signup").send({}).expect(400);
  });

  it("accepts a 128-character password and rejects 129", async () => {
    const app = testApp();
    await request(app)
      .post("/api/auth/signup")
      .send({ email: uniqueEmail(), password: "a".repeat(128) })
      .expect(201);
    await request(app)
      .post("/api/auth/signup")
      .send({ email: uniqueEmail(), password: "a".repeat(129) })
      .expect(400);
  });

  it("stores the email trimmed and lowercased", async () => {
    const email = uniqueEmail();
    const res = await request(testApp())
      .post("/api/auth/signup")
      .send({ email: `  ${email.toUpperCase()} `, password: validPassword })
      .expect(201);
    expect(res.body.email).toBe(email);
  });

  it("rejects a non-JSON body with 415", async () => {
    await request(testApp())
      .post("/api/auth/signup")
      .type("form")
      .send({ email: uniqueEmail(), password: validPassword })
      .expect(415);
  });

  it("returns 429 on the 6th signup from one IP within an hour", async () => {
    const app = createApp({ secureCookies: false }); // real limits
    for (let i = 0; i < 5; i++) {
      await request(app)
        .post("/api/auth/signup")
        .send({ email: uniqueEmail(), password: validPassword })
        .expect(201);
    }
    await request(app)
      .post("/api/auth/signup")
      .send({ email: uniqueEmail(), password: validPassword })
      .expect(429);
  });
});

describe("unknown API routes", () => {
  it("return 404 JSON instead of the SPA", async () => {
    const res = await request(testApp()).get("/api/does-not-exist");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Not found" });
  });
});
