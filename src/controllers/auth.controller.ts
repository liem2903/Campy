import type { Request, Response } from "express";

export type AuthControllerOptions = { secureCookies: boolean };

export function authController(_options: AuthControllerOptions) {
  return {
    signUp(_req: Request, _res: Response): void {
      throw new Error("Not implemented");
    },
  };
}
