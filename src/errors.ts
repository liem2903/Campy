// Domain errors: services throw these, controllers map them to status codes.
export class EmailTakenError extends Error {
  constructor() {
    super("An account with this email already exists");
  }
}
