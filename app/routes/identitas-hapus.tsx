import { Form, Link, redirect, useActionData, useNavigation, isRouteErrorResponse } from "react-router";
import type { ReactNode } from "react";
import {
  apiDeleteJson,
  apiGet,
  apiPostJson,
  getHapusGrant,
  hapusGrantCookie,
  requireToken,
} from "../lib/session.server";
import type { Route } from "./+types/identitas-hapus";

type Access = { level: string; canWrite: boolean; canDelete: boolean; canPrint: boolean };
type CaseView = {
  nomorBerkas: string;
  nomorRegistrasi: string;
  jenisRegistrasi: string;
  kejahatan: string;
  statusPenghuni: string;
  statusSubPenghuni: string;
};
type IdentityDetail = {
  nomorInduk: string;
  namaLengkap: string | null;
  isTahanan: boolean;
  access: Access;
  case: CaseView;
  foto: { depan: string | null };
};
type Me = { user: { id: string } };
type HapusPage = IdentityDetail & {
  supervisorOk: boolean;
  supervisorName: string | null;
};
type ActionResult = { ok: false; message: string };

export function meta({ loaderData }: Route.MetaArgs) {
  const nama = loaderData?.namaLengkap ? ` — ${loaderData.namaLengkap}` : "";
  return [{ title: `Hapus Identitas${nama} — SDP 4.0` }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const token = await requireToken(request);
  const noin = params.nomorInduk;
  const [detail, me] = await Promise.all([
    apiGet<IdentityDetail>(token, `/identitas/${encodeURIComponent(noin)}`, request),
    apiGet<Me>(token, "/auth/me", request),
  ]);

  if (!detail.access.canDelete) {
    throw new Response("Mohon maaf anda tidak berhak menghapus data identitas.", { status: 403 });
  }

  const stored = await getHapusGrant(request);
  const supervisorOk =
    !!stored && stored.officerId === me.user.id && stored.nomorInduk === noin;

  return {
    ...detail,
    supervisorOk,
    supervisorName: supervisorOk ? stored.supervisorName : null,
  } satisfies HapusPage;
}

export async function action({ request, params }: Route.ActionArgs) {
  const token = await requireToken(request);
  const noin = params.nomorInduk;
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "delete");

  if (intent === "supervisor") {
    const me = await apiGet<Me>(token, "/auth/me", request);
    const result = await apiPostJson<{
      grant: string;
      supervisor: { id: string; name: string };
    }>(
      token,
      "/auth/supervisor",
      {
        username: String(form.get("username") ?? ""),
        password: String(form.get("password") ?? ""),
        nomorInduk: noin,
      },
      request,
    );

    if (result && typeof result === "object" && "ok" in result && result.ok === false) {
      return result satisfies ActionResult;
    }

    const issued = result as { grant: string; supervisor: { id: string; name: string } };
    throw redirect(`/identitas/${encodeURIComponent(noin)}/hapus`, {
      headers: {
        "Set-Cookie": await hapusGrantCookie.serialize({
          grant: issued.grant,
          officerId: me.user.id,
          nomorInduk: noin,
          supervisorName: issued.supervisor.name,
        }),
      },
    });
  }

  const stored = await getHapusGrant(request);
  if (!stored || stored.nomorInduk !== noin) {
    return {
      ok: false as const,
      message: "Halaman ini memerlukan autentikasi dari supervisor.",
    };
  }

  const result = await apiDeleteJson<{ nomorInduk: string }>(
    token,
    `/identitas/${encodeURIComponent(noin)}`,
    request,
    stored.grant,
  );

  if (result && typeof result === "object" && "ok" in result && result.ok === false) {
    return result satisfies ActionResult;
  }

  throw redirect(`/identitas?field=no_induk&q=${encodeURIComponent(noin)}&activeOnly=0`, {
    headers: {
      "Set-Cookie": await hapusGrantCookie.serialize("", { maxAge: 0 }),
    },
  });
}

function hasOpenPerkara(d: IdentityDetail): boolean {
  const berkas = (d.case.nomorBerkas ?? "").trim();
  return berkas !== "" && berkas !== "-";
}

