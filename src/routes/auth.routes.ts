import { Router } from "express";
import type { AppOptions } from "../app.js";
import { authController } from "../controllers/auth.controller.js";
import { signupLimiter } from "../middleware/rateLimiters.js";

export function authRoutes(options: AppOptions): Router {
  const router = Router();
  const auth = authController({ secureCookies: options.secureCookies ?? true });

  router.post("/signup", signupLimiter(options.limits?.signup), auth.signUp);
  return router;
}
