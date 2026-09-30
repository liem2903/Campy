// Domain errors: thrown by services, mapped to HTTP statuses by controllers.

export class EmailTakenError extends Error {
  constructor() {
    super("An account with that email already exists");
    this.name = "EmailTakenError";
  }
}