export default function IdentitasHapusPage({ loaderData }: Route.ComponentProps) {
  const d = loaderData;
  const actionData = useActionData<ActionResult>();
  const navigation = useNavigation();
  const submitting = navigation.state === "submitting";
  const blocked = hasOpenPerkara(d);
  const blockMessage =
    "Mohon maaf data identitas tidak dapat dihapus karena masih memiliki data perkara, silahkan hapus perkara terlebih dahulu.";

  return (
    <main className="modern-page-shell detail-container">
      <nav className="detail-top-nav" aria-label="Navigasi Halaman">
        <Link to={`/identitas/${d.nomorInduk}`} className="btn-back-link">
          <Icon name="arrow-left" size={14} />
          <span>Kembali ke Detail WBP</span>
        </Link>
        <div className="detail-breadcrumbs">
          <span>SDP 4.0</span>
          <span className="separator">/</span>
          <Link to="/identitas">Manajemen Identitas</Link>
          <span className="separator">/</span>
          <Link to={`/identitas/${d.nomorInduk}`}>Detail WBP</Link>
          <span className="separator">/</span>
          <span className="current">Hapus Identitas</span>
        </div>
      </nav>

      <div className="empty-state-box">
        <div className="empty-icon-circle error-icon">
          <Icon name={d.supervisorOk ? "trash" : "lock"} size={22} />
        </div>
        <h1 className="empty-title">
          {d.supervisorOk ? "Hapus identitas?" : "Login dual password"}
        </h1>
        <p className="empty-desc">
          <strong>{d.namaLengkap || "—"}</strong>
          <br />
          Nomor induk <code>{d.nomorInduk}</code>
          {d.case.nomorRegistrasi && d.case.nomorRegistrasi !== "-" ? (
            <>
              <br />
              Registrasi {d.case.nomorRegistrasi}
            </>
          ) : null}
        </p>

        {d.supervisorOk ? null : (
          <p className="empty-desc">Halaman ini memerlukan autentikasi dari supervisor.</p>
        )}

        {d.supervisorOk && d.supervisorName ? (
          <p className="empty-desc">Disetujui supervisor {d.supervisorName}.</p>
        ) : null}

        {d.supervisorOk && blocked ? (
          <p className="login-error" role="alert">
            {blockMessage}
          </p>
        ) : null}

        {actionData?.message ? (
          <p className="login-error" role="alert">
            {actionData.message}
          </p>
        ) : null}

        {d.supervisorOk ? (
          <div className="hero-action-buttons" style={{ justifyContent: "center" }}>
            {blocked ? null : (
              <Form method="post">
                <input type="hidden" name="intent" value="delete" />
                <button type="submit" className="btn btn-danger-outline" disabled={submitting}>
                  <Icon name="trash" size={14} />
                  <span>{submitting ? "Menghapus…" : "Hapus"}</span>
                </button>
              </Form>
            )}
            <Link to={`/identitas/${d.nomorInduk}`} className="btn btn-secondary">
              Batal
            </Link>
          </div>
        ) : (
          <Form method="post" className="login-form">
            <input type="hidden" name="intent" value="supervisor" />
            <label className="login-field">
              Username
              <input name="username" autoComplete="username" autoFocus required />
            </label>
            <label className="login-field">
              Password
              <input name="password" type="password" autoComplete="current-password" required />
            </label>
            <div className="hero-action-buttons" style={{ justifyContent: "center" }}>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                <span>{submitting ? "Memeriksa…" : "Login"}</span>
              </button>
              <Link to={`/identitas/${d.nomorInduk}`} className="btn btn-secondary">
                Batal
              </Link>
            </div>
          </Form>
        )}
      </div>
    </main>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  const forbidden = isRouteErrorResponse(error) && error.status === 403;
  const message = isRouteErrorResponse(error)
    ? String(error.data || error.statusText)
    : "Terjadi kesalahan saat memuat data identitas.";

  return (
    <main className="modern-page-shell">
      <div className="empty-state-box error-box">
        <div className="empty-icon-circle error-icon">
          <Icon name="alert-triangle" size={24} />
        </div>
        <h3 className="empty-title">
          {notFound ? "Data WBP Tidak Ditemukan" : forbidden ? "Tidak berhak menghapus" : "Gagal Memuat Identitas"}
        </h3>
        <p className="empty-desc">{message}</p>
        <Link to="/identitas" className="btn btn-secondary">
          <Icon name="arrow-left" size={14} />
          <span>Kembali ke Direktori Identitas</span>
        </Link>
      </div>
    </main>
  );
}

type IconName = "alert-triangle" | "arrow-left" | "lock" | "trash";

function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  let paths: ReactNode;
  switch (name) {
    case "alert-triangle":
      paths = (
        <>
          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </>
      );
      break;
    case "arrow-left":
      paths = (
        <>
          <line x1="19" y1="12" x2="5" y2="12" />
          <polyline points="12 19 5 12 12 5" />
        </>
      );
      break;
    case "lock":
      paths = (
        <>
          <rect x="4" y="11" width="16" height="10" rx="2" />
          <path d="M8 11V8a4 4 0 0 1 8 0v3" />
        </>
      );
      break;
    case "trash":
      paths = (
        <>
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </>
      );
      break;
  }

  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths}
    </svg>
  );
}
