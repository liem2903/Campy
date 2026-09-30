import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { asyncHandler } from "../asyncHandler.js";
import { createAuthController } from "../controllers/auth.controller.js";
import { createRequireAuth } from "../middleware/requireAuth.js";

const HOUR_MS = 60 * 60 * 1000;

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
  router.get("/me", requireAuth, asyncHandler(controller.me));

  return router;
}
