import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { hashOtp } from "../src/validation.js";

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-only-secret-change-me";

const prisma = new PrismaClient();
const app = createApp();

const PHONE_A = "+911111111111";
const PHONE_B = "+912222222222";

async function seedOtp(phone: string, code = "123456", minutesValid = 5) {
  await prisma.otpChallenge.updateMany({ where: { phone }, data: { consumed: true } });
  return prisma.otpChallenge.create({
    data: { phone, codeHash: hashOtp(code, phone), expiresAt: new Date(Date.now() + minutesValid * 60 * 1000) },
  });
}

async function loginAs(phone: string): Promise<string> {
  await seedOtp(phone);
  const res = await request(app).post("/api/auth/verify-otp").send({ phone, code: "123456" });
  expect(res.status).toBe(200);
  return res.body.token as string;
}

beforeAll(async () => {
  const url = process.env.DATABASE_URL ?? "";
  if (!url) throw new Error("DATABASE_URL must be set to run integration tests (use the test database!)");
  if (!/test/i.test(url)) throw new Error(`Refusing to run integration tests against non-test DB: ${url}`);
  await prisma.$connect();
});

beforeEach(async () => {
  await prisma.loan.deleteMany({});
  await prisma.otpChallenge.deleteMany({});
  await prisma.user.deleteMany({});
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("auth", () => {
  it("verifies a correct unexpired OTP and returns a JWT", async () => {
    await seedOtp(PHONE_A);
    const res = await request(app).post("/api/auth/verify-otp").send({ phone: PHONE_A, code: "123456" });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
  });
  it("rejects a wrong OTP", async () => {
    await seedOtp(PHONE_A);
    const res = await request(app).post("/api/auth/verify-otp").send({ phone: PHONE_A, code: "000000" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("OTP_INVALID");
  });
  it("rejects an expired OTP", async () => {
    await seedOtp(PHONE_A, "123456", -1);
    const res = await request(app).post("/api/auth/verify-otp").send({ phone: PHONE_A, code: "123456" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("OTP_EXPIRED");
  });
  it("consumes OTP after success (replay fails)", async () => {
    await seedOtp(PHONE_A);
    const ok = await request(app).post("/api/auth/verify-otp").send({ phone: PHONE_A, code: "123456" });
    expect(ok.status).toBe(200);
    const replay = await request(app).post("/api/auth/verify-otp").send({ phone: PHONE_A, code: "123456" });
    expect(replay.status).toBe(400);
  });
  it("locks after too many attempts", async () => {
    await seedOtp(PHONE_A);
    for (let i = 0; i < 5; i++) {
      await request(app).post("/api/auth/verify-otp").send({ phone: PHONE_A, code: "000000" });
    }
    const res = await request(app).post("/api/auth/verify-otp").send({ phone: PHONE_A, code: "000000" });
    expect([400, 429]).toContain(res.status);
  });
});

describe("loans + summary", () => {
  it("blocks unauthenticated access", async () => {
    for (const r of [
      request(app).get("/api/loans"),
      request(app).post("/api/loans").send({}),
      request(app).get("/api/summary"),
    ]) {
      const res = await r;
      expect(res.status).toBe(401);
    }
  });
  it("rejects invalid amounts", async () => {
    const token = await loginAs(PHONE_A);
    for (const amount of [0, -50, "abc"]) {
      const res = await request(app).post("/api/loans").set("Authorization", `Bearer ${token}`).send({ friendName: "Asha", amount, dueDate: "2026-12-31" });
      expect(res.status).toBe(400);
    }
  });
  it("creates, lists, and repays a loan (idempotent repay)", async () => {
    const token = await loginAs(PHONE_A);
    const created = await request(app).post("/api/loans").set("Authorization", `Bearer ${token}`).send({ friendName: "Asha", amount: "1500.50", dueDate: "2026-12-31" });
    expect(created.status).toBe(201);
    expect(created.body.loan.amount).toBe("1500.50");
    const id = created.body.loan.id as string;

    const list = await request(app).get("/api/loans").set("Authorization", `Bearer ${token}`);
    expect(list.body.loans).toHaveLength(1);

    const repay1 = await request(app).patch(`/api/loans/${id}/repay`).set("Authorization", `Bearer ${token}`);
    expect(repay1.status).toBe(200);
    expect(repay1.body.loan.status).toBe("REPAID");

    const repay2 = await request(app).patch(`/api/loans/${id}/repay`).set("Authorization", `Bearer ${token}`);
    expect(repay2.status).toBe(200);
    expect(repay2.body.alreadyRepaid).toBe(true);
  });
  it("isolates users: B cannot read A's loan", async () => {
    const tokenA = await loginAs(PHONE_A);
    const tokenB = await loginAs(PHONE_B);
    const created = await request(app).post("/api/loans").set("Authorization", `Bearer ${tokenA}`).send({ friendName: "Asha", amount: 100, dueDate: "2026-12-31" });
    const id = created.body.loan.id as string;
    expect((await request(app).get(`/api/loans/${id}`).set("Authorization", `Bearer ${tokenB}`)).status).toBe(404);
    expect((await request(app).patch(`/api/loans/${id}/repay`).set("Authorization", `Bearer ${tokenB}`)).status).toBe(404);
    expect((await request(app).delete(`/api/loans/${id}`).set("Authorization", `Bearer ${tokenB}`)).status).toBe(404);
    expect(((await request(app).get("/api/loans").set("Authorization", `Bearer ${tokenB}`)).body.loans)).toHaveLength(0);
  });
  it("rejects an expired JWT with 401", async () => {
    const user = await prisma.user.create({ data: { phone: PHONE_A } });
    const expired = jwt.sign({ phone: PHONE_A }, JWT_SECRET, { subject: user.id, expiresIn: -10 });
    const res = await request(app).get("/api/loans").set("Authorization", `Bearer ${expired}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });
  it("repay on unknown id is 404", async () => {
    const token = await loginAs(PHONE_A);
    const res = await request(app).patch("/api/loans/00000000-0000-0000-0000-000000000000/repay").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
  it("summary matches ledger math", async () => {
    const token = await loginAs(PHONE_A);
    const auth = { Authorization: `Bearer ${token}` };
    // overdue pending (past), future pending, repaid
    await request(app).post("/api/loans").set(auth).send({ friendName: "Past", amount: "100.00", dueDate: "2000-01-01" });
    await request(app).post("/api/loans").set(auth).send({ friendName: "Future", amount: "200.00", dueDate: "2099-01-01" });
    const r = await request(app).post("/api/loans").set(auth).send({ friendName: "Paid", amount: "50.00", dueDate: "2000-01-01" });
    await request(app).patch(`/api/loans/${r.body.loan.id}/repay`).set(auth);
    const s = (await request(app).get("/api/summary").set(auth)).body.summary;
    expect(s).toMatchObject({ totalLent: "350.00", totalRepaid: "50.00", outstandingAmount: "300.00", overdueAmount: "100.00", pendingCount: 2, repaidCount: 1 });
  });
});

describe("receipt upload", () => {
  const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);

  async function loanFor(token: string): Promise<string> {
    const res = await request(app)
      .post("/api/loans")
      .set("Authorization", `Bearer ${token}`)
      .send({ friendName: "Rcpt", amount: "75.50", dueDate: "2099-01-01" });
    expect(res.status).toBe(201);
    return res.body.loan.id as string;
  }

  it("uploads a receipt and persists receiptUrl", async () => {
    const token = await loginAs(PHONE_A);
    const id = await loanFor(token);
    const up = await request(app)
      .post(`/api/loans/${id}/receipt`)
      .set("Authorization", `Bearer ${token}`)
      .attach("receipt", pngHeader, { filename: "r.png", contentType: "image/png" });
    expect(up.status).toBe(200);
    expect(up.body.loan.receiptUrl).toMatch(/^\/uploads\/.+\.png$/);

    // Reference survives reload: refetch the loan and GET the file.
    const again = await request(app).get(`/api/loans/${id}`).set("Authorization", `Bearer ${token}`);
    expect(again.body.loan.receiptUrl).toBe(up.body.loan.receiptUrl);
    const file = await request(app).get(up.body.loan.receiptUrl);
    expect(file.status).toBe(200);
  });
  it("rejects a missing file with 400 MISSING_FILE", async () => {
    const token = await loginAs(PHONE_A);
    const id = await loanFor(token);
    const res = await request(app).post(`/api/loans/${id}/receipt`).set("Authorization", `Bearer ${token}`).field("receipt", "[object Object]");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("MISSING_FILE");
  });
  it("rejects an invalid type with 400 INVALID_FILE_TYPE", async () => {
    const token = await loginAs(PHONE_A);
    const id = await loanFor(token);
    const res = await request(app)
      .post(`/api/loans/${id}/receipt`)
      .set("Authorization", `Bearer ${token}`)
      .attach("receipt", Buffer.from("hello"), { filename: "r.txt", contentType: "text/plain" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_FILE_TYPE");
  });
  it("rejects an oversized file with 413 FILE_TOO_LARGE", async () => {
    const token = await loginAs(PHONE_A);
    const id = await loanFor(token);
    const big = Buffer.alloc(6 * 1024 * 1024, 0x41);
    const res = await request(app)
      .post(`/api/loans/${id}/receipt`)
      .set("Authorization", `Bearer ${token}`)
      .attach("receipt", big, { filename: "big.png", contentType: "image/png" });
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe("FILE_TOO_LARGE");
  });
  it("refuses cross-user upload with 404", async () => {
    const tokenA = await loginAs(PHONE_A);
    const tokenB = await loginAs(PHONE_B);
    const id = await loanFor(tokenA);
    const res = await request(app)
      .post(`/api/loans/${id}/receipt`)
      .set("Authorization", `Bearer ${tokenB}`)
      .attach("receipt", pngHeader, { filename: "r.png", contentType: "image/png" });
    expect(res.status).toBe(404);
  });
});
