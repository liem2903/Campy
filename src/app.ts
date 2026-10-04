import express from "express";
import path from "node:path";
import { requireJson } from "./middleware/requireJson.js";
import { authRoutes } from "./routes/auth.routes.js";

export type AppOptions = {
  secureCookies?: boolean;
  limits?: { signup?: number };
};

const clientDist = path.resolve("client/dist");

export function createApp(options: AppOptions = {}) {
  const app = express();
  // Number of proxy hops to trust: 0 locally (unset), 1 on Railway.
  app.set("trust proxy", Number(process.env.TRUST_PROXY ?? 0));

  app.get(["/health", "/api/health"], (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api", requireJson, express.json());
  app.use("/api/auth", authRoutes(options));
  // Unknown API paths get JSON, not the SPA's index.html.
  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  // Serve the built React client; fall back to index.html for client-side routes.
  app.use(express.static(clientDist));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
  return app;
}
