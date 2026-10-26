import { Router } from "express";
import type { AppOptions } from "../app.js";
import * as tags from "../controllers/tags.controller.js";
import { requireSession } from "../middleware/requireSession.js";

export function tagsRoutes(options: AppOptions): Router {
  const router = Router();
  const secureCookies = options.secureCookies ?? true;

  // Every tags route is the logged-in user's data.
  router.use(requireSession({ secureCookies }));
  router.get("/", tags.list);
  router.post("/", tags.create);
  router.patch("/:tagId", tags.rename);
  router.delete("/:tagId", tags.remove);
  return router;
}
