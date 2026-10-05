import type { User } from "../db/types.js";

export type SignUpResult = { user: Pick<User, "id" | "email">; token: string };

// Creates the user and a session. Throws EmailTakenError if the email is in use.
export async function signUp(_email: string, _password: string): Promise<SignUpResult> {
  throw new Error("Not implemented");
}
