import { Form, Link, useSearchParams } from "react-router";
import { useState, type ReactNode } from "react";
import { apiGet, publicLegacyBase, requireToken } from "../lib/session.server";
import type { Route } from "./+types/identitas";

type LookupItem = { id: string; label: string };
type Access = { level: string; canWrite: boolean; canDelete: boolean; canPrint: boolean };
type CaseView = {
  nomorBerkas: string;
  nomorRegistrasi: string;
  jenisRegistrasi: string;
  kejahatan: string;
  tglMulaiDitahan: string;
  tglEkspirasi: string;
  sisaPidana: string;
  tanggalMasukLapas: string;
  tempatLokasiSel: string;
  statusPenghuni: string;
  statusSubPenghuni: string;
};
type IdentityItem = {
  nomorInduk: string;
  nomorRegistrasi: string | null;
  tanggalMasukUpt: string | null;
  namaLengkap: string | null;
  tanggalLahir: string | null;
  alamat: string | null;
  agama: string | null;
  asalUpt: string | null;
  verifikasi: string;
  jenisKelamin: string | null;
  wargaNegara: string | null;
  isTahanan: boolean;
  fotoDepanUrl: string | null;
  links: {
    lihat: string;
    ubah: string;
    hapus: string;
    cetakIdentitas: string;
    cetakTahanan: string;
    cetakSidikJari: string;
    tambah: string;
  };
  case?: CaseView;
};
type SearchResult = {
  items: IdentityItem[];
  pagination: { page: number; perPage: number; total: number };
  query: {
    field: string;
    q: string;
    photoStatus: string;
    fingerprintStatus: string;
    activeOnly: boolean;
    recidivistOnly: boolean;
    mode: string;
    sort: string;
    order: string;
  };
  access: Access;
  columns: string[];
};

const FIELDS = [
  { value: "nama", label: "Nama" },
  { value: "no_induk", label: "No Induk" },
  { value: "tgl", label: "Tgl lahir" },
  { value: "usia", label: "Usia" },
  { value: "alamat", label: "Alamat" },
  { value: "jk", label: "Jenis Kelamin" },
  { value: "wg", label: "Kewarganegaraan" },
  { value: "agama", label: "Agama" },
  { value: "pendidikan", label: "Pendidikan" },
  { value: "uu", label: "Undang Undang" },
  { value: "ver", label: "Verifikasi" },
  { value: "res", label: "WBP Beresiko Tinggi" },
  { value: "ruh", label: "Pengaruh Terhadap Masyarakat" },
  { value: "no_reg", label: "No. Registrasi" },
  { value: "tgl_msk_lapas", label: "Tgl Msk UPT" },
] as const;

const COLUMN_LABELS: Record<string, string> = {
  nomorInduk: "No Induk",
  nomorRegistrasi: "No. Registrasi",
  tanggalMasukUpt: "Tgl Msk UPT",
  namaLengkap: "Nama",
  tanggalLahir: "Tgl Lahir",
  alamat: "Alamat",
  agama: "Agama",
  asalUpt: "Asal UPT",
  verifikasi: "Verifikasi",
};

const SORT_KEYS: Record<string, string> = {
  nomorInduk: "noin",
  nomorRegistrasi: "NMR_REG_GOL",
  tanggalMasukUpt: "TGL_MSK_LAPAS",
  namaLengkap: "NAMA_LENGKAP",
  tanggalLahir: "TANGGAL_LAHIR",
  alamat: "ALAMAT",
  agama: "agama",
  asalUpt: "URAIAN",
  verifikasi: "konsol",
};

