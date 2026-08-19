import { Form, Link, data, redirect, useNavigation, isRouteErrorResponse } from "react-router";
import { useState, type ReactNode } from "react";
import {
  apiDeleteJson,
  apiGet,
  apiPostJson,
  clearHapusGrant,
  failData,
  getHapusGrant,
  isApiFail,
  setHapusGrant,
} from "../lib/session";
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
export function meta({ loaderData }: Route.MetaArgs) {
  const nama = loaderData?.namaLengkap ? ` — ${loaderData.namaLengkap}` : "";
  return [{ title: `Hapus Identitas${nama} — SDP 4.0` }];
}

export async function clientLoader({ request, params }: Route.ClientLoaderArgs) {
  const noin = params.nomorInduk;
  const [detail, me] = await Promise.all([
    apiGet<IdentityDetail>(`/identitas/${encodeURIComponent(noin)}`, request),
    apiGet<Me>("/auth/me", request),
  ]);

  if (!detail.access.canDelete) {
    throw data("Mohon maaf anda tidak berhak menghapus data identitas.", { status: 403 });
  }

  const stored = getHapusGrant();
  const supervisorOk =
    !!stored && stored.officerId === me.user.id && stored.nomorInduk === noin;

  return {
    ...detail,
    supervisorOk,
    supervisorName: supervisorOk ? stored.supervisorName : null,
  } satisfies HapusPage;
}

export async function clientAction({ request, params }: Route.ClientActionArgs) {
  const noin = params.nomorInduk;
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "delete");

  if (intent === "supervisor") {
    const me = await apiGet<Me>("/auth/me", request);
    const result = await apiPostJson<{
      grant: string;
      supervisor: { id: string; name: string };
    }>(
      "/auth/supervisor",
      {
        username: String(form.get("username") ?? ""),
        password: String(form.get("password") ?? ""),
        nomorInduk: noin,
      },
      request,
    );

    if (isApiFail(result)) {
      return failData(result);
    }

    const issued = result as { grant: string; supervisor: { id: string; name: string } };
    setHapusGrant({
      grant: issued.grant,
      officerId: me.user.id,
      nomorInduk: noin,
      supervisorName: issued.supervisor.name,
    });
    throw redirect(`/identitas/${encodeURIComponent(noin)}/hapus`);
  }

  const stored = getHapusGrant();
  if (!stored || stored.nomorInduk !== noin) {
    return data(
      { ok: false as const, message: "Halaman ini memerlukan autentikasi dari supervisor." },
      { status: 403 },
    );
  }

  const result = await apiDeleteJson<{ nomorInduk: string }>(
    `/identitas/${encodeURIComponent(noin)}`,
    request,
    stored.grant,
  );

  if (isApiFail(result)) {
    return failData(result);
  }

  clearHapusGrant();
  throw redirect(`/identitas?field=no_induk&q=${encodeURIComponent(noin)}&activeOnly=0`);
}

function hasOpenPerkara(d: IdentityDetail): boolean {
  const berkas = (d.case.nomorBerkas ?? "").trim();
  return berkas !== "" && berkas !== "-";
}

