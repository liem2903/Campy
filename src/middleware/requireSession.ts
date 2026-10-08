import type { RequestHandler } from "express";
import * as authService from "../services/auth.service.js";
import { clearSessionCookie, setSessionCookie } from "./sessionCookie.js";

export type RequireSessionOptions = { secureCookies: boolean };

// Factory: a sliding bump re-sends the sid cookie, which needs secureCookies.
export function requireSession({ secureCookies }: RequireSessionOptions): RequestHandler {
  return async (req, res, next) => {
    try {
      const token: unknown = req.cookies?.sid;
      if (typeof token !== "string") {
        res.status(401).json({ error: "You're not logged in" });
        return;
      }
      const result = await authService.authenticate(token);
      if (!result) {
        clearSessionCookie(res, secureCookies); // stop the browser re-sending a dead token
        res.status(401).json({ error: "You're not logged in" });
        return;
      }
      req.user = result.user;
      if (result.bumped) setSessionCookie(res, token, secureCookies); // no cast: narrowed above
      res.set("Cache-Control", "no-store"); // everything past here is this user's data
      next();
    } catch (err) {
      next(err); // Express 4 doesn't forward async rejections on its own
    }
  };
}
