import { Router } from "express";
import type { AppOptions } from "../app.js";
import * as notes from "../controllers/notes.controller.js";
import * as tags from "../controllers/tags.controller.js";
import { requireSession } from "../middleware/requireSession.js";

export function notesRoutes(options: AppOptions): Router {
  const router = Router();
  const secureCookies = options.secureCookies ?? true;

  // Every notes route is the logged-in user's data.
  router.use(requireSession({ secureCookies }));
  router.get("/", notes.list);
  router.post("/", notes.create);
  router.get("/:id", notes.get);
  router.put("/:id", notes.update);
  router.delete("/:id", notes.remove);
  router.post("/:id/tags", tags.addToNote);
  router.delete("/:id/tags/:tagId", tags.removeFromNote);
  return router;
}
