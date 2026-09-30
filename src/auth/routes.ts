import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import postgres from "postgres";
import { asyncHandler } from "../asyncHandler.js";
import { sql } from "../db/client.js";
import type { User } from "../db/types.js";
import { hashPassword } from "./password.js";
import { insertSession, setSessionCookie } from "./sessions.js";
import { parseCredentials } from "./validation.js";

const HOUR_MS = 60 * 60 * 1000;
const UNIQUE_VIOLATION = "23505";
const USERS_EMAIL_CONSTRAINT = "users_email_key";

export type AuthRouterConfig = {
  secureCookies: boolean;
  limits: { signupPerHour: number };
};

function tooManyRequests(limit: number, windowMs: number) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Too many attempts. Try again later." },
  });
}

export function createAuthRouter(config: AuthRouterConfig): Router {
  const router = Router();
  const signupLimiter = tooManyRequests(config.limits.signupPerHour, HOUR_MS);

  router.post(
    "/signup",
    signupLimiter,
    asyncHandler(async (req, res) => {
      const parsed = parseCredentials(req.body);
      if (!parsed.ok) {
        res.status(400).json({ error: parsed.error });
        return;
      }
      const { email, password } = parsed.value;
      const passwordHash = await hashPassword(password);

      let result: { user: Pick<User, "id" | "email">; token: string };
      try {
        // One transaction: never leave an account behind without its first session.
        result = await sql.begin(async (tx) => {
          const [user] = await tx<Pick<User, "id" | "email">[]>`
            insert into users (email, password_hash)
            values (${email}, ${passwordHash})
            returning id, email
          `;
          const token = await insertSession(tx, user.id);
          return { user, token };
        });
      } catch (err) {
        if (
          err instanceof postgres.PostgresError &&
          err.code === UNIQUE_VIOLATION &&
          err.constraint_name === USERS_EMAIL_CONSTRAINT
        ) {
          res.status(409).json({ error: "An account with that email already exists" });
          return;
        }
        throw err;
      }

      setSessionCookie(res, result.token, config.secureCookies);
      res.status(201).json({ id: result.user.id, email: result.user.email });
    }),
  );

  return router;
}
