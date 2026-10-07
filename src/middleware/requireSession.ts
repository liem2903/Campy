import type { RequestHandler } from "express";

export type RequireSessionOptions = { secureCookies: boolean };

// Factory: a sliding bump re-sends the sid cookie, which needs secureCookies.
export function requireSession({ secureCookies }: RequireSessionOptions): RequestHandler {
  return (_req, _res, _next) => {
    throw new Error("Not implemented");
  };
}