export function meta() {
  return [{ title: "Manajemen Identitas — SDP" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const token = await requireToken(request);
  const url = new URL(request.url);
  const params = url.searchParams;

  if (!params.has("field")) {
    params.set("activeOnly", "1");
    params.set("field", "nama");
    params.set("mode", "grid");
  }

  const [result, agama, pendidikan] = await Promise.all([
    apiGet<SearchResult>(token, `/identities?${params.toString()}`, request),
    apiGet<{ items: LookupItem[] }>(token, "/lookups/agama", request),
    apiGet<{ items: LookupItem[] }>(token, "/lookups/pendidikan", request),
  ]);

  return {
    result,
    agama: agama.items,
    pendidikan: pendidikan.items,
    legacyBase: publicLegacyBase(request),
  };
}

function lastParam(params: URLSearchParams, key: string, fallback: string) {
  const all = params.getAll(key);
  return all.length > 0 ? all[all.length - 1] : fallback;
}

function qs(current: URLSearchParams, patch: Record<string, string | number | undefined>) {
  const next = new URLSearchParams(current);
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined || value === "") next.delete(key);
    else next.set(key, String(value));
  }
  if (patch.sort || patch.order || patch.field || patch.q !== undefined) {
    if (!("page" in patch)) next.set("page", "1");
  }
  return `?${next.toString()}`;
}

