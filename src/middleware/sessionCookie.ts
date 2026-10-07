import type { Response } from "express";
import { sessionTtlMs } from "../services/auth.service.js";

// One place for the sid cookie's options: signup sets it, a sliding bump re-sets it.
export function setSessionCookie(res: Response, token: string, secureCookies: boolean): void {
  res.cookie("sid", token, {
    httpOnly: true, secure: secureCookies, sameSite: "lax", path: "/", maxAge: sessionTtlMs,
  });
}
