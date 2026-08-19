import { redirect } from "react-router";
import { acceptLegacyToken, hasSession } from "../lib/session";
import type { Route } from "./+types/auth-legacy";

function safeReturn(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/identitas";
  }
  return value;
}

async function handOver(request: Request, token: string | null, dest: string) {
  if (token) {
    const ok = await acceptLegacyToken(token, request);
    if (!ok) {
      throw redirect(`/login?return=${encodeURIComponent(dest)}`);
    }
    throw redirect(dest);
  }

  if (await hasSession(request)) {
    throw redirect(dest);
  }

  throw redirect(`/login?return=${encodeURIComponent(dest)}`);
}

function takeHandoverToken(request: Request): { token: string | null; dest: string } {
  const url = new URL(request.url);
  let token = url.searchParams.get("token");
  let dest = safeReturn(url.searchParams.get("return"));

  if (typeof sessionStorage !== "undefined") {
    if (!token) {
      token = sessionStorage.getItem("sdp_handover_token");
    }
    if (!url.searchParams.get("return")) {
      dest = safeReturn(sessionStorage.getItem("sdp_handover_return"));
    }
    sessionStorage.removeItem("sdp_handover_token");
    sessionStorage.removeItem("sdp_handover_return");
  }

  return { token, dest };
}

export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  const { token, dest } = takeHandoverToken(request);
  return handOver(request, token, dest);
}

export async function clientAction({ request }: Route.ClientActionArgs) {
  const form = await request.formData();
  const dest = safeReturn(String(form.get("return") ?? "/identitas"));
  return handOver(request, String(form.get("token") ?? ""), dest);
}
