import type { CookieOptions, Response } from "express";
import { sessionTtlMs } from "../services/auth.service.js";

// One place for the sid cookie's options: signup sets it, a sliding bump re-sets it,
// a dead session clears it.
function cookieOptions(secureCookies: boolean): CookieOptions {
  return { httpOnly: true, secure: secureCookies, sameSite: "lax", path: "/" };
}

export function setSessionCookie(res: Response, token: string, secureCookies: boolean): void {
  res.cookie("sid", token, { ...cookieOptions(secureCookies), maxAge: sessionTtlMs });
}

// No maxAge here: in Express 4 it would override clearCookie's expiry in the past.
export function clearSessionCookie(res: Response, secureCookies: boolean): void {
  res.clearCookie("sid", cookieOptions(secureCookies));
}
