import { Router } from "express";
import rateLimit from "express-rate-limit";
import jwt from "jsonwebtoken";
import { config, isProd } from "../config.js";
import { prisma } from "../db.js";
import { signToken } from "../middleware/auth.js";
import { generateOtp, hashOtp, otpVerifySchema, sendOtpSchema } from "../validation.js";

export const authRouter = Router();

// Throttle OTP sends per IP: max 10 per 10 minutes.
const sendLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });

// DEV-ONLY MOCK OTP: codes are logged to the server terminal. Never log in production.
authRouter.post("/send-otp", sendLimiter, async (req, res, next) => {
  try {
    const { phone } = sendOtpSchema.parse(req.body);
    const now = new Date();

    const recent = await prisma.otpChallenge.findFirst({
      where: { phone, consumed: false, expiresAt: { gt: now } },
      orderBy: { createdAt: "desc" },
    });
    if (recent) {
      const elapsed = (now.getTime() - recent.lastSentAt.getTime()) / 1000;
      if (elapsed < config.otpResendSeconds) {
        return res.status(429).json({
          error: { code: "RATE_LIMITED", message: `Please wait ${Math.ceil(config.otpResendSeconds - elapsed)}s before resending` },
        });
      }
      // Invalidate older unconsumed challenges for this phone.
      await prisma.otpChallenge.updateMany({ where: { phone, consumed: false }, data: { consumed: true } });
    }

    const code = generateOtp();
    const expiresAt = new Date(now.getTime() + config.otpExpiryMinutes * 60 * 1000);
    await prisma.otpChallenge.create({
      data: { phone, codeHash: hashOtp(code, phone), expiresAt, lastSentAt: now },
    });

    if (!isProd) {
      console.log(`[DEV-ONLY MOCK OTP] phone=${phone} code=${code} (expires in ${config.otpExpiryMinutes} min)`);
    }
    return res.json({ ok: true, message: "OTP sent (dev mock: check server logs)", expiresInSeconds: config.otpExpiryMinutes * 60 });
  } catch (e) {
    next(e);
  }
});

authRouter.post("/verify-otp", async (req, res, next) => {
  try {
    const { phone, code } = otpVerifySchema.parse(req.body);
    const now = new Date();
    const challenge = await prisma.otpChallenge.findFirst({
      where: { phone, consumed: false },
      orderBy: { createdAt: "desc" },
    });
    if (!challenge) {
      return res.status(400).json({ error: { code: "OTP_INVALID", message: "No active OTP for this phone. Request a new code." } });
    }
    if (challenge.expiresAt.getTime() < now.getTime()) {
      await prisma.otpChallenge.update({ where: { id: challenge.id }, data: { consumed: true } });
      return res.status(400).json({ error: { code: "OTP_EXPIRED", message: "OTP expired. Request a new code." } });
    }
    if (challenge.attempts >= challenge.maxAttempts) {
      await prisma.otpChallenge.update({ where: { id: challenge.id }, data: { consumed: true } });
      return res.status(429).json({ error: { code: "OTP_LOCKED", message: "Too many attempts. Request a new code." } });
    }
    if (hashOtp(code, phone) !== challenge.codeHash) {
      await prisma.otpChallenge.update({ where: { id: challenge.id }, data: { attempts: { increment: 1 } } });
      return res.status(400).json({ error: { code: "OTP_INVALID", message: "Incorrect OTP" } });
    }
    await prisma.otpChallenge.update({ where: { id: challenge.id }, data: { consumed: true } });

    let user = await prisma.user.findUnique({ where: { phone } });
    if (!user) user = await prisma.user.create({ data: { phone } });

    const token = signToken(user.id, user.phone);
    // Decode without verifying extra: report expiry for clients.
    const decoded = jwt.decode(token) as { exp?: number } | null;
    return res.json({ ok: true, token, expiresAt: decoded?.exp ? new Date(decoded.exp * 1000).toISOString() : null, user: { id: user.id, phone: user.phone } });
  } catch (e) {
    next(e);
  }
});
