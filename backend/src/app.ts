import cors from "cors";
import express from "express";
import fs from "fs";
import morgan from "morgan";
import path from "path";
import { config } from "./config.js";
import { prisma } from "./db.js";
import { authMiddleware } from "./middleware/auth.js";
import { errorHandler, notFound } from "./middleware/error.js";
import { authRouter } from "./routes/auth.js";
import { loansRouter } from "./routes/loans.js";
import { summaryRouter } from "./routes/summary.js";

export function createApp() {
  const app = express();
  app.use(cors({ origin: config.corsOrigin === "*" ? true : config.corsOrigin.split(",") }));
  app.use(express.json({ limit: "1mb" }));
  // Log requests without bodies (may contain OTPs/tokens).
  morgan.token("body", () => "-");
  app.use(morgan(":method :url :status :response-time ms"));

  app.get("/api/health", (_req, res) => res.json({ ok: true, service: "miniledger", time: new Date().toISOString() }));
  app.use("/api/auth", authRouter);
  app.use("/api/loans", authMiddleware, loansRouter);
  app.use("/api/summary", authMiddleware, summaryRouter);

  const uploadDir = path.resolve(config.uploadDir);
  fs.mkdirSync(uploadDir, { recursive: true });
  app.use("/uploads", express.static(uploadDir));

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

export async function start() {
  const missing: string[] = [];
  if (!process.env.DATABASE_URL) missing.push("DATABASE_URL");
  if (!process.env.JWT_SECRET && config.nodeEnv === "production") missing.push("JWT_SECRET (required in production)");
  if (missing.length) {
    console.error(`Missing configuration: ${missing.join(", ")}. See backend/.env.example.`);
    process.exit(1);
  }
  try {
    await prisma.$connect();
  } catch (e) {
    console.error("Could not connect to PostgreSQL. Start it with `docker compose up -d db` and check DATABASE_URL.");
    throw e;
  }
  const app = createApp();
  app.listen(config.port, "0.0.0.0", () => {
    console.log(`MiniLedger API listening on :${config.port} (${config.nodeEnv})`);
    if (config.nodeEnv !== "production") console.log("DEV-ONLY MOCK OTP is enabled: codes print in this terminal on /send-otp.");
  });
}