export default function IdentitasPage({ loaderData }: Route.ComponentProps) {
  const { result, agama, pendidikan, legacyBase } = loaderData;
  const [params] = useSearchParams();
  const field = lastParam(params, "field", "nama");
  const mode = lastParam(params, "mode", "grid");
  const [fieldState, setFieldState] = useState(field);
  const { items, pagination, access, columns } = result;
  const from = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.perPage + 1;
  const to = Math.min(pagination.page * pagination.perPage, pagination.total);
  const pages = Math.max(1, Math.ceil(pagination.total / pagination.perPage));
  const activeOnly = lastParam(params, "activeOnly", "1") === "1";

  return (
    <main className="page-shell">
      <div className="page-heading">
        <div className="heading-copy">
          <div className="eyebrow">
            <span className="eyebrow-line" />
            Data / Identitas
          </div>
          <h1 className="page-title">
            <span className="heading-icon">
              <Icon name="id-card" size={21} />
            </span>
            Manajemen Identitas
          </h1>
          <p className="page-subtitle">
            Cari dan kelola data identitas WBP serta tahanan dari satu ruang kerja yang
            ringkas.
          </p>
        </div>

        <div className="heading-actions">
          <span className="last-sync">
            <span className="live-dot" />
            Data terhubung
          </span>
          {access.canWrite ? (
            <a
              href={items[0]?.links.tambah ?? `${legacyBase}/AddIdentitas`}
              className="primary-button"
            >
              <Icon name="plus" size={15} />
              Tambah baru
            </a>
          ) : null}
        </div>
      </div>

      <div className="kpi-strip" aria-label="Ringkasan pencarian">
        <article className="kpi-card">
          <span className="kpi-icon">
            <Icon name="users" />
          </span>
          <span className="kpi-copy">
            <span className="kpi-label">Total hasil pencarian</span>
            <strong>{pagination.total}</strong>
          </span>
        </article>
        <article className="kpi-card">
          <span className="kpi-icon">
            <Icon name="shield-check" />
          </span>
          <span className="kpi-copy">
            <span className="kpi-label">Cakupan data</span>
            <strong>{activeOnly ? "Data aktif" : "Semua data"}</strong>
          </span>
        </article>
        <article className="kpi-card">
          <span className="kpi-icon">
            <Icon name="filter" />
          </span>
          <span className="kpi-copy">
            <span className="kpi-label">Status tampilan</span>
            <strong>{mode === "analisa" ? "Mode analisa" : "Mode grid"}</strong>
          </span>
        </article>
        <article className="kpi-card">
          <span className="kpi-icon">
            <Icon name="layers" />
          </span>
          <span className="kpi-copy">
            <span className="kpi-label">Halaman berjalan</span>
            <strong>
              {pagination.page} <span aria-hidden="true">/</span> {pages}
            </strong>
          </span>
        </article>
      </div>

      <section className="search-panel" aria-labelledby="search-title">
        <div className="panel-heading">
          <div className="panel-title">
            <span className="panel-icon">
              <Icon name="search" />
            </span>
            <div>
              <h2 id="search-title">Pencarian identitas</h2>
              <p>Gunakan bidang pencarian dan filter untuk mempersempit hasil.</p>
            </div>
          </div>
          <span className="panel-shortcut">Tekan Enter untuk mencari</span>
        </div>

        <Form method="get" className="search-form">
          <div className="search-main-row">
            <label className="field-group">
              <span>Bidang pencarian</span>
              <select
                name="field"
                value={fieldState}
                onChange={(event) => setFieldState(event.target.value)}
                className="field-control"
              >
                {FIELDS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="field-group">
              <span>Kata kunci</span>
              {fieldValueControl(fieldState, params.get("q") ?? "", agama, pendidikan)}
            </label>

            <button type="submit" className="search-button">
              <Icon name="search" size={15} />
              Cari data
            </button>
          </div>

          <div className="filter-row">
            <span className="filter-label">Filter</span>
            <label className="compact-field">
              <span>Status foto</span>
              <select
                name="photoStatus"
                defaultValue={params.get("photoStatus") ?? "semua"}
                className="field-control"
              >
                <option value="semua">Semua</option>
                <option value="sudah">Sudah</option>
                <option value="belum">Belum</option>
              </select>
            </label>
            <label className="compact-field">
              <span>Sidik jari</span>
              <select
                name="fingerprintStatus"
                defaultValue={params.get("fingerprintStatus") ?? "semua"}
                className="field-control"
              >
                <option value="semua">Semua</option>
                <option value="sudah">Sudah</option>
                <option value="belum">Belum</option>
              </select>
            </label>

            <span className="filter-spacer" />

            <label className="check-toggle">
              <input type="hidden" name="activeOnly" value="0" />
              <input
                type="checkbox"
                name="activeOnly"
                value="1"
                defaultChecked={activeOnly}
              />
              <span className="check-box" aria-hidden="true" />
              Data aktif
            </label>
            <label className="check-toggle">
              <input type="hidden" name="recidivistOnly" value="0" />
              <input
                type="checkbox"
                name="recidivistOnly"
                value="1"
                defaultChecked={lastParam(params, "recidivistOnly", "0") === "1"}
              />
              <span className="check-box" aria-hidden="true" />
              Residivis
            </label>
            <label className="field-group mode-field">
              <span>Tampilan</span>
              <select name="mode" defaultValue={mode} className="field-control">
                <option value="grid">Mode grid</option>
                <option value="analisa">Mode analisa</option>
              </select>
            </label>

            <input
              type="hidden"
              name="perPage"
              value={params.get("perPage") ?? (mode === "analisa" ? "1" : "20")}
            />
            <input type="hidden" name="sort" value={params.get("sort") ?? "noin"} />
            <input type="hidden" name="order" value={params.get("order") ?? "desc"} />
          </div>
        </Form>
      </section>

      <div className="results-toolbar">
        <div className="results-summary">
          <div className="results-count">
            <strong>{pagination.total}</strong>
            <span>identitas ditemukan</span>
          </div>
          <span>
            Menampilkan {from}–{to} dari {pagination.total} data
          </span>
        </div>

        <div className="results-actions">
          <Link to={`/identitas/export${qs(params, {})}`} className="toolbar-link" reloadDocument>
            <Icon name="download" size={14} />
            Ekspor ke Excel
          </Link>
          <Form method="get" className="page-size-form">
            {hiddenKeep(params, ["perPage"])}
            <label htmlFor="per-page">Per halaman</label>
            <select
              id="per-page"
              name="perPage"
              defaultValue={String(pagination.perPage)}
              onChange={(event) => event.currentTarget.form?.requestSubmit()}
              className="field-control"
            >
              {(mode === "analisa" ? [1] : [10, 20, 50, 100]).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </Form>
        </div>
      </div>

      {mode === "analisa" ? (
        <AnalisaCard item={items[0]} access={access} page={pagination.page} pages={pages} params={params} />
      ) : (
        <section className="results-card" aria-labelledby="results-title">
          <div className="results-card-header">
            <div>
              <div id="results-title" className="section-label">
                Daftar identitas
              </div>
              <p>Urutkan kolom atau buka aksi untuk melihat detail data.</p>
            </div>
            <span className="record-badge">Halaman {pagination.page}</span>
          </div>

          <div className="table-scroll">
            <table className="identity-table">
              <thead>
                <tr>
                  {columns.map((col) => {
                    const sortKey = SORT_KEYS[col];
                    const active = (params.get("sort") ?? "noin") === sortKey;
                    const nextOrder =
                      active && (params.get("order") ?? "desc") === "asc" ? "desc" : "asc";
                    return (
                      <th key={col}>
                        {sortKey ? (
                          <Link to={qs(params, { sort: sortKey, order: nextOrder })}>
                            {COLUMN_LABELS[col] ?? col}
                            {active ? (
                              <span className="sort-indicator">
                                {(params.get("order") ?? "desc") === "asc" ? "↑" : "↓"}
                              </span>
                            ) : null}
                          </Link>
                        ) : (
                          COLUMN_LABELS[col] ?? col
                        )}
                      </th>
                    );
                  })}
                  {access.canPrint ? <th>Cetak</th> : null}
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td
                      colSpan={columns.length + (access.canPrint ? 2 : 1)}
                      className="empty-state"
                    >
                      <span className="empty-state-icon">
                        <Icon name="search-x" size={19} />
                      </span>
                      Data tidak ditemukan. Coba ubah kata kunci atau filter.
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr key={item.nomorInduk}>
                      {columns.map((col) => (
                        <td
                          key={col}
                          className={
                            col === "alamat"
                              ? "address-cell"
                              : col === "nomorInduk"
                                ? "identity-id"
                                : undefined
                          }
                        >
                          {cellValue(item, col)}
                        </td>
                      ))}
                      {access.canPrint ? (
                        <td>
                          <div className="print-actions">
                            <a
                              href={item.links.cetakIdentitas}
                              target="_blank"
                              rel="noreferrer"
                              className="print-link"
                            >
                              <Icon name="file-text" size={13} />
                              Identitas
                            </a>
                            {item.isTahanan ? (
                              <a
                                href={item.links.cetakTahanan}
                                target="_blank"
                                rel="noreferrer"
                                className="print-link"
                              >
                                <Icon name="calendar" size={13} />
                                Masa tahanan
                              </a>
                            ) : null}
                            <a
                              href={item.links.cetakSidikJari}
                              target="_blank"
                              rel="noreferrer"
                              className="print-link"
                            >
                              <Icon name="fingerprint" size={13} />
                              Sidik jari
                            </a>
                          </div>
                        </td>
                      ) : null}
                      <td>
                        <div className="action-links">
                          <Link to={`/identitas/${item.nomorInduk}`} className="action-link">
                            <Icon name="eye" size={13} />
                            Lihat
                          </Link>
                          {access.canWrite ? (
                            <a href={item.links.ubah} className="action-link">
                              <Icon name="edit" size={13} />
                              Ubah
                            </a>
                          ) : null}
                          {access.canDelete ? (
                            <a href={item.links.hapus} className="action-link delete">
                              <Icon name="trash" size={13} />
                              Hapus
                            </a>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {mode === "grid" && pages > 1 ? (
        <nav className="pagination" aria-label="Paginasi identitas">
          {pagination.page > 1 ? (
            <Link
              to={qs(params, { page: pagination.page - 1 })}
              className="pagination-item"
              aria-label="Halaman sebelumnya"
            >
              <Icon name="chevron-left" size={14} />
            </Link>
          ) : null}
          {Array.from({ length: Math.min(pages, 12) }, (_, i) => {
            const page = i + 1;
            return (
              <Link
                key={page}
                to={qs(params, { page })}
                className={`pagination-item${page === pagination.page ? " current" : ""}`}
                aria-current={page === pagination.page ? "page" : undefined}
              >
                {page}
              </Link>
            );
          })}
          {pages > 12 ? <span className="pagination-item">… {pages}</span> : null}
          {pagination.page < pages ? (
            <Link
              to={qs(params, { page: pagination.page + 1 })}
              className="pagination-item"
              aria-label="Halaman berikutnya"
            >
              <Icon name="chevron-right" size={14} />
            </Link>
          ) : null}
        </nav>
      ) : null}
    </main>
  );
}

type IconName =
  | "calendar"
  | "chevron-left"
  | "chevron-right"
  | "download"
  | "edit"
  | "eye"
  | "file-text"
  | "filter"
  | "fingerprint"
  | "id-card"
  | "layers"
  | "plus"
  | "search"
  | "search-x"
  | "shield-check"
  | "trash"
  | "users";

function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  let paths: ReactNode;

  switch (name) {
    case "id-card":
      paths = (
        <>
          <rect x="2.5" y="4" width="19" height="16" rx="2.5" />
          <circle cx="8" cy="10" r="2" />
          <path d="M5.5 16c.7-1.8 4.3-1.8 5 0M14 9h4.5M14 13h4.5M14 17h3" />
        </>
      );
      break;
    case "plus":
      paths = <path d="M12 5v14M5 12h14" />;
      break;
    case "users":
      paths = (
        <>
          <path d="M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20" />
          <circle cx="10" cy="8" r="3" />
          <path d="M16 5.2a3 3 0 0 1 0 5.6M19.5 18.5a3.5 3.5 0 0 0-2.5-3.35" />
        </>
      );
      break;
    case "shield-check":
      paths = (
        <>
          <path d="M12 3l7 3v5.2c0 4.4-2.9 8.1-7 9.8-4.1-1.7-7-5.4-7-9.8V6l7-3z" />
          <path d="m8.5 12 2.2 2.2 4.8-5" />
        </>
      );
      break;
    case "filter":
      paths = (
        <>
          <path d="M4 6h16M7 12h10M10 18h4" />
          <circle cx="7" cy="6" r="1.5" />
          <circle cx="14" cy="12" r="1.5" />
          <circle cx="10" cy="18" r="1.5" />
        </>
      );
      break;
    case "layers":
      paths = (
        <>
          <path d="m12 4 8 4-8 4-8-4 8-4z" />
          <path d="m4 12 8 4 8-4M4 16l8 4 8-4" />
        </>
      );
      break;
    case "search":
      paths = (
        <>
          <circle cx="10.8" cy="10.8" r="6.8" />
          <path d="m16 16 4.5 4.5" />
        </>
      );
      break;
    case "download":
      paths = (
        <>
          <path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 20h14" />
        </>
      );
      break;
    case "search-x":
      paths = (
        <>
          <circle cx="10.5" cy="10.5" r="6.5" />
          <path d="m15.5 15.5 4.5 4.5M8.5 8.5l4 4M12.5 8.5l-4 4" />
        </>
      );
      break;
    case "file-text":
      paths = (
        <>
          <path d="M6 3.5h8l4 4V20.5H6zM14 3.5v4h4M9 12h6M9 16h5" />
        </>
      );
      break;
    case "calendar":
      paths = (
        <>
          <rect x="3.5" y="5.5" width="17" height="15" rx="2" />
          <path d="M7 3.5v4M17 3.5v4M3.5 10h17M8 14h.01M12 14h.01M16 14h.01M8 17.5h.01M12 17.5h.01" />
        </>
      );
      break;
    case "fingerprint":
      paths = (
        <>
          <path d="M7.5 10.5a4.5 4.5 0 0 1 9 0c0 3.1-.6 5.6-1.8 7.7M10 20c1.3-2.3 2-5.3 2-8.5a1.5 1.5 0 0 1 3 0c0 3-.5 5.6-1.4 8" />
          <path d="M4.5 11a7.5 7.5 0 0 1 15 0c0 1.7-.2 3.3-.5 4.8M5.5 17.5c.7-1.8 1-3.9 1-6.5a5.5 5.5 0 0 1 11 0" />
        </>
      );
      break;
    case "eye":
      paths = (
        <>
          <path d="M2.5 12s3.5-5 9.5-5 9.5 5 9.5 5-3.5 5-9.5 5-9.5-5-9.5-5z" />
          <circle cx="12" cy="12" r="2.2" />
        </>
      );
      break;
    case "edit":
      paths = (
        <>
          <path d="m4 16.5-.8 4.3 4.3-.8L19 8.5 15.5 5 4 16.5zM13.5 7 17 10.5" />
        </>
      );
      break;
    case "trash":
      paths = (
        <>
          <path d="M5 7h14M10 3.5h4l1 2.5H9l1-2.5zM7 7l.8 13h8.4L17 7M10 10.5v6M14 10.5v6" />
        </>
      );
      break;
    case "chevron-left":
      paths = <path d="m14.5 5-7 7 7 7" />;
      break;
    case "chevron-right":
      paths = <path d="m9.5 5 7 7-7 7" />;
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

function cellValue(item: IdentityItem, col: string) {
  const value = item[col as keyof IdentityItem];
  if (col === "verifikasi") {
    const ok = item.verifikasi === "Sudah";
    return (
      <span className={`status-pill${ok ? "" : " pending"}`}>
        <span className="status-dot" />
        {item.verifikasi}
      </span>
    );
  }
  if (col === "namaLengkap") {
    return (
      <span className="name-stack">
        <span>{item.namaLengkap || "—"}</span>
        {item.isTahanan ? <span className="name-meta">Tahanan</span> : null}
      </span>
    );
  }
  if (value === null || value === undefined || typeof value === "object") return "—";
  return String(value) || "—";
}

function fieldValueControl(
  field: string,
  current: string,
  agama: LookupItem[],
  pendidikan: LookupItem[],
) {
  const cls = "field-control";

  if (field === "jk") {
    return (
      <select name="q" defaultValue={current || "L"} className={cls}>
        <option value="L">Pria</option>
        <option value="P">Perempuan</option>
      </select>
    );
  }
  if (field === "wg") {
    return (
      <select name="q" defaultValue={current || "WNI"} className={cls}>
        <option value="WNI">WNI</option>
        <option value="WNA">WNA</option>
      </select>
    );
  }
  if (field === "ver") {
    return (
      <select name="q" defaultValue={current || "Sudah"} className={cls}>
        <option value="Sudah">Sudah</option>
        <option value="Belum">Belum</option>
      </select>
    );
  }
  if (field === "res" || field === "ruh") {
    return (
      <select name="q" defaultValue={current || "Ya"} className={cls}>
        <option value="Ya">Ya</option>
        <option value="Tidak">Tidak</option>
      </select>
    );
  }
  if (field === "agama") {
    return (
      <select name="q" defaultValue={current} className={cls}>
        {agama.map((item) => (
          <option key={item.id} value={item.id}>
            {item.label}
          </option>
        ))}
      </select>
    );
  }
  if (field === "pendidikan") {
    return (
      <select name="q" defaultValue={current} className={cls}>
        {pendidikan.map((item) => (
          <option key={item.id} value={item.id}>
            {item.label}
          </option>
        ))}
      </select>
    );
  }
  if (field === "tgl" || field === "tgl_msk_lapas") {
    return (
      <input
        name="q"
        defaultValue={current}
        placeholder="dd/mm/yyyy"
        className={cls}
      />
    );
  }

  return <input name="q" defaultValue={current} className={cls} />;
}

function hiddenKeep(params: URLSearchParams, skip: string[]) {
  const keys = [
    "field",
    "q",
    "photoStatus",
    "fingerprintStatus",
    "activeOnly",
    "recidivistOnly",
    "mode",
    "sort",
    "order",
    "perPage",
  ];
  return keys
    .filter((key) => !skip.includes(key) && params.get(key) !== null)
    .map((key) => <input key={key} type="hidden" name={key} value={params.get(key) ?? ""} />);
}

function AnalisaCard({
  item,
  access,
  page,
  pages,
  params,
}: {
  item?: IdentityItem;
  access: Access;
  page: number;
  pages: number;
  params: URLSearchParams;
}) {
  if (!item) {
    return (
      <div className="results-card empty-state">
        <span className="empty-state-icon">
          <Icon name="search-x" size={19} />
        </span>
        Data tidak ditemukan. Coba ubah kata kunci atau filter.
      </div>
    );
  }

  const c = item.case;
  const rows: [string, string | null | undefined, string, string | null | undefined][] = [
    ["Nama Lengkap", item.namaLengkap, "Nomor Berkas", c?.nomorBerkas],
    ["Tgl Lahir", item.tanggalLahir, "Nomor Registrasi", c?.nomorRegistrasi],
    ["Alamat", item.alamat, "Jenis Registrasi", c?.jenisRegistrasi],
    ["Jenis Kelamin", item.jenisKelamin, "Kejahatan", c?.kejahatan],
    ["Warga Negara", item.wargaNegara, "Tanggal Mulai Ditahan", c?.tglMulaiDitahan],
    ["Konfirmasi", item.verifikasi, "Tanggal Ekspirasi", c?.tglEkspirasi],
    ["Lokasi Sel", c?.tempatLokasiSel, "Status", c?.statusSubPenghuni],
    ["Tgl Masuk UPT", c?.tanggalMasukLapas ?? item.tanggalMasukUpt, "Sisa Pidana", c?.sisaPidana],
  ];

  return (
    <section className="analysis-card">
      <div className="analysis-card-header">
        <div>
          <div className="section-label">Mode analisa</div>
          <p>Informasi ke {page} dari {pages}</p>
        </div>
        <span className="record-badge">1 identitas</span>
      </div>

      <div className="analysis-layout">
        <div className="analysis-photo">
          {item.fotoDepanUrl ? (
            <img src={item.fotoDepanUrl} alt={item.namaLengkap ?? "Foto"} />
          ) : (
            <div className="analysis-photo-empty">Tidak ada foto</div>
          )}
        </div>

        <dl className="detail-grid">
          {rows.flatMap(([leftLabel, leftValue, rightLabel, rightValue], i) => [
            <div key={`${i}-l`} className="detail-item">
              <dt>{leftLabel}</dt>
              <dd>{leftValue || "—"}</dd>
            </div>,
            <div key={`${i}-r`} className="detail-item">
              <dt>{rightLabel}</dt>
              <dd>{rightValue || "—"}</dd>
            </div>,
          ])}
        </dl>
      </div>

      <div className="analysis-footer">
        <div className="analysis-actions">
          <Link to={`/identitas/${item.nomorInduk}`} className="action-link">
            <Icon name="eye" size={13} />
            Lihat
          </Link>
          {access.canWrite ? (
            <a href={item.links.ubah} className="action-link">
              <Icon name="edit" size={13} />
              Ubah
            </a>
          ) : null}
          {access.canDelete ? (
            <a href={item.links.hapus} className="action-link delete">
              <Icon name="trash" size={13} />
              Hapus
            </a>
          ) : null}
        </div>

        <div className="analysis-navigation">
          {page > 1 ? (
            <Link
              to={qs(params, { page: page - 1, mode: "analisa", perPage: 1 })}
              className="secondary-button"
            >
              <Icon name="chevron-left" size={14} />
              Sebelumnya
            </Link>
          ) : null}
          {page < pages ? (
            <Link
              to={qs(params, { page: page + 1, mode: "analisa", perPage: 1 })}
              className="secondary-button"
            >
              Berikutnya
              <Icon name="chevron-right" size={14} />
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}
