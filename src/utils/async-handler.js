/**
 * Wrap an async Express handler so rejected promises reach the error middleware.
 *
 * @param {(req: object, res: object, next: Function) => Promise<void>} handler Route handler.
 * @returns {(req: object, res: object, next: Function) => void}
 */
export function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}
