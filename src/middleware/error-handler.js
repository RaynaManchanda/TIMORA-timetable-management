import { AppError } from '../errors/app-errors.js';

/**
 * Respond with 404 for any route that no router handled.
 */
export function notFoundHandler(req, res) {
  res.status(404).json({ success: false, error: 'Route not found.', message: 'Route not found.' });
}

/**
 * Create the Express error middleware.
 * Known application errors keep their status and message; anything else is logged
 * and returned as a generic 500 so internal details never reach the client.
 *
 * @param {{ error: Function }} [logger] Object with an error() method.
 * @returns {(error: Error, req: object, res: object, next: Function) => void}
 */
export function createErrorHandler(logger = console) {
  // Express only treats a function with four parameters as an error handler.
  // eslint-disable-next-line no-unused-vars
  return (error, req, res, next) => {
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({
        success: false,
        error: error.message,
        message: error.message,
        ...error.details
      });
    }

    if (error.type === 'entity.parse.failed') {
      return res.status(400).json({ success: false, error: 'Request body is not valid JSON.', message: 'Request body is not valid JSON.' });
    }

    logger.error(error);
    return res.status(500).json({ success: false, error: 'Internal server error.', message: 'Internal server error.' });
  };
}
