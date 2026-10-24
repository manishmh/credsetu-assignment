import { describe, expect, it } from "vitest";
import { computeSummary } from "../src/routes/summary.js";
import { fromCents, normalizePhone, phoneSchema, toCents } from "../src/validation.js";

describe("phone validation", () => {
  it("accepts +country numbers and strips formatting", () => {
    expect(phoneSchema.parse("+91 98765 43210")).toBe("+919876543210");
    expect(phoneSchema.parse("(987) 654-3210")).toBe("9876543210");
  });
  it("rejects short/garbage numbers", () => {
    expect(() => phoneSchema.parse("abc")).toThrow();
    expect(() => phoneSchema.parse("123")).toThrow();
  });
  it("normalizePhone strips separators", () => {
    expect(normalizePhone("+91 98765-43210")).toBe("+919876543210");
  });
});

describe("money helpers (integer cents, no floats)", () => {
  it("round-trips decimal amounts exactly", () => {
    expect(toCents("100.10")).toBe(10010n);
    expect(toCents("0.07")).toBe(7n);
    expect(fromCents(10010n)).toBe("100.10");
  });
  it("avoids float error: 0.1 + 0.2", () => {
    expect(toCents("0.1") + toCents("0.2")).toBe(30n);
  });
});

describe("summary math", () => {
  const now = new Date("2026-06-15T12:00:00Z");
  it("totals lent/repaid/outstanding/overdue correctly", () => {
    const loans = [
      { amount: "100.00", status: "PENDING", dueDate: new Date("2026-06-10") }, // overdue
      { amount: "200.50", status: "PENDING", dueDate: new Date("2026-06-20") }, // future
      { amount: "50.25", status: "REPAID", dueDate: new Date("2026-06-01") },
    ];
    const s = computeSummary(loans, now);
    expect(s.totalLent).toBe("350.75");
    expect(s.totalRepaid).toBe("50.25");
    expect(s.outstandingAmount).toBe("300.50");
    expect(s.overdueAmount).toBe("100.00");
    expect(s.pendingCount).toBe(2);
    expect(s.repaidCount).toBe(1);
  });
  it("due today is NOT overdue (boundary)", () => {
    const s = computeSummary([{ amount: "10.00", status: "PENDING", dueDate: new Date("2026-06-15") }], now);
    expect(s.overdueAmount).toBe("0.00");
  });
  it("due yesterday IS overdue (boundary)", () => {
    const s = computeSummary([{ amount: "10.00", status: "PENDING", dueDate: new Date("2026-06-14") }], now);
    expect(s.overdueAmount).toBe("10.00");
  });
  it("repaid overdue loan does not count as overdue", () => {
    const s = computeSummary([{ amount: "10.00", status: "REPAID", dueDate: new Date("2026-01-01") }], now);
    expect(s.overdueAmount).toBe("0.00");
    expect(s.outstandingAmount).toBe("0.00");
  });
  it("empty ledger is all zeros", () => {
    const s = computeSummary([], now);
    expect(s).toMatchObject({ totalLent: "0.00", totalRepaid: "0.00", outstandingAmount: "0.00", overdueAmount: "0.00", pendingCount: 0, repaidCount: 0 });
  });
});
