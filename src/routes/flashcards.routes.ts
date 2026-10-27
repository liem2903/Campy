import { Router } from "express";
import type { AppOptions } from "../app.js";
import * as flashcards from "../controllers/flashcards.controller.js";
import { requireSession } from "../middleware/requireSession.js";

export function flashcardsRoutes(options: AppOptions): Router {
  const router = Router();
  const secureCookies = options.secureCookies ?? true;

  // Every flashcards route is the logged-in user's data.
  router.use(requireSession({ secureCookies }));
  router.get("/", flashcards.getTodaysSession);
  router.post("/:questionId/grade", flashcards.gradeCard);
  return router;
}
