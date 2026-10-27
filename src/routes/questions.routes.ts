import { Router } from "express";
import type { AppOptions } from "../app.js";
import * as questions from "../controllers/questions.controller.js";
import { requireSession } from "../middleware/requireSession.js";

// Routes for one question by its id. Listing and adding live under /api/notes/:id/questions.
export function questionsRoutes(options: AppOptions): Router {
  const router = Router();
  const secureCookies = options.secureCookies ?? true;

  // Every questions route is the logged-in user's data.
  router.use(requireSession({ secureCookies }));
  router.put("/:questionId", questions.update);
  router.delete("/:questionId", questions.remove);
  return router;
}
