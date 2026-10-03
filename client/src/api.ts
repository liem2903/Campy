export type User = { id: string; email: string }

// Creates the account and logs you in: the server sets the session cookie.
export async function signUp(_email: string, _password: string): Promise<User> {
  throw new Error('Not implemented')
}
