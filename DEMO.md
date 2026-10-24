# MiniLedger — 2–3 Minute Demo Script

Target: Loom / Google Drive screen recording, ~2.5 minutes. Record the phone/emulator screen; keep the backend terminal visible at the start (split screen or quick alt-tab at the end).

## Before pressing record

- [ ] `docker compose up -d db` — Postgres up
- [ ] Backend running: `cd backend && npm run dev` (terminal visible, shows "DEV-ONLY MOCK OTP is enabled…")
- [ ] Fresh demo state: `DELETE FROM "User";` in psql (cascades loans) so the dashboard starts empty
- [ ] `cd mobile && npx expo start`, app open in Expo Go / emulator, on the Login screen
- [ ] Backend terminal font large enough to read the OTP on camera

## Script (≈ 150 seconds)

| # | Time | Do | Say / show |
|---|---|---|---|
| 1 | 0:00–0:20 | **Launch.** Show MiniLedger login screen. Enter `+919876543210`, tap **Send OTP**. | "MiniLedger tracks money I lend friends. Logging in with a phone number — the dev build prints the OTP in the backend terminal." |
| 2 | 0:20–0:45 | **OTP.** Alt-tab to backend terminal, point at `[DEV-ONLY MOCK OTP] … code=…`. Back in app, enter code, **Verify & log in** → empty dashboard. | "There's the code. Verified — and the dashboard starts empty with a zero summary." |
| 3 | 0:45–1:20 | **Overdue loan.** Tap **+ Add loan**: friend `Asha`, amount `1500`, due date **last week**. Save → dashboard shows loan with red **Overdue** pill; Outstanding = ₹1,500, Overdue = ₹1,500. | "First loan, due last week — it's flagged overdue and counted in the overdue total." |
| 4 | 1:20–1:45 | **Future loan.** Add second loan: `Ravi`, `2000`, due date **next month**. Dashboard: Outstanding ₹3,500, Overdue still ₹1,500, counts 2 pending. | "Second loan due next month stays neutral — outstanding rises, overdue doesn't." |
| 5 | 1:45–2:15 | **Repay.** Open Asha's loan → details → **Mark as repaid** → confirm. Status flips to green **Repaid** with repayment date. Back: Outstanding ₹2,000, Overdue ₹0, 1 pending / 1 repaid. | "Marking it repaid updates the entry and every summary number." |
| 6 | 2:15–2:35 | **(Optional, if time)** Attach a receipt photo on Ravi's loan; show preview. Flash the backend terminal (`POST /api/loans … 201`, `GET /api/summary 200`). | "Bonus: receipt photos, and every number comes from the API." |

## If something goes wrong live

- OTP box complains "No active OTP" → you waited > 5 min or already used it; tap **Resend code** (30 s cooldown).
- "Cannot reach server" → you're on a physical phone without the LAN-IP `EXPO_PUBLIC_API_URL`; say so, show `mobile/.env`, move on.
- Keep the Loom to one take; a small stumble is fine — don't re-record for polish.

No recording tool here provides a link — record with Loom/Drive yourself and share the viewer link in the submission.
