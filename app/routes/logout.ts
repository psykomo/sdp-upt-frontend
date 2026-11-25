import { redirect } from "react-router";
import { apiLogout, fetchLoginOptions, publicLegacyBase } from "../lib/session";
import type { Route } from "./+types/logout";

async function leave(request: Request) {
  await apiLogout(request);

  const from = new URL(request.url).searchParams.get("from");
  if (typeof window !== "undefined") {
    let options: Awaited<ReturnType<typeof fetchLoginOptions>> | null = null;
    try {
      options = await fetchLoginOptions(request);
    } catch {
      // API unreachable during logout; fall back below.
    }

    const legacyTarget = options?.legacyBase || publicLegacyBase(request);
    if (from === "legacy") {
      window.location.replace(`${legacyTarget}/Welcome`);
      return new Promise<never>(() => {});
    }

    if (options?.hasLegacyHost && legacyTarget) {
      window.location.replace(`${legacyTarget}/Login/logOut?from=spa`);
      return new Promise<never>(() => {});
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
