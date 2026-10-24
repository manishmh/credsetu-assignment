// Central environment-based configuration. Fails fast with useful errors.
import dotenv from "dotenv";

dotenv.config();

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (!v) throw new Error(`Missing required env var ${name}. Copy backend/.env.example to backend/.env and fill it in.`);
  return v;
}

export const config = {
  port: parseInt(process.env.PORT ?? "4000", 10),
  databaseUrl: required("DATABASE_URL", "postgresql://miniledger:miniledger@localhost:5433/miniledger"),
  jwtSecret: process.env.JWT_SECRET ?? "dev-only-secret-change-me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
  nodeEnv: process.env.NODE_ENV ?? "development",
  otpExpiryMinutes: 5,
  otpMaxAttempts: 5,
  otpResendSeconds: 30,
  corsOrigin: process.env.CORS_ORIGIN ?? "*",
  uploadDir: process.env.UPLOAD_DIR ?? "uploads",
  maxReceiptBytes: 5 * 1024 * 1024,
};

export const isProd = config.nodeEnv === "production";
