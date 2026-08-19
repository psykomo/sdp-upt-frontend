import { redirect } from "react-router";
import { apiLogout } from "../lib/session";
import type { Route } from "./+types/logout";

async function leave(request: Request) {
  await apiLogout(request);
  throw redirect("/login");
}

export async function clientAction({ request }: Route.ClientActionArgs) {
  return leave(request);
}

export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  return leave(request);
}
