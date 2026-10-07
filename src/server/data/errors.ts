// Thrown by the data-access layer (src/server/data/*.ts) and caught by the
// server actions / route handlers that call it, which turn them into a
// user-facing message or an HTTP status.

export class NotFoundError extends Error {
  constructor(what: string) {
    super(`${what} not found`);
    this.name = "NotFoundError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}
