import { redirect } from "react-router";
import { getToken } from "../lib/session.server";
import type { Route } from "./+types/home";

export async function loader({ request }: Route.LoaderArgs) {
  const token = await getToken(request);
  throw redirect(token ? "/identitas" : "/login");
}

export default function Home() {
  return null;
}
