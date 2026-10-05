import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("error handler", () => {
  it("answers malformed JSON with a JSON 400, not Express's HTML page", async () => {
    const res = await request(createApp())
      .post("/api/auth/signup")
      .set("Content-Type", "application/json")
      .send('{"email": ');

    expect(res.status).toBe(400);
    expect(res.type).toBe("application/json");
    expect(res.body).toEqual({ error: "Invalid request" });
  });
});

describe("TRUST_PROXY", () => {
  it("accepts a whole number", () => {
    vi.stubEnv("TRUST_PROXY", "1");
    expect(() => createApp()).not.toThrow();
  });

  it("refuses to start on a value that isn't a whole number", () => {
    vi.stubEnv("TRUST_PROXY", "true");
    expect(() => createApp()).toThrow(/TRUST_PROXY/);
  });
});
