import { Router } from "express";
import type { Request } from "express";
import { ipKeyGenerator, rateLimit, type Options } from "express-rate-limit";
import { asyncHandler } from "../asyncHandler.js";
import { createAuthController } from "../controllers/auth.controller.js";
import { EMAIL_MAX_LENGTH, normalizeEmail } from "../controllers/validation.js";
import { createRequireAuth } from "../middleware/requireAuth.js";

const HOUR_MS = 60 * 60 * 1000;
const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;

export type AuthRouterConfig = {
  secureCookies: boolean;
  limits: { signupPerHour: number; loginPerIpEmail: number; loginPerIp: number };
};

function tooManyRequests(limit: number, windowMs: number, extra: Partial<Options> = {}) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Too many attempts. Try again later." },
    ...extra,
  });
}

// IP (grouped by /56 for IPv6) plus the submitted email, normalized like the lookup is.
// Truncated so a huge body can't bloat the in-memory store.
function ipAndEmailKey(req: Request): string {
  const email: unknown = (req.body as Record<string, unknown> | undefined)?.email;
  const normalized = typeof email === "string" ? normalizeEmail(email).slice(0, EMAIL_MAX_LENGTH) : "";
  return `${ipKeyGenerator(req.ip ?? "")}|${normalized}`;
}

// Wiring only: which middleware and controller method handle each path.
export function createAuthRouter(config: AuthRouterConfig): Router {
  const router = Router();
  const controller = createAuthController({ secureCookies: config.secureCookies });
  const requireAuth = createRequireAuth(config.secureCookies);

  router.post(
    "/signup",
    tooManyRequests(config.limits.signupPerHour, HOUR_MS),
    asyncHandler(controller.signup),
  );
  router.post(
    "/login",
    tooManyRequests(config.limits.loginPerIp, FIFTEEN_MINUTES_MS),
    // Only failures count here, so a user who logs in fine isn't locked out of their own account.
    tooManyRequests(config.limits.loginPerIpEmail, FIFTEEN_MINUTES_MS, {
      keyGenerator: ipAndEmailKey,
      skipSuccessfulRequests: true,
    }),
    asyncHandler(controller.login),
  );
  router.post("/logout", asyncHandler(controller.logout));
  router.get("/me", requireAuth, asyncHandler(controller.me));

  return router;
}
