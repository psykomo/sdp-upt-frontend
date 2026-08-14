import { redirect } from "react-router";
import { acceptLegacyToken, getToken, tokenCookie } from "../lib/session.server";
import type { Route } from "./+types/auth-legacy";

function safeReturn(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/identitas";
  }
  return value;
}

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const dest = safeReturn(url.searchParams.get("return"));
  const handed = url.searchParams.get("token");

  if (handed) {
    const token = await acceptLegacyToken(handed, request);
    if (!token) {
      throw redirect(`/login?return=${encodeURIComponent(dest)}`);
    }
    throw redirect(dest, {
      headers: { "Set-Cookie": await tokenCookie.serialize(token) },
    });
  }

  if (await getToken(request)) {
    throw redirect(dest);
  }

  throw redirect(`/login?return=${encodeURIComponent(dest)}`);
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const dest = safeReturn(String(form.get("return") ?? "/identitas"));
  const handed = String(form.get("token") ?? "");
  const token = await acceptLegacyToken(handed, request);
  if (!token) {
    throw redirect(`/login?return=${encodeURIComponent(dest)}`);
  }
  throw redirect(dest, {
    headers: { "Set-Cookie": await tokenCookie.serialize(token) },
  });
}
