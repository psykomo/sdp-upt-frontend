import { data, redirect } from "react-router";

export type HapusGrant = {
  grant: string;
  officerId: string;
  nomorInduk: string;
  supervisorName: string;
  expiresAt?: number;
};

const HAPUS_GRANT_KEY = "sdp_hapus_grant";
const HAPUS_GRANT_TTL_MS = 10 * 60 * 1000;

const PUBLIC_LEGACY_HOST = "sdp.caripasal.com";
const PUBLIC_API_HOST = "sdp-api.caripasal.com";
const PUBLIC_FRONTEND_HOST = "sdp-front.caripasal.com";

export function getHapusGrant(): HapusGrant | null {
  if (typeof sessionStorage === "undefined") {
    return null;
  }

  try {
    const raw = sessionStorage.getItem(HAPUS_GRANT_KEY);
    if (!raw) {
      return null;
    }
    const value = JSON.parse(raw) as HapusGrant;
    if (!value.grant || !value.officerId || !value.nomorInduk) {
      sessionStorage.removeItem(HAPUS_GRANT_KEY);
      return null;
    }
    if (value.expiresAt && Date.now() > value.expiresAt) {
      sessionStorage.removeItem(HAPUS_GRANT_KEY);
      return null;
    }
    return value;
  } catch {
    return null;
  }
}

export function setHapusGrant(grant: Omit<HapusGrant, "expiresAt">): void {
  if (typeof sessionStorage === "undefined") {
    return;
  }
  sessionStorage.setItem(
    HAPUS_GRANT_KEY,
    JSON.stringify({ ...grant, expiresAt: Date.now() + HAPUS_GRANT_TTL_MS }),
  );
}

export function clearHapusGrant(): void {
  if (typeof sessionStorage === "undefined") {
    return;
  }
  sessionStorage.removeItem(HAPUS_GRANT_KEY);
}

function requestHost(request?: Request): string {
  const raw = request
    ? (request.headers.get("x-sdp-public-host") ??
        request.headers.get("x-forwarded-host") ??
        request.headers.get("host") ??
        new URL(request.url).host)
    : typeof window !== "undefined"
      ? window.location.host
      : "127.0.0.1";
  return raw.split(",")[0].trim().toLowerCase().replace(/:\d+$/, "");
}

function isPublicHost(host: string): boolean {
  return [PUBLIC_LEGACY_HOST, PUBLIC_API_HOST, PUBLIC_FRONTEND_HOST].includes(host);
}

export function publicRequestHost(request?: Request): string {
  return requestHost(request);
}

function isLoopback(host: string): boolean {
  return host === "127.0.0.1" || host === "localhost" || host === "::1";
}

export function publicLegacyBase(request?: Request): string {
  const host = requestHost(request);
  if (isPublicHost(host)) {
    return `https://${PUBLIC_LEGACY_HOST}`;
  }
  if (host && !isLoopback(host)) {
    return `http://${host}:8080`;
  }
  return "http://127.0.0.1:8080";
}

export function publicHeaders(request?: Request): Record<string, string> {
  const host = requestHost(request);
  return host ? { "X-SDP-Public-Host": host } : {};
}

const API_UNAVAILABLE = "Layanan API tidak tersedia. Coba muat ulang halaman ini.";

export async function fetchApi(url: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(url, {
      ...init,
      credentials: init?.credentials ?? "same-origin",
    });
  } catch {
    throw data(API_UNAVAILABLE, { status: 503 });
  }
}

export function apiBase(): string {
  return "";
}

function loginReturn(request?: Request): string {
  if (request) {
    const url = new URL(request.url);
    return url.pathname.replace(/\.data$/, "") + url.search;
  }
  if (typeof window !== "undefined") {
    return window.location.pathname + window.location.search;
  }
  return "/";
}

export async function hasSession(request?: Request): Promise<boolean> {
  const res = await fetchApi(`${apiBase()}/api/v1/auth/me`, {
    headers: {
      Accept: "application/json",
      ...publicHeaders(request),
    },
  });
  return res.ok;
}

export async function requireToken(request: Request): Promise<void> {
  if (!(await hasSession(request))) {
    throw redirect(`/login?return=${encodeURIComponent(loginReturn(request))}`);
  }
}

