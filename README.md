# MiniLedger — Track money lent to friends

MiniLedger is a polished, working mobile app for recording money lent to friends and tracking repayment. Mock phone-OTP login, a personal-finance dashboard with overdue highlighting, loan CRUD + repayment, financial summaries, and optional receipt photos.

## Features

- **Mock phone OTP auth** — 6-digit code printed in the backend terminal (dev only, 5-min expiry, attempt limits, resend throttling, single-use).
- **Dashboard** — total lent, total repaid, outstanding, and overdue cards; loan list with Pending / Overdue / Repaid styling; pull-to-refresh; empty/loading/error states; logout.
- **Add loan** — friend name, INR amount, due-date picker, validation (amount > 0, valid date), duplicate-submit guard.
- **Loan details** — full entry, idempotent "Mark as repaid" with confirmation, overdue derivation, repaid timestamp.
- **Receipt upload (bonus)** — attach a photo to a loan (`POST /api/loans/:id/receipt`), preview in details, local disk storage, type/size validation, ownership enforced.
- **Summary math** — decimal-exact totals from the DB (never floats), documented overdue rule.

## Architecture & stack

```
Credsetu/
  backend/          Express + TypeScript + Prisma (PostgreSQL) + Zod + JWT
    src/
      index.ts app.ts config.ts db.ts validation.ts
      routes/       auth.ts loans.ts summary.ts
      middleware/   auth.ts (JWT) error.ts
      services → validation.ts + summary.computeSummary (decimal.js)
    prisma/         schema.prisma + migrations/
    tests/          unit.test.ts (no DB) + integration.test.ts (supertest)
  mobile/           Expo (SDK 52) + React Native + TypeScript, no nav lib
    App.tsx         tiny state router: login → dashboard ⇄ add/detail
    src/api/        fetch client, EXPO_PUBLIC_API_URL base URL
    src/auth/       SecureStore token storage (+memory fallback)
    src/screens/    Login, Dashboard, AddLoan, LoanDetail
    src/components/ Button/Card/Field/StatusPill
  docker-compose.yml  Postgres 16 (host port 5433)
```

## Prerequisites

- Node 20+, npm, Docker + Docker Compose, Expo Go app on your phone (or an emulator).
- For a physical phone: phone and computer on the same Wi-Fi.

## Setup (clean checkout)

```bash
# 1. Database
docker compose up -d db

# 2. Backend
cd backend
cp .env.example .env        # defaults already point at the compose DB
npm install
npx prisma migrate dev      # creates tables
npm run dev                 # → http://localhost:4000

# 3. Mobile (new terminal)
cd mobile
npm install
cp .env.example .env        # emulator: localhost works; phone: see below
npx expo start              # scan the QR code with Expo Go
```

### Physical phone networking

`localhost` on a phone is the phone itself. Set your machine's LAN IP:

```bash
# find it:  ip addr  (Linux)  /  ipconfig (Windows) / ifconfig (macOS)
EXPO_PUBLIC_API_URL=http://192.168.1.5:4000 npx expo start
```

or put it in `mobile/.env`. The app shows this hint itself when the server is unreachable. If the QR scan fails, use tunnel mode: `npx expo start --tunnel`.

## Environment variables

Backend (`backend/.env`, see `backend/.env.example`):

| Var | Required | Default / notes |
|---|---|---|
| `DATABASE_URL` | yes | `postgresql://miniledger:miniledger@localhost:5433/miniledger` |
| `JWT_SECRET` | prod yes | dev fallback `dev-only-secret-change-me`; startup aborts in prod without it |
| `JWT_EXPIRES_IN` | no | `7d` |
| `PORT` | no | `4000` |
| `CORS_ORIGIN` | no | `*` (restrict in prod) |
| `UPLOAD_DIR` | no | `uploads` |

Mobile (`mobile/.env`, `EXPO_PUBLIC_` prefix — safe to expose): only `EXPO_PUBLIC_API_URL`. Never put `JWT_SECRET` or DB credentials in the mobile app.

## Database & migrations

```bash
cd backend
npx prisma migrate dev      # dev: apply + create migration
npx prisma migrate deploy   # prod/test: apply only
```

Tables: `User(id, phone unique)`, `OtpChallenge(phone, codeHash, expiresAt, attempts, consumed)`, `Loan(id, userId→User, friendName, amount Decimal(14,2), dueDate Date, status, receiptUrl?, repaidAt?)` with indexes on `(userId)`, `(userId,status)`, `(userId,dueDate)`, `phone`, `expiresAt`. No seed script — sign in with any phone number; a `User` row is created on first OTP verify.

Test DB: `CREATE DATABASE miniledger_test;` (in the compose container), then migrate with `DATABASE_URL=…/miniledger_test npx prisma migrate deploy`.

## Mock OTP login (how to demo)

1. Enter phone (e.g. `+919876543210`) → **Send OTP**.
2. Read the 6-digit code in the **backend terminal**: `[DEV-ONLY MOCK OTP] phone=… code=388173 …`.
3. Enter code → **Verify & log in**. Token is stored in SecureStore.

Rules: 5-minute expiry, max 5 attempts per code, 30-second resend cooldown, single-use (replay rejected). Codes are SHA-256 hashed at rest and never logged in production (`NODE_ENV=production` disables the log line).

## API reference

