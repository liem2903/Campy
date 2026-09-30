import type { Request, Response } from "express";
import { EmailTakenError, InvalidCredentialsError } from "../errors.js";
import * as authService from "../services/auth.service.js";
import { setSessionCookie } from "./sessionCookie.js";
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
        const { user, token } = await authService.logIn(parsed.value);
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
