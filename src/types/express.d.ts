import type { User } from "../db/types.js";

// Set by requireSession on protected routes.
declare global {
  namespace Express {
    interface Request { user?: Pick<User, "id" | "email"> }
  }
}