Base `http://localhost:4000`. Errors: `{ "error": { "code": "...", "message": "…" } }`. All `/api/loans*` and `/api/summary` need `Authorization: Bearer <jwt>`; users only ever see their own rows (404 otherwise).

| Method & path | Body | Notes |
|---|---|---|
| `GET /api/health` | — | `{ ok:true, service, time }` |
| `POST /api/auth/send-otp` | `{ phone }` | 429 if resent < 30 s |
| `POST /api/auth/verify-otp` | `{ phone, code }` | → `{ token, expiresAt, user }` |
| `GET /api/loans` | — | newest first, each with derived `overdue` |
| `POST /api/loans` | `{ friendName, amount, dueDate: "YYYY-MM-DD" }` | amount > 0, ≤ 1e9; 201 |
| `GET /api/loans/:id` | — | 404 if not yours |
| `PATCH /api/loans/:id/repay` | — | idempotent; `{ alreadyRepaid:true }` on repeat |
| `DELETE /api/loans/:id` | — | optional deletion |
| `POST /api/loans/:id/receipt` | multipart `receipt` | JPEG/PNG/WebP/HEIC/PDF ≤ 5 MB → `{ loan }` with `receiptUrl` |
| `GET /api/summary` | — | see below |
| `GET /uploads/<file>` | — | static receipt serving |

Example:

```bash
curl -X POST localhost:4000/api/auth/send-otp -H 'Content-Type: application/json' -d '{"phone":"+919876543210"}'
# read code from backend logs, then:
TOKEN=$(curl -s -X POST localhost:4000/api/auth/verify-otp -H 'Content-Type: application/json' \
  -d '{"phone":"+919876543210","code":"<CODE>"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")
curl -X POST localhost:4000/api/loans -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"friendName":"Asha","amount":"1500.50","dueDate":"2026-12-31"}'
curl localhost:4000/api/summary -H "Authorization: Bearer $TOKEN"
```

## Summary calculation rules

Computed server-side from the DB with `decimal.js` (column is `Decimal(14,2)`; floats never touch money):

- `totalLent` — sum of **all** loan principals (pending + repaid): historical volume.
- `totalRepaid` — sum of principals of **REPAID** loans only.
- `outstandingAmount` = `totalLent − totalRepaid` (what friends still owe you).
- `overdueAmount` — outstanding principal of **PENDING** loans whose **due date (date-only) is strictly before today** (server date). Due today is **not** overdue; repaid loans never count as overdue.
- `pendingCount` / `repaidCount` — row counts.

Timezone: day comparison uses the server's calendar date (UTC in Docker). Documented boundary: due-yesterday ⇒ overdue, due-today ⇒ pending, covered by unit tests.

## Tests, typecheck, build

```bash
cd backend
npx vitest run tests/unit.test.ts                                  # no DB needed
DATABASE_URL=postgresql://miniledger:miniledger@localhost:5433/miniledger_test npx vitest run   # full suite (guarded: refuses non-"test" DBs)
npx tsc --noEmit
cd ../mobile
npx tsc --noEmit
npx expo export --platform android                                  # verifies Metro bundle
```

Latest run: **20/20 vitest pass** (10 unit: phone validation, integer-cents math, summary incl. due-today/yesterday boundary; 10 integration: OTP success/wrong/expired/replay/lockout, auth guard, amount rejection, create→repay idempotency, cross-user 404s, summary math), `tsc` clean in both projects, Android bundle exports (~1.6 MB), live curl E2E (OTP → JWT → 2 loans → summary + receipt upload + static serve) all 200s. Not configured: ESLint (omitted deliberately — `tsc` + tests are the gates).

## Troubleshooting

| Symptom | Fix |
|---|---|
| App: "Cannot reach server" | Physical phone → set `EXPO_PUBLIC_API_URL` to LAN IP; same Wi-Fi; backend on `0.0.0.0:4000` |
| `send-otp` 429 | Wait 30 s (resend cooldown) |
| Prisma `P1001 can't reach DB` | `docker compose up -d db`; check `DATABASE_URL` port 5433 |
| Integration tests refuse to run | `DATABASE_URL` must contain "test" and point at migrated `miniledger_test` |
| Expo QR won't load | `npx expo start --tunnel`; clear Expo Go cache |

## Known limitations

- OTP is a **dev mock** (terminal log), not SMS — by design for offline demo.
- Receipts live on the backend's local disk (`uploads/`, gitignored); no S3/GCS adapter yet — interface is one function (`multer` storage) if you add one.
- Single currency display (INR); amounts stored currency-agnostic decimals.
- No pagination (fine for personal scale), no push reminders, no multi-user splitting.
- JWT has no refresh-token rotation; logout is client-side token deletion.

## Security notes (demo ≠ production banking)

Enforced: per-user ownership on every loan/receipt op, Zod validation + amount caps, parameterized Prisma queries, OTP hash/expiry/attempt/resend limits, 5 MB upload type filter, CORS configurable, no stack traces or secrets in prod errors, no committed secrets. Before production: real SMS OTP (e.g. Twilio Verify), Postgres RLS or audited scoping, refresh rotation + revocation, S3-backed receipts with signed URLs, rate limits on all auth routes, secret management, HTTPS, audit logging without PII.

## Demo checklist

See [DEMO.md](DEMO.md) — 2–3 minute script: login → dashboard → past-due loan (overdue red) → future loan → repay → updated summary → (optional) receipt + backend logs.
