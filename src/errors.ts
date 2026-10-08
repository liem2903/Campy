// Domain errors: thrown by services, mapped to HTTP statuses by controllers.

export class EmailTakenError extends Error {
  constructor() {
    super("An account with that email already exists");
    this.name = "EmailTakenError";
  }
}

// Deliberately vague: never reveal whether the email or the password was wrong.
export class InvalidCredentialsError extends Error {
  constructor() {
    super("Invalid email or password");
    this.name = "InvalidCredentialsError";
  }
}
