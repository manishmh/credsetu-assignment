import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { isProd } from "../config.js";

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: "Invalid request", details: err.errors.map((e) => ({ path: e.path.join("."), message: e.message })) },
    });
  }
  const status = typeof err === "object" && err !== null && "status" in err ? Number((err as { status: number }).status) || 500 : 500;
  const message = err instanceof Error ? err.message : "Internal server error";
  if (!isProd) console.error(err);
  return res.status(status).json({
    error: { code: status >= 500 ? "INTERNAL_ERROR" : "REQUEST_ERROR", message: status >= 500 && isProd ? "Internal server error" : message },
  });
}

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ error: { code: "NOT_FOUND", message: "Not found" } });
}
