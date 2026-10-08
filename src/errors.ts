// Domain errors: services throw these, controllers map them to status codes.
export class EmailTakenError extends Error {
  constructor() {
    super("An account with this email already exists");
  }
}

// Wrong password and unknown email share this, so a response never reveals which.
export class InvalidCredentialsError extends Error {
  constructor() {
    super("Invalid email or password");
  }
}
