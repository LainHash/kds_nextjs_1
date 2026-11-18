import { authStorage } from "./auth-storage";
import { API_ENDPOINTS } from "./constants";
import { env } from "./env";
import type { ApiResult } from "@/types/api";
import type { AuthenticationResponse } from "@/features/auth/types";

export class ApiError extends Error {
  status: number;
  payload?: unknown;

  constructor(message: string, status: number, payload?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

export interface ApiFetchOptions extends RequestInit {
  skipAuth?: boolean;
  skipRefresh?: boolean;
}

let refreshPromise: Promise<string | null> | null = null;
const authExpiredListeners = new Set<() => void>();

export function subscribeAuthExpired(listener: () => void): () => void {
  authExpiredListeners.add(listener);
  return () => authExpiredListeners.delete(listener);
}

function notifyAuthExpired(): void {
  authStorage.clearAll();
  authExpiredListeners.forEach((listener) => listener());
}

function buildUrl(path: string): string {
  const baseUrl = env.apiBaseUrl.replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return baseUrl ? `${baseUrl}${normalizedPath}` : normalizedPath;
}

export type QueryParamPrimitive = string | number | boolean | null | undefined;
export type QueryParamValue = QueryParamPrimitive | QueryParamPrimitive[];

export function buildQueryString(
  params?: Record<string, QueryParamValue>
): string {
  if (!params) return "";
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item !== undefined && item !== null && item !== "") {
          searchParams.append(key, String(item));
        }
      }
    } else if (value !== undefined && value !== null && value !== "") {
      searchParams.set(key, String(value));
    }
  }
  const serialized = searchParams.toString();
  return serialized ? `?${serialized}` : "";
}

async function parseResponseBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return response.json().catch(() => null);
  }
  const text = await response.text().catch(() => "");
  return text || null;
}

async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    const refreshToken = authStorage.getRefreshToken();
    if (!refreshToken) {
      return null;
    }

    try {
      const response = await fetch(buildUrl(API_ENDPOINTS.identity.refresh), {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        return null;
      }

      const payload = (await parseResponseBody(
        response
      )) as ApiResult<AuthenticationResponse> | null;

      if (!payload?.isSucceed || !payload.data?.accessToken) {
        return null;
      }

      authStorage.setTokens(
        payload.data.accessToken,
        payload.data.refreshToken || refreshToken
      );
      return payload.data.accessToken;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

function extractErrorMessage(
  response: Response,
  payload: unknown
): string {
  if (payload && typeof payload === "object" && "message" in payload) {
    const msg = (payload as { message?: unknown }).message;
    if (typeof msg === "string" && msg.trim().length > 0) {
      return msg;
    }
  }
  if (typeof payload === "string" && payload.trim().length > 0) {
    return payload;
  }
  return `API request failed: ${response.status} ${response.statusText}`;
}

export async function apiFetch<T>(
  path: string,
  options?: ApiFetchOptions
): Promise<T> {
  const { skipAuth = false, skipRefresh = false, ...init } = options ?? {};

  const execute = async (tokenOverride?: string | null): Promise<Response> => {
    const token = skipAuth
      ? null
      : tokenOverride !== undefined
        ? tokenOverride
        : authStorage.getAccessToken();

    const headers = new Headers(init.headers);
    if (!headers.has("Content-Type") && !(init.body instanceof FormData)) {
      headers.set("Content-Type", "application/json");
    }
    if (token && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    return fetch(buildUrl(path), {
      ...init,
      credentials: init.credentials ?? "include",
      headers,
    });
  };

  let response = await execute();

  if (response.status === 401 && !skipAuth && !skipRefresh) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      response = await execute(newToken);
    } else {
      notifyAuthExpired();
    }
  }

  const payload = await parseResponseBody(response);

  if (!response.ok) {
    throw new ApiError(
      extractErrorMessage(response, payload),
      response.status,
      payload
    );
  }

  if (
    payload &&
    typeof payload === "object" &&
    "isSucceed" in payload &&
    (payload as { isSucceed?: boolean }).isSucceed === false
  ) {
    const result = payload as ApiResult<unknown>;
    throw new ApiError(
      result.message || "Yêu cầu không thành công.",
      result.statusCode || response.status,
      payload
    );
  }

  return payload as T;
}
