import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "miniledger_token";
let memoryCache: string | null = null;

// Minimal storage interface so web (localStorage) and native (SecureStore)
// share one code path without DOM lib types.
interface KeyValueStore {
  getItem(key: string): string | null | Promise<string | null>;
  setItem(key: string, value: string): void | Promise<void>;
  removeItem(key: string): void | Promise<void>;
}

function webStore(): KeyValueStore | null {
  try {
    const g = globalThis as unknown as { localStorage?: KeyValueStore };
    // NOTE: localStorage is readable by any script on this origin, so it is
    // weaker than native secure storage: an XSS flaw could steal the JWT.
    // Acceptable for this local demo; a production web app should use
    // httpOnly cookies + CSRF protection instead of a JS-readable token.
    return typeof window !== "undefined" && g.localStorage ? g.localStorage : null;
  } catch {
    return null;
  }
}

function nativeStore(): KeyValueStore {
  return {
    getItem: (k) => SecureStore.getItemAsync(k),
    setItem: (k, v) => SecureStore.setItemAsync(k, v),
    removeItem: (k) => SecureStore.deleteItemAsync(k),
  };
}

// Web keeps the session in localStorage so a browser refresh restores it.
// Native keeps it in SecureStore. Memory cache avoids repeat async reads.
export async function saveToken(token: string): Promise<void> {
  memoryCache = token;
  try {
    if (Platform.OS === "web") {
      await webStore()?.setItem(TOKEN_KEY, token);
    } else {
      await nativeStore().setItem(TOKEN_KEY, token);
    }
  } catch {
    /* memory cache already set */
  }
}

export async function getToken(): Promise<string | null> {
  if (memoryCache) return memoryCache;
  try {
    const store = Platform.OS === "web" ? webStore() : nativeStore();
    const t = (await store?.getItem(TOKEN_KEY)) ?? null;
    if (t) memoryCache = t;
    return t;
  } catch {
    return memoryCache;
  }
}

export async function clearToken(): Promise<void> {
  memoryCache = null;
  try {
    if (Platform.OS === "web") {
      await webStore()?.removeItem(TOKEN_KEY);
    } else {
      await nativeStore().removeItem(TOKEN_KEY);
    }
  } catch {
    /* already cleared in memory */
  }
}
