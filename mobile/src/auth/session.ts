import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "miniledger_token";
let memoryFallback: string | null = null;

// SecureStore works on device builds / Expo Go. Fall back to memory (e.g. web)
// so the app never crashes where secure storage is unavailable.
export async function saveToken(token: string): Promise<void> {
  memoryFallback = token;
  try {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  } catch {
    /* memory fallback already set */
  }
}

export async function getToken(): Promise<string | null> {
  try {
    const t = await SecureStore.getItemAsync(TOKEN_KEY);
    if (t) {
      memoryFallback = t;
      return t;
    }
  } catch {
    /* fall through to memory */
  }
  return memoryFallback;
}

export async function clearToken(): Promise<void> {
  memoryFallback = null;
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch {
    /* nothing to clear */
  }
}
