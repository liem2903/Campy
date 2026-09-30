import request from "supertest";
import { hashToken } from "../src/services/sessionToken.js";
import { deleteTestUsers, signUp, sql, testApp, validPassword } from "./helpers.js";

afterAll(async () => {
  await deleteTestUsers();
  await sql.end();
});

const app = testApp();

function setCookies(res: request.Response): string[] {
  return (res.headers["set-cookie"] as unknown as string[] | undefined) ?? [];
}

// Must match the attributes the cookie was set with, or browsers keep it.
function clearsSid(res: request.Response): boolean {
  return setCookies(res).some(
    (c) =>
      /^sid=;/.test(c) &&
      c.includes("Expires=Thu, 01 Jan 1970") &&
      c.includes("Path=/") &&
      c.includes("HttpOnly") &&
      c.includes("SameSite=Lax"),
  );
}

describe("POST /api/auth/logout", () => {
  it("ends the session: the old cookie then gets 401 on /me", async () => {
    const { cookie } = await signUp(app);
    await request(app).get("/api/auth/me").set("Cookie", cookie).expect(200);

    await request(app).post("/api/auth/logout").set("Cookie", cookie).send({}).expect(204);

    await request(app).get("/api/auth/me").set("Cookie", cookie).expect(401);
    const [row] = await sql<{ revoked_at: Date | null }[]>`
      select revoked_at from sessions
      where token_hash = ${hashToken(decodeURIComponent(cookie.slice("sid=".length)))}
    `;
    expect(row.revoked_at).toBeInstanceOf(Date);
  });

  it("clears the sid cookie and is not cacheable", async () => {
    const { cookie } = await signUp(app);
    const res = await request(app).post("/api/auth/logout").set("Cookie", cookie).send({}).expect(204);
    expect(clearsSid(res)).toBe(true);
    expect(res.headers["cache-control"]).toBe("no-store");
  });

  it("only ends the current session, not the user's other ones", async () => {
    const user = await signUp(app);
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: user.email, password: validPassword })
      .expect(200);
    const otherDevice = setCookies(login).find((c) => c.startsWith("sid="))!.split(";")[0];

    await request(app).post("/api/auth/logout").set("Cookie", user.cookie).send({}).expect(204);

    await request(app).get("/api/auth/me").set("Cookie", otherDevice).expect(200);
  });

  it("returns 204 with no cookie, a garbage cookie, or when repeated", async () => {
    const noCookie = await request(app).post("/api/auth/logout").send({}).expect(204);
    expect(clearsSid(noCookie)).toBe(true);
    const garbage = await request(app)
      .post("/api/auth/logout")
      .set("Cookie", "sid=garbage")
      .send({})
      .expect(204);
    expect(clearsSid(garbage)).toBe(true);

    const { cookie } = await signUp(app);
    await request(app).post("/api/auth/logout").set("Cookie", cookie).send({}).expect(204);
    await request(app).post("/api/auth/logout").set("Cookie", cookie).send({}).expect(204);
  });

  it("rejects a request without a JSON Content-Type with 415", async () => {
    const { cookie } = await signUp(app);
    await request(app).post("/api/auth/logout").set("Cookie", cookie).expect(415);
    // The session survives a rejected (e.g. cross-site form) logout.
    await request(app).get("/api/auth/me").set("Cookie", cookie).expect(200);
  });
});

describe("logging in over an existing session", () => {
  it("revokes the session the browser was holding", async () => {
    const first = await signUp(app);
    const second = await signUp(app);

    // Same browser: first's cookie is still set when second logs in.
    await request(app)
      .post("/api/auth/login")
      .set("Cookie", first.cookie)
      .send({ email: second.email, password: validPassword })
      .expect(200);

    await request(app).get("/api/auth/me").set("Cookie", first.cookie).expect(401);
  });
});
