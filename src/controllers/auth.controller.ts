import type { Request, Response } from "express";
import { EmailTakenError, InvalidCredentialsError } from "../errors.js";
import * as authService from "../services/auth.service.js";
import { clearSessionCookie, readSessionToken, setSessionCookie } from "./sessionCookie.js";
import { parseCredentials, parseLoginCredentials } from "./validation.js";

export type AuthControllerConfig = { secureCookies: boolean };

export function createAuthController(config: AuthControllerConfig) {
  return {
    async signup(req: Request, res: Response): Promise<void> {
      const parsed = parseCredentials(req.body);
      if (!parsed.ok) {
        res.status(400).json({ error: parsed.error });
        return;
      }

      try {
        const { user, token } = await authService.signUp(parsed.value);
        res.set("Cache-Control", "no-store");
        setSessionCookie(res, token, config.secureCookies);
        res.status(201).json(user);
      } catch (err) {
        if (err instanceof EmailTakenError) {
          res.status(409).json({ error: err.message });
          return;
        }
        throw err;
      }
    },

    async login(req: Request, res: Response): Promise<void> {
      const parsed = parseLoginCredentials(req.body);
      if (!parsed.ok) {
        res.status(400).json({ error: parsed.error });
        return;
      }

      try {
        const { user, token } = await authService.logIn(parsed.value, readSessionToken(req));
        res.set("Cache-Control", "no-store");
        setSessionCookie(res, token, config.secureCookies);
        res.json(user);
      } catch (err) {
        if (err instanceof InvalidCredentialsError) {
          res.status(401).json({ error: err.message });
          return;
        }
        throw err;
      }
    },

    // Idempotent: 204 whether or not there was a live session, so a retry or a second tab
    // never shows an error. Not behind requireAuth for the same reason.
    async logout(req: Request, res: Response): Promise<void> {
      // Headers first: if revoking fails, the 500 still carries them, so the browser drops
      // the cookie even though the session row lives on until it expires.
      res.set("Cache-Control", "no-store");
      clearSessionCookie(res, config.secureCookies);
      const token = readSessionToken(req);
      if (token) await authService.logOut(token);
      res.status(204).end();
    },

    // Mounted after requireAuth; the check guards against wiring it up without it.
    async me(req: Request, res: Response): Promise<void> {
      if (!req.user) {
        res.status(401).json({ error: "Not authenticated" });
        return;
      }
      res.json(req.user);
    },
  };
}
