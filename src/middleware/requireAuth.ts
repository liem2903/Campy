import type { RequestHandler, Response } from "express";
import { asyncHandler } from "../asyncHandler.js";
import { clearSessionCookie, SESSION_COOKIE, setSessionCookie } from "../controllers/sessionCookie.js";
import type { AuthUser } from "../db/types.js";
import * as authService from "../services/auth.service.js";

declare global {
  namespace Express {
    interface Request {
      // Set by requireAuth; always present in handlers mounted after it.
      user?: AuthUser;
    }
  }
}

function unauthorized(res: Response): void {
  res.status(401).json({ error: "Not authenticated" });
}

// Resolves the sid cookie to a user and sets req.user, or responds 401.
export function createRequireAuth(secureCookies: boolean): RequestHandler {
  return asyncHandler(async (req, res, next) => {
    // Responses behind auth are per-user: never let a browser or proxy cache them.
    res.set("Cache-Control", "no-store");
    const token: unknown = req.cookies?.[SESSION_COOKIE];
    if (typeof token !== "string" || token === "") {
      unauthorized(res);
      return;
    }
    const result = await authService.authenticate(token);
    if (!result) {
      // Expired, revoked or unknown: drop the cookie so the browser stops sending it.
      clearSessionCookie(res, secureCookies);
      unauthorized(res);
      return;
    }

    // The session's expiry slid forward: give the cookie a fresh max-age to match.
    if (result.refreshed) setSessionCookie(res, token, secureCookies);
    req.user = result.user;
    next();
  });
}
