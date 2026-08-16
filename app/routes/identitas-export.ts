import { fetchApi, apiBase, publicRequestHost, requireToken } from "../lib/session.server";
import type { Route } from "./+types/identitas-export";

export async function loader({ request }: Route.LoaderArgs) {
  const token = await requireToken(request);
  const url = new URL(request.url);
  const res = await fetchApi(`${apiBase()}/api/v1/identitas/export?${url.searchParams.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-SDP-Public-Host": publicRequestHost(request),
    },
  });

  if (!res.ok) {
    throw new Response("Gagal mengekspor data.", { status: res.status });
  }

  const filename =
    res.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ??
    "pencarian-identitas.csv";

  return new Response(res.body, {
    headers: {
      "Content-Type": "text/csv; charset=UTF-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
