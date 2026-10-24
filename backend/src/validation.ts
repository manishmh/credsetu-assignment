import crypto from "crypto";
import { z } from "zod";

// Normalize: strip spaces/dashes/parens; require + or digits, 7..15 digits.
export const phoneSchema = z
  .string()
  .trim()
  .transform((s) => s.replace(/[\s\-().]/g, ""))
  .refine((s) => /^\+?\d{7,15}$/.test(s), { message: "Invalid phone number (7-15 digits, optional leading +)" });

export function normalizePhone(raw: string): string {
  const cleaned = raw.trim().replace(/[\s\-().]/g, "");
  return cleaned;
}

export function hashOtp(code: string, phone: string): string {
  return crypto.createHash("sha256").update(`${phone}:${code}`).digest("hex");
}

export function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export const otpVerifySchema = z.object({
  phone: phoneSchema,
  code: z.string().trim().regex(/^\d{6}$/, "OTP must be 6 digits"),
});

export const sendOtpSchema = z.object({
  phone: phoneSchema,
});

const amountSchema = z
  .union([z.string(), z.number()])
  .pipe(
    z.coerce.number().refine((n) => Number.isFinite(n) && n > 0, { message: "Amount must be greater than zero" })
  )
  .refine((n) => n <= 1_000_000_000, { message: "Amount too large" });

export const createLoanSchema = z.object({
  friendName: z.string().trim().min(1, "Friend name is required").max(100),
  amount: amountSchema,
  dueDate: z.string().trim().refine((s) => !Number.isNaN(Date.parse(s)), { message: "Invalid due date" }),
});

export function toCents(amount: number | string): bigint {
  // Convert decimal amount to integer paise/cents to avoid float errors.
  const s = String(amount).trim();
  const [whole, frac = ""] = s.split(".");
  const fracPadded = (frac + "00").slice(0, 2);
  return BigInt(whole.replace(/^0+(?=\d)/, "") || "0") * 100n + BigInt(fracPadded || "0");
}

export function fromCents(cents: bigint): string {
  const neg = cents < 0n;
  const abs = neg ? -cents : cents;
  const s = abs.toString().padStart(3, "0");
  const out = `${s.slice(0, -2)}.${s.slice(-2)}`;
  return neg ? `-${out}` : out;
}
