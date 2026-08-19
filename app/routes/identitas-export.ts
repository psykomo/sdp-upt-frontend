import { data, redirect } from "react-router";
import { apiBase, fetchApi, publicHeaders, requireToken } from "../lib/session";
import type { Route } from "./+types/identitas-export";

export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  await requireToken(request);
  const url = new URL(request.url);
  const res = await fetchApi(`${apiBase()}/api/v1/identitas/export?${url.searchParams.toString()}`, {
    headers: {
      ...publicHeaders(request),
    },
  });

  if (!res.ok) {
    throw data("Gagal mengekspor data.", { status: res.status });
  }

  const filename =
    res.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ??
    "pencarian-identitas.csv";

  const blob = await res.blob();
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(href);

  url.pathname = "/identitas";
  throw redirect(`${url.pathname}${url.search}`);
}
