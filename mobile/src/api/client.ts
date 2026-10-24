import { Platform } from "react-native";
import { getToken } from "../auth/session";

// Physical phones cannot reach the dev machine via localhost — set this to
// your machine's LAN IP, e.g. http://192.168.1.5:4000
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/, "");

export interface Loan {
  id: string;
  friendName: string;
  amount: string;
  dueDate: string;
  status: "PENDING" | "REPAID";
  overdue: boolean;
  receiptUrl: string | null;
  createdAt: string;
  updatedAt: string;
  repaidAt: string | null;
}

export interface Summary {
  totalLent: string;
  totalRepaid: string;
  outstandingAmount: string;
  overdueAmount: string;
  pendingCount: number;
  repaidCount: number;
}

function errMsg(body: unknown, fallback: string): string {
  if (typeof body === "object" && body !== null && "error" in body) {
    const e = (body as { error?: { message?: string } }).error;
    if (e?.message) return e.message;
  }
  return fallback;
}

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function req<T>(path: string, init?: RequestInit, auth = true): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth) {
    const token = await getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...init, headers: { ...headers, ...(init?.headers as object) } });
  } catch {
    throw new ApiError(0, `Cannot reach server at ${API_URL}. On a physical phone set EXPO_PUBLIC_API_URL to your computer's LAN IP (see README).`, "NETWORK_ERROR");
  }
  const body = (await res.json().catch(() => ({}))) as unknown;
  if (!res.ok) {
    const e = (body as { error?: { message?: string; code?: string } }).error;
    throw new ApiError(res.status, e?.message ?? errMsg(body, `Request failed (${res.status})`), e?.code);
  }
  return body as T;
}

export const api = {
  sendOtp: (phone: string) => req<{ ok: boolean }>("/api/auth/send-otp", { method: "POST", body: JSON.stringify({ phone }) }, false),
  verifyOtp: (phone: string, code: string) =>
    req<{ ok: boolean; token: string }>("/api/auth/verify-otp", { method: "POST", body: JSON.stringify({ phone, code }) }, false),
  loans: () => req<{ ok: boolean; loans: Loan[] }>("/api/loans"),
  loan: (id: string) => req<{ ok: boolean; loan: Loan }>(`/api/loans/${id}`),
  createLoan: (data: { friendName: string; amount: string; dueDate: string }) =>
    req<{ ok: boolean; loan: Loan }>("/api/loans", { method: "POST", body: JSON.stringify(data) }),
  repayLoan: (id: string) => req<{ ok: boolean; loan: Loan }>(`/api/loans/${id}/repay`, { method: "PATCH" }),
  deleteLoan: (id: string) => req<{ ok: boolean }>(`/api/loans/${id}`, { method: "DELETE" }),
  summary: () => req<{ ok: boolean; summary: Summary }>("/api/summary"),
  // Multipart upload. No manual Content-Type: the runtime generates the boundary.
  // Web: the { uri, name, type } stub serializes to "[object Object]" (no file
  // part -> backend 400), so resolve the blob: URL to a real Blob first.
  // Native: keep the { uri, name, type } shape the RN networking stack expects.
  uploadReceipt: async (id: string, uri: string, name: string, mime: string): Promise<Loan> => {
    const token = await getToken();
    const form = new FormData();
    if (Platform.OS === "web") {
      let blob: Blob;
      try {
        blob = await (await fetch(uri)).blob();
      } catch {
        throw new ApiError(0, "Could not read the selected image. Please pick another photo.", "FILE_READ_ERROR");
      }
      if (!blob || blob.size === 0) {
        throw new ApiError(0, "The selected image is empty. Please pick another photo.", "EMPTY_FILE");
      }
      form.append("receipt", blob, name);
    } else {
      form.append("receipt", { uri, name, type: mime } as unknown as Blob);
    }
    let res: Response;
    try {
      res = await fetch(`${API_URL}/api/loans/${id}/receipt`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
    } catch {
      throw new ApiError(0, `Cannot reach server at ${API_URL}.`, "NETWORK_ERROR");
    }
    const body = (await res.json().catch(() => ({}))) as { ok?: boolean; loan?: Loan; error?: { message?: string; code?: string } };
    if (!res.ok) throw new ApiError(res.status, body.error?.message ?? `Upload failed (${res.status})`, body.error?.code);
    return body.loan as Loan;
  },
  receiptUrl: (path: string | null) => (path ? `${API_URL}${path}` : null),
};