export async function apiGet<T>(path: string, request?: Request): Promise<T> {
  const res = await fetchApi(`${apiBase()}/api/v1${path}`, {
    headers: {
      Accept: "application/json",
      ...publicHeaders(request),
    },
  });

  if (res.status === 401) {
    throw redirect(`/login?return=${encodeURIComponent(loginReturn(request))}`);
  }

  let body: { ok: boolean; message?: string; data?: T };
  try {
    body = (await res.json()) as { ok: boolean; message?: string; data?: T };
  } catch {
    throw data(API_UNAVAILABLE, { status: 503 });
  }

  if (!res.ok || !body.ok) {
    throw data(body.message ?? "Permintaan API gagal.", { status: res.status });
  }

  return body.data as T;
}

export type ApiFail = {
  ok: false;
  status: number;
  message: string;
  errors: Record<string, string>;
};

export function isApiFail(value: unknown): value is ApiFail {
  return (
    typeof value === "object" &&
    value !== null &&
    "ok" in value &&
    (value as { ok?: unknown }).ok === false &&
    "message" in value
  );
}

export function failData(fail: ApiFail) {
  return data(
    {
      ok: false as const,
      status: fail.status,
      message: fail.message,
      errors: fail.errors,
    },
    { status: fail.status },
  );
}

async function readWriteBody<T>(res: Response): Promise<T | ApiFail> {
  if (res.status === 401) {
    throw redirect("/login");
  }

  let body: {
    ok: boolean;
    message?: string;
    errors?: Record<string, string>;
    data?: T;
  };
  try {
    body = (await res.json()) as {
      ok: boolean;
      message?: string;
      errors?: Record<string, string>;
      data?: T;
    };
  } catch {
    return { ok: false, status: 503, message: API_UNAVAILABLE, errors: {} };
  }

  if (!res.ok || !body.ok) {
    return {
      ok: false,
      status: res.status,
      message: body.message ?? "Permintaan API gagal.",
      errors: body.errors ?? {},
    };
  }

  return body.data as T;
}

export async function apiPostJson<T>(
  path: string,
  payload: unknown,
  request?: Request,
): Promise<T | ApiFail> {
  let res: Response;
  try {
    res = await fetchApi(`${apiBase()}/api/v1${path}`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...publicHeaders(request),
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    if (error instanceof Response && error.status === 503) {
      return { ok: false, status: 503, message: API_UNAVAILABLE, errors: {} };
    }
    throw error;
  }

  return readWriteBody<T>(res);
}

export async function apiSetWorkingScope(
  filterUptId?: string | null,
  filterKanwilId?: string | null,
): Promise<void> {
  const result = await apiPostJson<{ token: string }>("/auth/working-scope", {
    filterUptId: filterUptId ?? null,
    filterKanwilId: filterKanwilId ?? null,
  });
  if (isApiFail(result)) {
    throw new Error(result.message);
  }
}

export async function apiDeleteJson<T>(
  path: string,
  request?: Request,
  grant?: string,
): Promise<T | ApiFail> {
  let res: Response;
  try {
    res = await fetchApi(`${apiBase()}/api/v1${path}`, {
      method: "DELETE",
      headers: {
        Accept: "application/json",
        ...(grant ? { "X-SDP-Supervisor-Grant": grant } : {}),
        ...publicHeaders(request),
      },
    });
  } catch (error) {
    if (error instanceof Response && error.status === 503) {
      return { ok: false, status: 503, message: API_UNAVAILABLE, errors: {} };
    }
    throw error;
  }

  return readWriteBody<T>(res);
}

export async function apiPostFormData<T>(
  path: string,
  formData: FormData,
  request?: Request,
): Promise<T | ApiFail> {
  let res: Response;
  try {
    res = await fetchApi(`${apiBase()}/api/v1${path}`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        ...publicHeaders(request),
      },
      body: formData,
    });
  } catch (error) {
    if (error instanceof Response && error.status === 503) {
      return { ok: false, status: 503, message: API_UNAVAILABLE, errors: {} };
    }
    throw error;
  }

  return readWriteBody<T>(res);
}

