import { Router } from "express";
import type { AppOptions } from "../app.js";
import * as notes from "../controllers/notes.controller.js";
import { requireSession } from "../middleware/requireSession.js";

export function notesRoutes(options: AppOptions): Router {
  const router = Router();
  const secureCookies = options.secureCookies ?? true;

  // Every notes route is the logged-in user's data.
  router.use(requireSession({ secureCookies }));
  router.get("/", notes.list);
  router.post("/", notes.create);
  router.get("/:id", notes.get);
  return router;
}
