import { KDS_AUTH_COOKIE, KDS_STORAGE_KEYS } from "./constants";
import type {
  AuthUser,
  UserPermissionsResponse,
} from "@/features/auth/types";
import type { BranchResponse } from "@/features/territory/types";

const isBrowser = (): boolean => typeof window !== "undefined";

function readJson<T>(key: string): T | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota errors
  }
}

function setSessionCookie(enabled: boolean): void {
  if (!isBrowser()) return;
  if (enabled) {
    document.cookie = `${KDS_AUTH_COOKIE}=1; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
  } else {
    document.cookie = `${KDS_AUTH_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
  }
}

export const authStorage = {
  getAccessToken(): string | null {
    if (!isBrowser()) return null;
    return window.localStorage.getItem(KDS_STORAGE_KEYS.accessToken);
  },

  getRefreshToken(): string | null {
    if (!isBrowser()) return null;
    return window.localStorage.getItem(KDS_STORAGE_KEYS.refreshToken);
  },

  setTokens(accessToken: string, refreshToken: string): void {
    if (!isBrowser()) return;
    window.localStorage.setItem(KDS_STORAGE_KEYS.accessToken, accessToken);
    window.localStorage.setItem(KDS_STORAGE_KEYS.refreshToken, refreshToken);
    setSessionCookie(true);
  },

  getUser(): AuthUser | null {
    return readJson<AuthUser>(KDS_STORAGE_KEYS.user);
  },

  setUser(user: AuthUser): void {
    writeJson(KDS_STORAGE_KEYS.user, user);
  },

  getPermissions(): UserPermissionsResponse | null {
    return readJson<UserPermissionsResponse>(KDS_STORAGE_KEYS.permissions);
  },

  setPermissions(permissions: UserPermissionsResponse): void {
    writeJson(KDS_STORAGE_KEYS.permissions, permissions);
  },

  getActiveBranch(): BranchResponse | null {
    return readJson<BranchResponse>(KDS_STORAGE_KEYS.activeBranch);
  },

  setActiveBranch(branch: BranchResponse | null): void {
    if (!isBrowser()) return;
    if (!branch) {
      window.localStorage.removeItem(KDS_STORAGE_KEYS.activeBranch);
      return;
    }
    writeJson(KDS_STORAGE_KEYS.activeBranch, branch);
  },

  clearAll(): void {
    if (!isBrowser()) return;
    window.localStorage.removeItem(KDS_STORAGE_KEYS.accessToken);
    window.localStorage.removeItem(KDS_STORAGE_KEYS.refreshToken);
    window.localStorage.removeItem(KDS_STORAGE_KEYS.user);
    window.localStorage.removeItem(KDS_STORAGE_KEYS.permissions);
    window.localStorage.removeItem(KDS_STORAGE_KEYS.activeBranch);
    setSessionCookie(false);
  },
};

