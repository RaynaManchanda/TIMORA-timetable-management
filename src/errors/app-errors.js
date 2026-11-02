/**
 * Application errors that carry an HTTP status code.
 * The global error handler turns these into JSON responses.
 */

export class AppError extends Error {
  /**
   * @param {number} statusCode HTTP status returned to the client.
   * @param {string} message Human readable message.
   * @param {object} [details] Extra fields merged into the response body.
   */
  constructor(statusCode, message, details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.details = details;
  }
}

/** 400 - the request failed validation. Carries the list of problems. */
export class ValidationError extends AppError {
  /**
   * @param {string | string[]} validationErrors One message per invalid field.
   */
  constructor(validationErrors) {
    const errors = Array.isArray(validationErrors) ? validationErrors : [validationErrors];
    super(400, errors.join(', '), { validationErrors: errors });
  }
}

/** 401 - missing, invalid or expired credentials. */
export class AuthenticationError extends AppError {
  constructor(message = 'Authentication is required.', details = {}) {
    super(401, message, details);
  }
}

/** 403 - authenticated but not allowed. */
export class ForbiddenError extends AppError {
  constructor(message = 'You do not have permission to perform this action.') {
    super(403, message);
  }
}

/** 404 - resource does not exist. */
export class NotFoundError extends AppError {
  constructor(message = 'Resource not found.') {
    super(404, message);
  }
}

/** 409 - request conflicts with existing data. */
export class ConflictError extends AppError {
  constructor(message, details = {}) {
    super(409, message, details);
  }
}

/** 429 - too many requests. */
export class TooManyRequestsError extends AppError {
  constructor(message) {
    super(429, message);
  }
}

/** 503 - a dependency (database, Google) is unavailable. */
export class ServiceUnavailableError extends AppError {
  constructor(message) {
    super(503, message);
  }
}
