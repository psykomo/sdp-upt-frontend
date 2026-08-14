import { createCookie, redirect } from "react-router";

export const tokenCookie = createCookie("sdp_token", {
  httpOnly: true,
  sameSite: "lax",
  path: "/",
  maxAge: 60 * 60 * 8,
  secrets: [process.env.SESSION_SECRET ?? "sdp-frontend-dev-secret"],
});

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
    throw redirect(`/login?return=${encodeURIComponent(url.pathname + url.search)}`);
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

export async function acceptLegacyToken(token: string, request?: Request): Promise<string | null> {
  const trimmed = token.trim();
  if (!trimmed) {
    return null;
  }

  const res = await fetch(`${apiBase()}/api/v1/auth/me`, {
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
}

export function apiBase(): string {
  return (process.env.API_BASE_URL ?? "http://127.0.0.1:8081").replace(/\/$/, "");
}

export function legacyBase(): string {
  return (process.env.LEGACY_BASE_URL ?? "http://127.0.0.1:8080").replace(/\/$/, "");
}

export async function apiGet<T>(token: string, path: string, request?: Request): Promise<T> {
  const res = await fetch(`${apiBase()}/api/v1${path}`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      ...publicHeaders(request),
    },
  });

  if (res.status === 401) {
    throw redirect("/login");
  }

  const body = (await res.json()) as { ok: boolean; message?: string; data?: T };
  if (!res.ok || !body.ok) {
    throw new Response(body.message ?? "Permintaan API gagal.", { status: res.status });
  }

  return body.data as T;
}

export async function apiLogin(username: string, password: string, request?: Request) {
  const res = await fetch(`${apiBase()}/api/v1/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...publicHeaders(request),
    },
    body: JSON.stringify({ username, password }),
  });

  const body = (await res.json()) as {
    ok: boolean;
    message?: string;
    data?: { token: string; user: Record<string, unknown> };
  };

  if (!res.ok || !body.ok || !body.data?.token) {
    throw new Error(body.message ?? "Login gagal.");
  }

  return body.data;
}
