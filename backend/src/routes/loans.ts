import { NextFunction, Request, Response, Router } from "express";
import Decimal from "decimal.js";
import fs from "fs";
import multer from "multer";
import path from "path";
import { config } from "../config.js";
import { prisma } from "../db.js";
import { AuthRequest } from "../middleware/auth.js";
import { createLoanSchema } from "../validation.js";

export const loansRouter = Router();

function serializeLoan(l: { id: string; friendName: string; amount: unknown; dueDate: Date; status: string; receiptUrl: string | null; createdAt: Date; updatedAt: Date; repaidAt: Date | null }) {
  const due = l.dueDate instanceof Date ? l.dueDate : new Date(l.dueDate as string);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const overdue = l.status === "PENDING" && due.getTime() < today.getTime();
  return {
    id: l.id,
    friendName: l.friendName,
    amount: new Decimal(String(l.amount)).toFixed(2),
    dueDate: due.toISOString().slice(0, 10),
    status: l.status,
    overdue,
    receiptUrl: l.receiptUrl,
    createdAt: (l.createdAt as Date).toISOString(),
    updatedAt: (l.updatedAt as Date).toISOString(),
    repaidAt: l.repaidAt ? (l.repaidAt as Date).toISOString() : null,
  };
}

// GET /api/loans — list own entries, newest first
loansRouter.get("/", async (req: AuthRequest, res, next) => {
  try {
    const loans = await prisma.loan.findMany({ where: { userId: req.userId! }, orderBy: { createdAt: "desc" } });
    res.json({ ok: true, loans: loans.map(serializeLoan) });
  } catch (e) {
    next(e);
  }
});

// POST /api/loans — create
loansRouter.post("/", async (req: AuthRequest, res, next) => {
  try {
    const parsed = createLoanSchema.parse(req.body);
    const dueDate = new Date(parsed.dueDate);
    if (Number.isNaN(dueDate.getTime())) {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid due date" } });
    }
    const loan = await prisma.loan.create({
      data: {
        userId: req.userId!,
        friendName: parsed.friendName,
        amount: String(parsed.amount),
        dueDate,
      },
    });
    res.status(201).json({ ok: true, loan: serializeLoan(loan) });
  } catch (e) {
    next(e);
  }
});

// GET /api/loans/:id — ownership enforced
loansRouter.get("/:id", async (req: AuthRequest, res, next) => {
  try {
    const loan = await prisma.loan.findFirst({ where: { id: req.params.id, userId: req.userId! } });
    if (!loan) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Loan not found" } });
    res.json({ ok: true, loan: serializeLoan(loan) });
  } catch (e) {
    next(e);
  }
});

// PATCH /api/loans/:id/repay — idempotent: already-repaid returns 200 with no change
loansRouter.patch("/:id/repay", async (req: AuthRequest, res, next) => {
  try {
    const loan = await prisma.loan.findFirst({ where: { id: req.params.id, userId: req.userId! } });
    if (!loan) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Loan not found" } });
    if (loan.status === "REPAID") {
      return res.json({ ok: true, loan: serializeLoan(loan), alreadyRepaid: true });
    }
    const updated = await prisma.loan.update({
      where: { id: loan.id },
      data: { status: "REPAID", repaidAt: new Date() },
    });
    res.json({ ok: true, loan: serializeLoan(updated) });
  } catch (e) {
    next(e);
  }
});

// DELETE /api/loans/:id — optional deletion
loansRouter.delete("/:id", async (req: AuthRequest, res, next) => {
  try {
    const loan = await prisma.loan.findFirst({ where: { id: req.params.id, userId: req.userId! } });
    if (!loan) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Loan not found" } });
    await prisma.loan.delete({ where: { id: loan.id } });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// ---- Receipt upload (local dev storage) ----
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = path.resolve(config.uploadDir);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: config.maxReceiptBytes },
  fileFilter: (_req, file, cb) => {
    const ok = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"].includes(file.mimetype);
    if (!ok) return cb(new Error("INVALID_FILE_TYPE:Only JPEG/PNG/WebP/HEIC images or PDF receipts are allowed"));
    cb(null, true);
  },
});

// Convert multer errors into consistent JSON responses instead of HTML/500s.
function uploadSingleReceipt(req: AuthRequest, res: Response, next: NextFunction) {
  upload.single("receipt")(req as unknown as Request, res as unknown as Response, (err: unknown) => {
    if (!err) return next();
    if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
      console.warn(`[receipt] rejected oversized upload loan=${req.params.id} user=${req.userId}`);
      return res.status(413).json({
        error: { code: "FILE_TOO_LARGE", message: `Receipt must be smaller than ${config.maxReceiptBytes / 1024 / 1024} MB` },
      });
    }
    const message = err instanceof Error ? err.message : "Invalid receipt file";
    const code = message.startsWith("INVALID_FILE_TYPE:") ? "INVALID_FILE_TYPE" : "INVALID_FILE";
    const clean = message.includes(":") ? message.slice(message.indexOf(":") + 1) : message;
    console.warn(`[receipt] rejected upload loan=${req.params.id} user=${req.userId} reason=${clean}`);
    return res.status(400).json({ error: { code, message: clean } });
  });
}

loansRouter.post("/:id/receipt", uploadSingleReceipt, async (req: AuthRequest, res, next) => {
  try {
    const loan = await prisma.loan.findFirst({ where: { id: req.params.id, userId: req.userId! } });
    if (!loan) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Loan not found" } });
    }
    if (!req.file) return res.status(400).json({ error: { code: "MISSING_FILE", message: "No receipt file uploaded. Attach an image or PDF as the 'receipt' field." } });
    const receiptUrl = `/uploads/${path.basename(req.file.path)}`;
    const updated = await prisma.loan.update({ where: { id: loan.id }, data: { receiptUrl } });
    // Diagnostic log without secrets/PII: ids, mime, size only.
    console.log(`[receipt] stored loan=${loan.id} file=${path.basename(req.file.path)} mime=${req.file.mimetype} bytes=${req.file.size}`);
    res.json({ ok: true, loan: serializeLoan(updated) });
  } catch (e) {
    next(e);
  }
});
