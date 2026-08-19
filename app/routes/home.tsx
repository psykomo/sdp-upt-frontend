import { redirect } from "react-router";
import { hasSession } from "../lib/session";
import type { Route } from "./+types/home";

export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  throw redirect((await hasSession(request)) ? "/identitas" : "/login");
}

export default function Home() {
  return null;
}
