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

// A new or edited chapter is over MAX_CHAPTER_WORDS — the caller keeps the
// typed text and asks the author to move part of it to another chapter.
export class ChapterTooLongError extends Error {
  constructor() {
    super("Chapter exceeds the word limit");
    this.name = "ChapterTooLongError";
  }
}

// A complaint someone else already resolved (stale admin page).
export class AlreadyResolvedError extends Error {
  constructor() {
    super("Report already resolved");
    this.name = "AlreadyResolvedError";
  }
}
