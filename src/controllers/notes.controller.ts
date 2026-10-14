import type { NextFunction, Request, Response } from "express";

// POST /api/notes { id }: creates the note under the client's id.
export function create(_req: Request, _res: Response, _next: NextFunction): void {
  throw new Error("Not implemented");
}
