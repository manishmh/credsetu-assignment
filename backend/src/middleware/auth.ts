import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config.js";

export interface AuthRequest extends Request {
  userId?: string;
  userPhone?: string;
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Missing or invalid Authorization header" } });
  }
  try {
    const payload = jwt.verify(token, config.jwtSecret) as { sub: string; phone: string };
    req.userId = payload.sub;
    req.userPhone = payload.phone;
    next();
  } catch {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Invalid or expired token" } });
  }
}

export function signToken(userId: string, phone: string): string {
  return jwt.sign({ phone }, config.jwtSecret, { subject: userId, expiresIn: config.jwtExpiresIn } as jwt.SignOptions);
}