export async function apiPutFormData<T>(
  path: string,
  formData: FormData,
  request?: Request,
): Promise<T | ApiFail> {
  let res: Response;
  try {
    res = await fetchApi(`${apiBase()}/api/v1${path}`, {
      method: "PUT",
      headers: {
        Accept: "application/json",
        ...publicHeaders(request),
      },
      body: formData,
    });
  } catch (error) {
    if (error instanceof Response && error.status === 503) {
      return { ok: false, status: 503, message: API_UNAVAILABLE, errors: {} };
    }
    throw error;
  }

  return readWriteBody<T>(res);
}

export async function apiPutJson<T>(
  path: string,
  payload: unknown,
  request?: Request,
): Promise<T | ApiFail> {
  let res: Response;
  try {
    res = await fetchApi(`${apiBase()}/api/v1${path}`, {
      method: "PUT",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...publicHeaders(request),
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    if (error instanceof Response && error.status === 503) {
      return { ok: false, status: 503, message: API_UNAVAILABLE, errors: {} };
    }
    throw error;
  }

  return readWriteBody<T>(res);
}

export async function fileToPayload(
  file: File | null,
): Promise<{ filename: string; mime: string; base64: string } | null> {
  if (!file || file.size === 0) {
    return null;
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }

  return {
    filename: file.name,
    mime: file.type,
    base64: btoa(binary),
  };
}

export type LoginOptions = {
  tenancyMode: string;
  requiresTenantId: boolean;
  requiresWorkingUptId: boolean;
};

export async function fetchLoginOptions(request?: Request): Promise<LoginOptions> {
  const res = await fetchApi(`${apiBase()}/api/v1/auth/login-options`, {
    headers: {
      Accept: "application/json",
      ...publicHeaders(request),
    },
  });

  if (!res.ok) {
    return { tenancyMode: "single", requiresTenantId: false, requiresWorkingUptId: false };
  }

  let body: { ok?: boolean; data?: LoginOptions };
  try {
    body = (await res.json()) as { ok?: boolean; data?: LoginOptions };
  } catch {
    return { tenancyMode: "single", requiresTenantId: false, requiresWorkingUptId: false };
  }

  if (!body.ok || !body.data) {
    return { tenancyMode: "single", requiresTenantId: false, requiresWorkingUptId: false };
  }

  return {
    tenancyMode: body.data.tenancyMode ?? "single",
    requiresTenantId: body.data.requiresTenantId ?? false,
    requiresWorkingUptId: body.data.requiresWorkingUptId ?? false,
  };
}

export async function apiLogin(
  username: string,
  password: string,
  request?: Request,
  tenantId?: string,
) {
  const payload: { username: string; password: string; tenantId?: string } = {
    username,
    password,
  };
  const tenant = tenantId?.trim();
  if (tenant) {
    payload.tenantId = tenant;
  }

  const res = await fetchApi(`${apiBase()}/api/v1/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...publicHeaders(request),
    },
    body: JSON.stringify(payload),
  });

  let body: {
    ok: boolean;
    message?: string;
    data?: { token: string; user: Record<string, unknown> };
  };
  try {
    body = (await res.json()) as {
      ok: boolean;
      message?: string;
      data?: { token: string; user: Record<string, unknown> };
    };
  } catch {
    throw data(API_UNAVAILABLE, { status: 503 });
  }

  if (!res.ok || !body.ok || !body.data?.token) {
    throw new Error(body.message ?? "Login gagal.");
  }

  return body.data;
}

export async function acceptLegacyToken(token: string, request?: Request): Promise<boolean> {
  const trimmed = token.trim();
  if (!trimmed) {
    return false;
  }

  const res = await fetchApi(`${apiBase()}/api/v1/auth/cookie`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...publicHeaders(request),
    },
    body: JSON.stringify({ token: trimmed }),
  });

  if (!res.ok) {
    return false;
  }

  const body = (await res.json()) as { ok?: boolean };
  return !!body.ok;
}

export async function apiLogout(request?: Request): Promise<void> {
  clearHapusGrant();
  try {
    await fetchApi(`${apiBase()}/api/v1/auth/logout`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        ...publicHeaders(request),
      },
    });
  } catch {
    // Cookie clear is best-effort; still send the officer to login.
  }
}
