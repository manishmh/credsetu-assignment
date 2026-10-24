import { Router } from "express";
import Decimal from "decimal.js";
import { prisma } from "../db.js";
import { AuthRequest } from "../middleware/auth.js";

export const summaryRouter = Router();

/**
 * Summary rules (server date, UTC day boundary):
 * - totalLent: sum of ALL loan principals (pending + repaid), historical.
 * - totalRepaid: sum of principals of REPAID entries only.
 * - outstandingAmount = totalLent - totalRepaid.
 * - overdueAmount: outstanding principal of PENDING loans whose dueDate (date-only)
 *   is strictly before today (server local/UTC date). Due today is NOT overdue.
 * - pendingCount / repaidCount: row counts per status.
 * Amounts are summed with decimal.js from the Decimal(14,2) column — never floats.
 */
export function computeSummary(
  loans: Array<{ amount: string | number; status: string; dueDate: Date | string }>,
  now = new Date()
) {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  let totalLent = new Decimal(0);
  let totalRepaid = new Decimal(0);
  let overdueAmount = new Decimal(0);
  let pendingCount = 0;
  let repaidCount = 0;
  for (const l of loans) {
    const amt = new Decimal(String(l.amount));
    totalLent = totalLent.plus(amt);
    const due = l.dueDate instanceof Date ? l.dueDate : new Date(l.dueDate);
    const dueDay = new Date(due);
    dueDay.setHours(0, 0, 0, 0);
    if (l.status === "REPAID") {
      totalRepaid = totalRepaid.plus(amt);
      repaidCount += 1;
    } else {
      pendingCount += 1;
      if (dueDay.getTime() < today.getTime()) overdueAmount = overdueAmount.plus(amt);
    }
  }
  const outstanding = totalLent.minus(totalRepaid);
  const fmt = (d: Decimal) => d.toFixed(2);
  return {
    totalLent: fmt(totalLent),
    totalRepaid: fmt(totalRepaid),
    outstandingAmount: fmt(outstanding),
    overdueAmount: fmt(overdueAmount),
    pendingCount,
    repaidCount,
  };
}

summaryRouter.get("/", async (req: AuthRequest, res, next) => {
  try {
    const loans = await prisma.loan.findMany({ where: { userId: req.userId! }, select: { amount: true, status: true, dueDate: true } });
    const summary = computeSummary(loans.map((l) => ({ amount: String(l.amount), status: l.status, dueDate: l.dueDate })));
    res.json({ ok: true, summary });
  } catch (e) {
    next(e);
  }
});
