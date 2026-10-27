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

// Another user's note already has this id (the client generated a clashing id).
export class NoteIdTakenError extends Error {
  constructor() {
    super("That note id is already taken");
  }
}

// A missing note and another user's note share this, so a response never reveals which.
export class NoteNotFoundError extends Error {
  constructor() {
    super("Note not found");
  }
}

// A block id in the saved tree belongs to a different note (this user's or another user's).
export class BlockOfAnotherNoteError extends Error {
  constructor() {
    super("A block id belongs to another note");
  }
}

// A missing tag and another user's tag share this, so a response never reveals which.
export class TagNotFoundError extends Error {
  constructor() {
    super("Tag not found");
  }
}

// A missing question and another user's question share this, so a response never reveals which.
export class QuestionNotFoundError extends Error {
  constructor() {
    super("Question not found");
  }
}

// The user already has a tag with this name (names are compared trimmed and lowercased).
export class TagNameTakenError extends Error {
  constructor(name: string) {
    super(`A tag called ${name} already exists`);
  }
}
