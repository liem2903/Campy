import request from "supertest";
import { hashToken } from "../src/services/sessionToken.js";
import { deleteTestUsers, signUp, sql, testApp, uniqueEmail, validPassword } from "./helpers.js";

afterAll(async () => {
  await deleteTestUsers();
  await sql.end();
});

const app = testApp();

function sidCookie(res: request.Response): string {
  const header = res.headers["set-cookie"] as unknown as string[] | undefined;
  return header?.find((c) => c.startsWith("sid="))?.split(";")[0] ?? "";
}

describe("POST /api/auth/login", () => {
  it("logs in with the right password and sets a cookie that works on /me", async () => {
    const user = await signUp(app);
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: user.email, password: validPassword })
      .expect(200);

    expect(res.body).toEqual({ id: user.id, email: user.email });
    expect(res.headers["cache-control"]).toBe("no-store");
    const cookie = sidCookie(res);
    expect(cookie).not.toBe("");
    expect(cookie).not.toBe(user.cookie); // a new session, not the signup one
    const me = await request(app).get("/api/auth/me").set("Cookie", cookie).expect(200);
    expect(me.body).toEqual({ id: user.id, email: user.email });
  });

  it("gives a wrong password and an unknown email the same 401 body", async () => {
    const user = await signUp(app);
    const wrongPassword = await request(app)
      .post("/api/auth/login")
      .send({ email: user.email, password: "not the password" })
      .expect(401);
    const unknownEmail = await request(app)
      .post("/api/auth/login")
      .send({ email: uniqueEmail(), password: validPassword })
      .expect(401);

    expect(wrongPassword.body).toEqual({ error: "Invalid email or password" });
    expect(unknownEmail.body).toEqual(wrongPassword.body);
    expect(sidCookie(wrongPassword)).toBe("");
    expect(sidCookie(unknownEmail)).toBe("");
  });

  it("matches the email case-insensitively and ignores surrounding spaces", async () => {
    const user = await signUp(app);
    await request(app)
      .post("/api/auth/login")
      .send({ email: `  ${user.email.toUpperCase()} `, password: validPassword })
      .expect(200);
  });

  it("rejects an over-long password with the same 401", async () => {
    const user = await signUp(app);
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: user.email, password: "a".repeat(129) })
      .expect(401);
    expect(res.body).toEqual({ error: "Invalid email or password" });
  });

  it("returns 400 when the email or password is missing", async () => {
    await request(app).post("/api/auth/login").send({}).expect(400);
    await request(app).post("/api/auth/login").send({ email: uniqueEmail() }).expect(400);
    await request(app).post("/api/auth/login").send({ email: "", password: "" }).expect(400);
    await request(app).post("/api/auth/login").send({ email: "   ", password: "x" }).expect(400);
    await request(app).post("/api/auth/login").send({ email: 1, password: [] }).expect(400);
    await request(app).post("/api/auth/login").send([]).expect(400);
    await request(app)
      .post("/api/auth/login")
      .send({ email: `${"a".repeat(250)}@example.com`, password: validPassword })
      .expect(400);
  });

  it("rejects a non-JSON body with 415", async () => {
    await request(app)
      .post("/api/auth/login")
      .type("form")
      .send({ email: uniqueEmail(), password: validPassword })
      .expect(415);
  });

  it("deletes the user's expired and revoked sessions, keeping live ones", async () => {
    const user = await signUp(app);
    const [live, expired, revoked] = ["live", "expired", "revoked"].map((name) =>
      hashToken(`${user.id}-${name}`),
    );
    await sql`
      insert into sessions (user_id, token_hash, expires_at, revoked_at) values
        (${user.id}, ${live}, now() + interval '1 day', null),
        (${user.id}, ${expired}, now() - interval '1 second', null),
        (${user.id}, ${revoked}, now() + interval '1 day', now())
    `;

    await request(app)
      .post("/api/auth/login")
      .send({ email: user.email, password: validPassword })
      .expect(200);

    const rows = await sql<{ token_hash: string }[]>`
      select token_hash from sessions where user_id = ${user.id}
    `;
    const hashes = rows.map((r) => r.token_hash);
    expect(hashes).toContain(live);
    expect(hashes).not.toContain(expired);
    expect(hashes).not.toContain(revoked);
    expect(hashes).toHaveLength(3); // signup + live + the new login session
  });
});

describe("login rate limits", () => {
  it("returns 429 on the 6th bad attempt for one email within 15 minutes", async () => {
    const limited = testApp({ rateLimits: { signupPerHour: 1000, loginPerIp: 1000 } });
    const user = await signUp(limited);
    for (let i = 0; i < 5; i++) {
      await request(limited)
        .post("/api/auth/login")
        .send({ email: user.email, password: "wrong password" })
        .expect(401);
    }
    // Different case, same account: must share the counter.
    await request(limited)
      .post("/api/auth/login")
      .send({ email: user.email.toUpperCase(), password: validPassword })
      .expect(429);
    // Another email from the same IP is unaffected.
    const other = await signUp(limited);
    await request(limited)
      .post("/api/auth/login")
      .send({ email: other.email, password: validPassword })
      .expect(200);
  });

  it("does not count successful logins towards the per-email limit", async () => {
    const limited = testApp({ rateLimits: { signupPerHour: 1000, loginPerIp: 1000 } });
    const user = await signUp(limited);
    for (let i = 0; i < 6; i++) {
      await request(limited)
        .post("/api/auth/login")
        .send({ email: user.email, password: validPassword })
        .expect(200);
    }
  });

  it("returns 429 on the 21st attempt from one IP within 15 minutes", async () => {
    const limited = testApp({ rateLimits: { signupPerHour: 1000, loginPerIpEmail: 1000 } });
    for (let i = 0; i < 20; i++) {
      await request(limited)
        .post("/api/auth/login")
        .send({ email: uniqueEmail(), password: validPassword })
        .expect(401);
    }
    await request(limited)
      .post("/api/auth/login")
      .send({ email: uniqueEmail(), password: validPassword })
      .expect(429);
  });
});
