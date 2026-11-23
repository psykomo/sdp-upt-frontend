import { redirect } from "react-router";
import { apiLogout, fetchLoginOptions, publicLegacyBase } from "../lib/session";
import type { Route } from "./+types/logout";

async function leave(request: Request) {
  await apiLogout(request);

  const from = new URL(request.url).searchParams.get("from");
  if (typeof window !== "undefined") {
    if (from === "legacy") {
      window.location.replace(`${publicLegacyBase(request)}/Welcome`);
      return new Promise<never>(() => {});
    }

    try {
      const options = await fetchLoginOptions(request);
      if (options.hasLegacyHost) {
        const legacyTarget = options.legacyBase || publicLegacyBase(request);
        window.location.replace(`${legacyTarget}/Login/logOut?from=spa`);
        return new Promise<never>(() => {});
      }
    } catch {
      // API unreachable during logout; fall back to SPA /login.
    }
  }

  throw redirect("/login");
}

export async function clientAction({ request }: Route.ClientActionArgs) {
  return leave(request);
}

export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  return leave(request);
}
