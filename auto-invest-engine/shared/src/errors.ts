export class AppError extends Error {
  constructor(public readonly status: number, message: string, public readonly code?: string) {
    super(message);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") { super(401, message, "UNAUTHORIZED"); }
}

export class NotFoundError extends AppError {
  constructor(message = "Not found") { super(404, message, "NOT_FOUND"); }
}

export class ConflictError extends AppError {
  constructor(message = "Conflict") { super(409, message, "CONFLICT"); }
}

export class ValidationError extends AppError {
  constructor(message = "Invalid input") { super(400, message, "VALIDATION"); }
}
