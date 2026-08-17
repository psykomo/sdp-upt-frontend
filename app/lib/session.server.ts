import { createCookie, data, redirect } from "react-router";

export const tokenCookie = createCookie("sdp_token", {
  httpOnly: true,
  sameSite: "lax",
  path: "/",
  maxAge: 60 * 60 * 8,
  secrets: [process.env.SESSION_SECRET ?? "sdp-frontend-dev-secret"],
});

export const hapusGrantCookie = createCookie("sdp_hapus_grant", {
  httpOnly: true,
  sameSite: "lax",
  path: "/",
  maxAge: 10 * 60,
  secrets: [process.env.SESSION_SECRET ?? "sdp-frontend-dev-secret"],
});

export type HapusGrant = {
  grant: string;
  officerId: string;
  nomorInduk: string;
  supervisorName: string;
};

export async function getHapusGrant(request: Request): Promise<HapusGrant | null> {
  const value = await hapusGrantCookie.parse(request.headers.get("Cookie"));
  if (!value || typeof value !== "object") {
    return null;
  }
  const grant = value as HapusGrant;
  if (!grant.grant || !grant.officerId || !grant.nomorInduk) {
    return null;
  }
  return grant;
}

const PUBLIC_LEGACY_HOST = process.env.PUBLIC_LEGACY_HOST ?? "sdp.caripasal.com";
const PUBLIC_API_HOST = process.env.PUBLIC_API_HOST ?? "sdp-api.caripasal.com";
const PUBLIC_FRONTEND_HOST = process.env.PUBLIC_FRONTEND_HOST ?? "sdp-front.caripasal.com";

export async function getToken(request: Request): Promise<string | null> {
  const token = await tokenCookie.parse(request.headers.get("Cookie"));
  return typeof token === "string" && token.length > 0 ? token : null;
}

export async function requireToken(request: Request): Promise<string> {
  const token = await getToken(request);
  if (!token) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\.data$/, "");
    throw redirect(`/login?return=${encodeURIComponent(path + url.search)}`);
  }
  return token;
}

function requestHost(request: Request): string {
  const raw =
    request.headers.get("x-sdp-public-host") ??
    request.headers.get("x-forwarded-host") ??
    request.headers.get("host") ??
    new URL(request.url).host;
  return raw.split(",")[0].trim().toLowerCase().replace(/:\d+$/, "");
}

function isPublicHost(host: string): boolean {
  return [PUBLIC_LEGACY_HOST, PUBLIC_API_HOST, PUBLIC_FRONTEND_HOST]
    .map((value) => value.toLowerCase())
    .includes(host);
}

export function publicRequestHost(request: Request): string {
  return requestHost(request);
}

export function publicLegacyBase(request: Request): string {
  if (isPublicHost(requestHost(request))) {
    return `https://${PUBLIC_LEGACY_HOST}`;
  }
  return legacyBase();
}

function publicHeaders(request?: Request): Record<string, string> {
  if (!request) {
    return {};
  }
  const host = requestHost(request);
  return host ? { "X-SDP-Public-Host": host } : {};
}

const API_UNAVAILABLE = "Layanan API tidak tersedia. Coba muat ulang halaman ini.";

export async function fetchApi(url: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch {
    throw data(API_UNAVAILABLE, { status: 503 });
  }
}

export async function acceptLegacyToken(token: string, request?: Request): Promise<string | null> {
  const trimmed = token.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const res = await fetchApi(`${apiBase()}/api/v1/auth/me`, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${trimmed}`,
        ...publicHeaders(request),
      },
    });

    if (!res.ok) {
      return null;
    }

    const body = (await res.json()) as { ok?: boolean };
    return body.ok ? trimmed : null;
  } catch {
    return null;
  }
}

export function apiBase(): string {
  return (process.env.API_BASE_URL ?? "http://127.0.0.1:8081").replace(/\/$/, "");
}

export function legacyBase(): string {
  return (process.env.LEGACY_BASE_URL ?? "http://127.0.0.1:8080").replace(/\/$/, "");
}

export async function apiGet<T>(token: string, path: string, request?: Request): Promise<T> {
  const res = await fetchApi(`${apiBase()}/api/v1${path}`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      ...publicHeaders(request),
    },
  });

  if (res.status === 401) {
    throw redirect("/login");
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

export async function apiPostJson<T>(
  token: string,
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
        Authorization: `Bearer ${token}`,
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

export async function apiDeleteJson<T>(
  token: string,
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
        Authorization: `Bearer ${token}`,
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

export async function apiPutJson<T>(
  token: string,
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
        Authorization: `Bearer ${token}`,
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

export async function fileToPayload(
  file: File | null,
): Promise<{ filename: string; mime: string; base64: string } | null> {
  if (!file || file.size === 0) {
    return null;
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  return {
    filename: file.name,
    mime: file.type,
    base64: buffer.toString("base64"),
  };
}

export async function apiLogin(username: string, password: string, request?: Request) {
  let res: Response;
  try {
    res = await fetchApi(`${apiBase()}/api/v1/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...publicHeaders(request),
      },
      body: JSON.stringify({ username, password }),
    });
  } catch (error) {
    throw error;
  }

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