export default function IdentitasHapusPage({ loaderData, actionData }: Route.ComponentProps) {
  const d = loaderData;
  const navigation = useNavigation();
  const submitting = navigation.state === "submitting";
  const blocked = hasOpenPerkara(d);
  const status = d.case.statusSubPenghuni || d.case.statusPenghuni || "Aktif";

  return (
    <main className="modern-page-shell detail-container">
      {/* 1. Header Navigation & Breadcrumbs */}
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

      {/* 2. Executive Hero Profile Card */}
      <header className="detail-hero-card">
        <div className="hero-left-section">
          <HeroAvatar src={d.foto.depan} name={d.namaLengkap} nomorInduk={d.nomorInduk} />

          <div className="hero-info-stack">
            <div className="hero-title-row">
              <h1 className="hero-wbp-name">{d.namaLengkap || "—"}</h1>
              <div className="hero-status-pills">
                {d.isTahanan ? (
                  <span className="tag-pill tag-tahanan">Tahanan</span>
                ) : (
                  <span className="tag-pill tag-napi">Narapidana</span>
                )}
                {d.supervisorOk ? (
                  <span className="status-badge status-verified">
                    <Icon name="shield-check" size={12} />
                    <span>Otorisasi Disetujui</span>
                  </span>
                ) : (
                  <span className="status-badge status-unverified">
                    <Icon name="lock" size={12} />
                    <span>Menunggu Otorisasi</span>
                  </span>
                )}
              </div>
            </div>

            <div className="hero-id-tags-row">
              <div className="id-tag-item">
                <span className="id-tag-label">No. Induk</span>
                <code className="monospace-id-tag">{d.nomorInduk}</code>
              </div>
              {d.case.nomorRegistrasi && d.case.nomorRegistrasi !== "-" ? (
                <div className="id-tag-item">
                  <span className="id-tag-label">No. Registrasi</span>
                  <code className="monospace-reg-tag">{d.case.nomorRegistrasi}</code>
                </div>
              ) : null}
            </div>

            <div className="hero-chips-row">
              {d.case.jenisRegistrasi && d.case.jenisRegistrasi !== "-" ? (
                <span className="meta-chip">
                  <Icon name="layers" size={13} />
                  <span>
                    Registrasi: <strong>{d.case.jenisRegistrasi}</strong>
                  </span>
                </span>
              ) : null}
              {d.case.kejahatan && d.case.kejahatan !== "-" ? (
                <span className="meta-chip chip-warning">
                  <Icon name="activity" size={13} />
                  <span>
                    Kejahatan: <strong>{d.case.kejahatan}</strong>
                  </span>
                </span>
              ) : null}
              {status ? (
                <span className="meta-chip">
                  <Icon name="users" size={13} />
                  <span>
                    Status: <strong>{status}</strong>
                  </span>
                </span>
              ) : null}
              <span className="meta-chip chip-danger">
                <Icon name="trash" size={13} />
                <span>Operasi Penghapusan Data</span>
              </span>
            </div>
          </div>
        </div>

        {/* Hero Actions Cluster */}
        <div className="hero-actions-section">
          <div className="hero-action-buttons">
            <Link to={`/identitas/${d.nomorInduk}`} className="btn btn-secondary">
              <Icon name="eye" size={14} />
              <span>Lihat Profil Lengkap</span>
            </Link>
          </div>
        </div>
      </header>

      {/* 3. Main Security / Action Layout */}
      <div className="hapus-main-layout">
        {/* Primary Action Card */}
        <section className="hapus-card">
          {!d.supervisorOk ? (
            /* State A: Dual Password Supervisor Auth Required */
            <>
              <header className="hapus-card-header header-warning">
                <div className="hapus-header-left">
                  <div className="hapus-header-icon-box icon-warning">
                    <Icon name="lock" size={20} />
                  </div>
                  <div className="hapus-header-text-group">
                    <h2 className="hapus-header-title">Otorisasi Supervisor Diperlukan (Dual Password)</h2>
                    <p className="hapus-header-subtitle">
                      Masukkan kredensial akun supervisor untuk memvalidasi izin penghapusan data WBP.
                    </p>
                  </div>
                </div>
              </header>

              <div className="hapus-card-body">
                <div className="hapus-callout hapus-callout-warning">
                  <Icon name="shield-alert" size={20} />
                  <div className="hapus-callout-content">
                    <strong>Prosedur Keamanan Tingkat Tinggi</strong>
                    <p>
                      Penghapusan data identitas WBP merupakan tindakan permanen. Sesuai SOP keamanan SDP 4.0,
                      tindakan ini memerlukan autentikasi ganda (dual password) oleh Supervisor / Pejabat Berwenang.
                    </p>
                  </div>
                </div>

                {actionData?.message ? (
                  <div className="form-alert" role="alert">
                    <Icon name="alert-triangle" size={18} />
                    <div className="form-alert-content">
                      <strong>Gagal Melakukan Otorisasi</strong>
                      <p>{actionData.message}</p>
                    </div>
                  </div>
                ) : null}

                <Form method="post" className="hapus-supervisor-form">
                  <input type="hidden" name="intent" value="supervisor" />

                  <div className="form-grid-2col">
                    <div className="form-group-field">
                      <div className="form-field-header">
                        <span className="form-field-label-text">
                          Username Supervisor <span className="text-required-mark">*</span>
                        </span>
                      </div>
                      <input
                        name="username"
                        type="text"
                        autoComplete="username"
                        autoFocus
                        required
                        placeholder="Contoh: supervisor123"
                        className="form-modern-input"
                      />
                      <span className="form-field-helper-txt">Akun dengan wewenang supervisor</span>
                    </div>

                    <div className="form-group-field">
                      <div className="form-field-header">
                        <span className="form-field-label-text">
                          Password Supervisor <span className="text-required-mark">*</span>
                        </span>
                      </div>
                      <input
                        name="password"
                        type="password"
                        autoComplete="current-password"
                        required
                        placeholder="••••••••••••"
                        className="form-modern-input"
                      />
                      <span className="form-field-helper-txt">Kata sandi akun supervisor</span>
                    </div>
                  </div>

                  <div className="hapus-form-actions">
                    <button type="submit" className="btn btn-primary" disabled={submitting}>
                      <Icon name="lock" size={14} />
                      <span>{submitting ? "Memeriksa Kredensial…" : "Verifikasi Otorisasi Supervisor"}</span>
                    </button>
                    <Link to={`/identitas/${d.nomorInduk}`} className="btn btn-secondary">
                      Batal
                    </Link>
                  </div>
                </Form>
              </div>
            </>
          ) : blocked ? (
            /* State B: Supervisor Approved but Blocked by Active Case */
            <>
              <header className="hapus-card-header header-danger">
                <div className="hapus-header-left">
                  <div className="hapus-header-icon-box icon-danger">
                    <Icon name="alert-triangle" size={20} />
                  </div>
                  <div className="hapus-header-text-group">
                    <h2 className="hapus-header-title">Penghapusan Ditolak Sistem</h2>
                    <p className="hapus-header-subtitle">
                      Data identitas tidak dapat dihapus karena masih memiliki keterkaitan berkas perkara.
                    </p>
                  </div>
                </div>
              </header>

              <div className="hapus-card-body">
                <div className="hapus-callout hapus-callout-danger">
                  <Icon name="alert-triangle" size={20} />
                  <div className="hapus-callout-content">
                    <strong>Perkara Masih Terdaftar (No. Berkas: {d.case.nomorBerkas})</strong>
                    <p>
                      Mohon maaf data identitas tidak dapat dihapus karena masih memiliki data perkara,
                      silahkan hapus perkara terlebih dahulu di modul registrasi perkara.
                    </p>
                  </div>
                </div>

                <div className="hapus-summary-box">
                  <h3 className="hapus-summary-title">Ringkasan Berkas Terkait</h3>
                  <div className="grid-data-2col">
                    <FieldItem label="Nomor Berkas" value={d.case.nomorBerkas} mono highlight />
                    <FieldItem label="Nomor Registrasi" value={d.case.nomorRegistrasi || "—"} mono />
                    <FieldItem label="Jenis Registrasi" value={d.case.jenisRegistrasi || "—"} />
                    <FieldItem label="Tindak Pidana / Kejahatan" value={d.case.kejahatan || "—"} />
                  </div>
                </div>

                <div className="hapus-form-actions">
                  <Link to={`/identitas/${d.nomorInduk}`} className="btn btn-secondary">
                    <Icon name="arrow-left" size={14} />
                    <span>Kembali ke Detail WBP</span>
                  </Link>
                </div>
              </div>
            </>
          ) : (
            /* State C: Supervisor Approved & Ready to Delete */
            <>
              <header className="hapus-card-header header-danger">
                <div className="hapus-header-left">
                  <div className="hapus-header-icon-box icon-danger">
                    <Icon name="trash" size={20} />
                  </div>
                  <div className="hapus-header-text-group">
                    <h2 className="hapus-header-title">Konfirmasi Penghapusan Identitas WBP</h2>
                    <p className="hapus-header-subtitle">
                      Otorisasi supervisor valid. Tinjau kembali ringkasan data sebelum melakukan tindakan permanen.
                    </p>
                  </div>
                </div>
              </header>

              <div className="hapus-card-body">
                {d.supervisorName ? (
                  <div className="hapus-callout hapus-callout-success">
                    <Icon name="shield-check" size={20} />
                    <div className="hapus-callout-content">
                      <strong>Otorisasi Supervisor Terverifikasi</strong>
                      <p>Tindakan penghapusan ini telah disetujui oleh supervisor: <strong>{d.supervisorName}</strong>.</p>
                    </div>
                  </div>
                ) : null}

                <div className="hapus-callout hapus-callout-danger">
                  <Icon name="alert-triangle" size={20} />
                  <div className="hapus-callout-content">
                    <strong>PERINGATAN: Tindakan Ini Bersifat Permanen!</strong>
                    <p>
                      Seluruh berkas identitas, biodata, catatan keluarga, riwayat fisik, dan data biometrik
                      untuk WBP ini akan dihapus permanen dari basis data SDP 4.0 dan tidak dapat dipulihkan.
                    </p>
                  </div>
                </div>

                {actionData?.message ? (
                  <div className="form-alert" role="alert">
                    <Icon name="alert-triangle" size={18} />
                    <div className="form-alert-content">
                      <strong>Gagal Menghapus Data</strong>
                      <p>{actionData.message}</p>
                    </div>
                  </div>
                ) : null}

                <div className="hapus-summary-box">
                  <h3 className="hapus-summary-title">Data WBP yang Akan Dihapus</h3>
                  <div className="grid-data-2col">
                    <FieldItem label="Nama Lengkap" value={d.namaLengkap || "—"} highlight />
                    <FieldItem label="Nomor Induk" value={d.nomorInduk} mono highlight />
                    <FieldItem label="Nomor Registrasi" value={d.case.nomorRegistrasi || "—"} mono />
                    <FieldItem label="Jenis Registrasi" value={d.case.jenisRegistrasi || "—"} />
                    <FieldItem label="Tindak Pidana" value={d.case.kejahatan || "—"} />
                    <FieldItem label="Status Penghuni" value={status} />
                  </div>
                </div>

                <Form method="post" className="hapus-confirm-form">
                  <input type="hidden" name="intent" value="delete" />

                  <div className="hapus-form-actions">
                    <button type="submit" className="btn-danger-action" disabled={submitting}>
                      <Icon name="trash" size={15} />
                      <span>{submitting ? "Menghapus Data Identitas…" : "Hapus Data Identitas Permanen"}</span>
                    </button>
                    <Link to={`/identitas/${d.nomorInduk}`} className="btn btn-secondary">
                      Batal
                    </Link>
                  </div>
                </Form>
              </div>
            </>
          )}
        </section>

        {/* Side Security Protocol Card */}
        <aside className="hapus-protocol-card">
          <header className="protocol-header">
            <Icon name="shield" size={16} />
            <h4>Protokol Keamanan SDP</h4>
          </header>
          <div className="protocol-body">
            <div className="protocol-step-item">
              <span className="protocol-step-number">1</span>
              <div className="protocol-step-info">
                <strong className="protocol-step-title">Otorisasi Berlapis (Dual Password)</strong>
                <p className="protocol-step-desc">
                  Mencegah penghapusan sepihak dengan mewajibkan verifikasi kredensial supervisor berwenang.
                </p>
              </div>
            </div>

            <div className="protocol-step-item">
              <span className="protocol-step-number">2</span>
              <div className="protocol-step-info">
                <strong className="protocol-step-title">Validasi Integritas Berkas Perkara</strong>
                <p className="protocol-step-desc">
                  Sistem memastikan tidak ada rekaman perkara aktif yang tertinggal sebelum data identitas dihapus.
                </p>
              </div>
            </div>

            <div className="protocol-step-item">
              <span className="protocol-step-number">3</span>
              <div className="protocol-step-info">
                <strong className="protocol-step-title">Audit Trail & Rekam Log</strong>
                <p className="protocol-step-desc">
                  Setiap aktivitas penghapusan dicatat secara otomatis ke dalam log audit sistem demi akuntabilitas.
                </p>
              </div>
            </div>
          </div>
        </aside>
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
    <main className="modern-page-shell detail-container">
      <nav className="detail-top-nav" aria-label="Navigasi Halaman">
        <Link to="/identitas" className="btn-back-link">
          <Icon name="arrow-left" size={14} />
          <span>Kembali ke Direktori Identitas</span>
        </Link>
      </nav>

      <div className="hapus-card" style={{ maxWidth: 640, margin: "24px auto" }}>
        <header className="hapus-card-header header-danger">
          <div className="hapus-header-left">
            <div className="hapus-header-icon-box icon-danger">
              <Icon name="alert-triangle" size={20} />
            </div>
            <div className="hapus-header-text-group">
              <h2 className="hapus-header-title">
                {notFound
                  ? "Data WBP Tidak Ditemukan"
                  : forbidden
                  ? "Akses Ditolak — Hak Akses Tidak Memadai"
                  : "Gagal Memuat Identitas"}
              </h2>
              <p className="hapus-header-subtitle">
                {forbidden
                  ? "Akun Anda tidak memiliki izin untuk melakukan tindakan ini."
                  : "Terjadi kesalahan saat memproses permintaan."}
              </p>
            </div>
          </div>
        </header>
        <div className="hapus-card-body">
          <p className="empty-desc">{message}</p>
          <div className="hapus-form-actions">
            <Link to="/identitas" className="btn btn-secondary">
              <Icon name="arrow-left" size={14} />
              <span>Kembali ke Direktori Identitas</span>
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

// -------------------------------------------------------------
// Helper Components & Formatters
// -------------------------------------------------------------
function HeroAvatar({
  src,
  name,
  nomorInduk,
}: {
  src: string | null | undefined;
  name: string | null;
  nomorInduk: string;
}) {
  const [hasError, setHasError] = useState(!src);

  return (
    <div className="hero-avatar-frame">
      {src && !hasError ? (
        <img
          src={src}
          alt=""
          onError={() => setHasError(true)}
          className="hero-avatar-img"
          loading="lazy"
        />
      ) : (
        <div className="hero-avatar-placeholder">
          <div className="hero-initials-badge">{getInitials(name)}</div>
          <span className="hero-placeholder-label">Foto Belum Rekam</span>
        </div>
      )}
      <div className="hero-photo-tag">Foto Utama</div>
    </div>
  );
}

function FieldItem({
  label,
  value,
  mono = false,
  highlight = false,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="data-field-box">
      <span className="field-box-label">{label}</span>
      <span className={`field-box-value ${mono ? "monospace" : ""} ${highlight ? "highlight" : ""}`}>
        {value || "—"}
      </span>
    </div>
  );
}

function getInitials(name?: string | null): string {
  if (!name) return "—";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "—";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

type IconName =
  | "activity"
  | "alert-triangle"
  | "arrow-left"
  | "eye"
  | "layers"
  | "lock"
  | "shield"
  | "shield-alert"
  | "shield-check"
  | "trash"
  | "users";

function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  let paths: ReactNode;
  switch (name) {
    case "activity":
      paths = <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />;
      break;
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
    case "eye":
      paths = (
        <>
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </>
      );
      break;
    case "layers":
      paths = (
        <>
          <polygon points="12 2 2 7 12 12 22 7 12 2" />
          <polyline points="2 17 12 22 22 17" />
          <polyline points="2 12 12 17 22 12" />
        </>
      );
      break;
    case "lock":
      paths = (
        <>
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </>
      );
      break;
    case "shield":
      paths = <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />;
      break;
    case "shield-alert":
      paths = (
        <>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </>
      );
      break;
    case "shield-check":
      paths = (
        <>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path d="m9 12 2 2 4-4" />
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
    case "users":
      paths = (
        <>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
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

