import type { NextFunction, Request, Response } from "express";

/** An error carrying an HTTP status; thrown anywhere, rendered by errorMiddleware. */
export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "HttpError";
  }
}

/** Wrap an async route handler so thrown/rejected errors reach errorMiddleware. */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ error: "Not found" });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorMiddleware(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  // Errors that carry an HTTP status (e.g. body-parser's 400 on malformed JSON).
  const status = (err as { status?: number; statusCode?: number })?.status ??
    (err as { statusCode?: number })?.statusCode;
  if (typeof status === "number" && status >= 400 && status < 500) {
    res.status(status).json({ error: (err as Error).message ?? "Bad request" });
    return;
  }
  // Unexpected — log server-side, return a generic message.
  console.error("[api] unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
}
