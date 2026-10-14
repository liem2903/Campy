import cookieParser from "cookie-parser";
import express, { type NextFunction, type Request, type Response } from "express";
import path from "node:path";
import { requireJson } from "./middleware/requireJson.js";
import { authRoutes } from "./routes/auth.routes.js";
import { notesRoutes } from "./routes/notes.routes.js";

export type AppOptions = {
  secureCookies?: boolean;
  limits?: { signup?: number; loginEmail?: number; loginIp?: number };
};

const clientDist = path.resolve("client/dist");

export function createApp(options: AppOptions = {}) {
  const app = express();
  // Number of proxy hops to trust: 0 locally (unset), 1 on Railway.
  // Fail fast on a typo: NaN would silently trust no proxy and give every user one rate-limit bucket.
  const trustProxy = Number(process.env.TRUST_PROXY ?? 0);
  if (!Number.isInteger(trustProxy) || trustProxy < 0) {
    throw new Error(`TRUST_PROXY must be a whole number, got "${process.env.TRUST_PROXY}"`);
  }
  app.set("trust proxy", trustProxy);

  app.get(["/health", "/api/health"], (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api", requireJson, express.json(), cookieParser());
  app.use("/api/auth", authRoutes(options));
  app.use("/api/notes", notesRoutes(options));
  // Unknown API paths get JSON, not the SPA's index.html.
  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  // Serve the built React client; fall back to index.html for client-side routes.
  app.use(express.static(clientDist));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });

  // Last stop for anything thrown or passed to next(err): always answer in JSON.
  // Keep a 4xx the error already carries (e.g. malformed JSON); anything else is our fault.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const status = hasStatus(err) && err.status < 500 ? err.status : 500;
    if (status === 500) console.error(err);
    res.status(status).json({ error: status === 500 ? "Internal server error" : "Invalid request" });
  });
  return app;
}

function hasStatus(err: unknown): err is { status: number } {
  return typeof err === "object" && err !== null && "status" in err && typeof err.status === "number";
}
