import type { NextFunction, Request, Response } from "express";
import { EmailTakenError } from "../errors.js";
import * as authService from "../services/auth.service.js";

export type AuthControllerOptions = { secureCookies: boolean };

const thirtyDays = 30 * 24 * 60 * 60 * 1000;
// Deliberately loose: something@something.something, no spaces.
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function authController({ secureCookies }: AuthControllerOptions) {
  return {
    async signUp(req: Request, res: Response, next: NextFunction): Promise<void> {
      const { email, password } = req.body as { email?: unknown; password?: unknown };
      const trimmed = typeof email === "string" ? email.trim() : "";
      if (trimmed.length > 254 || !emailPattern.test(trimmed)) {
        res.status(400).json({ error: "That email isn't valid" });
        return;
      }
      if (typeof password !== "string" || password.length < 8 || password.length > 128) {
        res.status(400).json({ error: "Password must be 8–128 characters" });
        return;
      }

      try {
        const { user, token } = await authService.signUp(trimmed, password);
        res.cookie("sid", token, {
          httpOnly: true, secure: secureCookies, sameSite: "lax", path: "/", maxAge: thirtyDays,
        });
        res.status(201).json(user);
      } catch (err) {
        if (err instanceof EmailTakenError) {
          res.status(409).json({ error: err.message });
          return;
        }
        next(err); // unexpected → the JSON error handler in app.ts
      }
    },
  };
}
