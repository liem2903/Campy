import { Router } from "express";
import type { AppOptions } from "../app.js";
import { authController } from "../controllers/auth.controller.js";
import { loginEmailLimiter, loginIpLimiter, signupLimiter } from "../middleware/rateLimiters.js";
import { requireSession } from "../middleware/requireSession.js";

export function authRoutes(options: AppOptions): Router {
  const router = Router();
  const secureCookies = options.secureCookies ?? true;
  const auth = authController({ secureCookies });

  router.post("/signup", signupLimiter(options.limits?.signup), auth.signUp);
  router.post(
    "/login",
    loginIpLimiter(options.limits?.loginIp),
    loginEmailLimiter(options.limits?.loginEmail),
    auth.logIn,
  );
  router.get("/me", requireSession({ secureCookies }), auth.me);
  return router;
}
