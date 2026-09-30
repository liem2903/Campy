import type { CookieOptions, Response } from "express";
import { SESSION_TTL_MS } from "../services/sessionToken.js";

export const SESSION_COOKIE = "sid";

// clearCookie must match these attributes (minus maxAge) or the browser keeps the cookie.
function baseCookieOptions(secure: boolean): CookieOptions {
  return { httpOnly: true, secure, sameSite: "lax", path: "/" };
}

export function sessionCookieOptions(secure: boolean): CookieOptions {
  return { ...baseCookieOptions(secure), maxAge: SESSION_TTL_MS };
}

export function setSessionCookie(res: Response, token: string, secure: boolean): void {
  res.cookie(SESSION_COOKIE, token, sessionCookieOptions(secure));
}

export function clearSessionCookie(res: Response, secure: boolean): void {
  res.clearCookie(SESSION_COOKIE, baseCookieOptions(secure));
}
