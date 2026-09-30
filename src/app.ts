import cookieParser from "cookie-parser";
import express, {
  type ErrorRequestHandler,
  type Express,
  type RequestHandler,
} from "express";
import path from "node:path";
import { createAuthRouter } from "./auth/routes.js";

export type AppOptions = {
  // Off in tests: Supertest won't send Secure cookies back over plain http.
  secureCookies?: boolean;
  // Tests raise these so only the dedicated 429 tests hit the real limits.
  rateLimits?: { signupPerHour?: number };
};

const clientDist = path.resolve("client/dist");
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// CSRF defence alongside SameSite=Lax: a cross-site HTML form can't send application/json.
const requireJson: RequestHandler = (req, res, next) => {
  const contentType = (req.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (MUTATING_METHODS.has(req.method) && contentType !== "application/json") {
    res.status(415).json({ error: "Content-Type must be application/json" });
    return;
  }
  next();
};

// Unset locally; "1" on Railway (one proxy hop) so req.ip is the client's IP.
function trustProxySetting(value: string | undefined): boolean | number | string {
  if (!value) return false;
  return /^\d+$/.test(value) ? Number(value) : value;
}

const CLIENT_ERROR_MESSAGES: Record<number, string> = {
  404: "Not found",
  413: "Request body too large",
  415: "Unsupported media type",
};

function errorStatus(err: unknown): number {
  if (typeof err === "object" && err !== null) {
    const status = (err as { status?: unknown; statusCode?: unknown }).status ??
      (err as { statusCode?: unknown }).statusCode;
    if (typeof status === "number" && status >= 400 && status < 600) return status;
  }
  return 500;
}

const errorHandler: ErrorRequestHandler = (err: unknown, _req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }
  const status = errorStatus(err);
  if (status >= 500) {
    console.error(err);
    res.status(status).json({ error: "Internal server error" });
    return;
  }
  // e.g. body-parser's 400 for malformed JSON or 413 for an oversized body.
  res.status(status).json({ error: CLIENT_ERROR_MESSAGES[status] ?? "Bad request" });
};

export function createApp(options: AppOptions = {}): Express {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", trustProxySetting(process.env.TRUST_PROXY));

  app.get(["/health", "/api/health"], (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api", requireJson, express.json({ limit: "100kb" }), cookieParser());
  app.use(
    "/api/auth",
    createAuthRouter({
      secureCookies: options.secureCookies ?? true,
      limits: { signupPerHour: options.rateLimits?.signupPerHour ?? 5 },
    }),
  );
  // Unknown API routes get JSON, not the SPA's index.html.
  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  // Serve the built React client; fall back to index.html for client-side routes.
  app.use(express.static(clientDist));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"), (err) => {
      if (err && !res.headersSent) {
        // Usually means the client hasn't been built (npm run build:client).
        res.status(404).type("text").send("Client build not found. Run npm run build:client.");
      }
    });
  });

  app.use(errorHandler);
  return app;
}
