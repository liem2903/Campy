import type { RequestHandler } from "express";
import * as authService from "../services/auth.service.js";
import { setSessionCookie } from "./sessionCookie.js";

export type RequireSessionOptions = { secureCookies: boolean };

// Factory: a sliding bump re-sends the sid cookie, which needs secureCookies.
export function requireSession({ secureCookies }: RequireSessionOptions): RequestHandler {
  return async (req, res, next) => {
    try {
      const token: unknown = req.cookies?.sid;
      const result = typeof token === "string" ? await authService.authenticate(token) : null;
      if (!result) {
        res.status(401).json({ error: "You're not logged in" });
        return;
      }
      req.user = result.user;
      if (result.bumped) setSessionCookie(res, token as string, secureCookies);
      next();
    } catch (err) {
      next(err); // Express 4 doesn't forward async rejections on its own
    }
  };
}
