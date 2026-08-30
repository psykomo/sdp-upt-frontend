import { Form, Link, redirect, useNavigation, useSearchParams } from "react-router";
import { useState, useRef, useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { apiGet, publicLegacyBase } from "../lib/session";
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
  links?: { tambah: string };
};

const FIELDS = [
  { value: "nama", label: "Nama Lengkap" },
  { value: "no_induk", label: "Nomor Induk (No. Induk)" },
  { value: "no_reg", label: "Nomor Registrasi" },
  { value: "tgl", label: "Tanggal Lahir" },
  { value: "usia", label: "Usia / Umur" },
  { value: "alamat", label: "Alamat Tinggal" },
  { value: "jk", label: "Jenis Kelamin" },
  { value: "wg", label: "Kewarganegaraan" },
  { value: "agama", label: "Agama" },
  { value: "pendidikan", label: "Pendidikan Terakhir" },
  { value: "uu", label: "Undang-Undang / Pasal" },
  { value: "ver", label: "Status Verifikasi" },
  { value: "res", label: "WBP Beresiko Tinggi" },
  { value: "ruh", label: "Pengaruh Masyarakat" },
  { value: "tgl_msk_lapas", label: "Tgl Masuk UPT" },
] as const;

const PROFILE_COLUMNS: Record<
  string,
  { label: string; sortKey: string; className: string; render: (item: IdentityItem) => ReactNode }
> = {
  agama: {
    label: "Agama",
    sortKey: "agama",
    className: "col-religion",
    render: (item) => <span className="cell-text">{item.agama || "—"}</span>,
  },
  asalUpt: {
    label: "Asal UPT",
    sortKey: "asalUpt",
    className: "col-religion",
    render: (item) => <span className="cell-text">{item.asalUpt || "—"}</span>,
  },
};

function profileColumnMeta(columns: string[]) {
  const key = columns.find((column) => column === "agama" || column === "asalUpt") ?? "agama";
  return { key, meta: PROFILE_COLUMNS[key] };
}

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

export function meta({ loaderData }: Route.MetaArgs) {
  const total = loaderData?.result?.pagination?.total ?? 0;
  return [{ title: `Manajemen Identitas (${total}) — SDP 4.0` }];
}

export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  const url = new URL(request.url);
  const params = url.searchParams;

  if (!params.has("field")) {
    const next = new URLSearchParams(params);
    next.set("activeOnly", next.get("activeOnly") ?? "1");
    next.set("field", "nama");
    next.set("mode", next.get("mode") ?? "grid");
    throw redirect(`/identitas?${next.toString()}`);
  }

  const [result, agama, pendidikan] = await Promise.all([
    apiGet<SearchResult>(`/identitas?${params.toString()}`, request),
    apiGet<{ items: LookupItem[] }>("/lookups/agama", request),
    apiGet<{ items: LookupItem[] }>("/lookups/pendidikan", request),
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

/** Prefer path for SPA <Link>; API may return absolute frontend URLs. */
function spaPath(href: string): string {
  if (!href.startsWith("http://") && !href.startsWith("https://")) return href;
  try {
    return new URL(href).pathname || "/identitas/baru";
  } catch {
    return "/identitas/baru";
  }
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
  const navigation = useNavigation();
  const searching = navigation.state !== "idle";

  const field = lastParam(params, "field", "nama");
  const mode = lastParam(params, "mode", "grid");
  const [fieldState, setFieldState] = useState(field);
  const [showFilters, setShowFilters] = useState(false);

  const { items, pagination, access, columns } = result;
  const profileColumn = profileColumnMeta(columns);
  const from = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.perPage + 1;
  const to = Math.min(pagination.page * pagination.perPage, pagination.total);
  const pages = Math.max(1, Math.ceil(pagination.total / pagination.perPage));
  const activeOnly = lastParam(params, "activeOnly", "1") === "1";
  const recidivistOnly = lastParam(params, "recidivistOnly", "0") === "1";
  const photoStatus = lastParam(params, "photoStatus", "semua");
  const fingerprintStatus = lastParam(params, "fingerprintStatus", "semua");

  // Keep fieldState in sync if URL changes
  useEffect(() => {
    setFieldState(field);
  }, [field]);

  const hasActiveFilters =
    photoStatus !== "semua" ||
    fingerprintStatus !== "semua" ||
    !activeOnly ||
    recidivistOnly;

  return (
    <main className="modern-page-shell">
      {/* 1. Header Section */}
      <header className="module-header">
        <div className="module-header-left">
          <div className="module-breadcrumbs">
            <span className="breadcrumb-root">SDP 4.0</span>
            <span className="breadcrumb-separator">/</span>
            <span className="breadcrumb-current">Manajemen Identitas</span>
          </div>

          <div className="module-title-row">
            <h1 className="module-title">
              <span className="module-title-icon">
                <Icon name="id-card" size={22} />
              </span>
              Data Identitas WBP
            </h1>

            <div className="module-meta-badges">
              <span className="badge badge-primary">
                <span className="badge-dot" />
                {pagination.total.toLocaleString("id-ID")} Terdaftar
              </span>
              {activeOnly ? (
                <span className="badge badge-success">Data Aktif</span>
              ) : (
                <span className="badge badge-warning">Semua Arsip</span>
              )}
            </div>
          </div>
          <p className="module-desc">
            Pusat direktori narapidana, tahanan, rekaman biometrik, serta status penahanan terintegrasi.
          </p>
        </div>

        <div className="module-header-actions">
          <Link
            to={`/identitas/export${qs(params, {})}`}
            className="btn btn-secondary"
            title="Unduh data dalam format file Excel"
          >
            <Icon name="download" size={15} />
            <span>Ekspor Excel</span>
          </Link>

          {access.canWrite ? (
            <Link
              to={spaPath(result.links?.tambah || items[0]?.links.tambah || "/identitas/baru")}
              className="btn btn-primary"
            >
              <Icon name="plus" size={15} />
              <span>Tambah Identitas</span>
            </Link>
          ) : null}
        </div>
      </header>

      {/* 2. Unified Command & Filter Card */}
      <section className="search-command-card" aria-labelledby="search-heading">
        <h2 id="search-heading" className="sr-only">Pencarian dan Filter</h2>
        
        <Form method="get" className="command-form">
          {/* Top Search Input Row */}
          <div className="command-search-row">
            <div className="search-composite-box">
              <div className="field-select-wrapper">
                <Icon name="filter" size={14} className="field-select-icon" />
                <select
                  name="field"
                  value={fieldState}
                  onChange={(e) => setFieldState(e.target.value)}
                  className="field-selector"
                  aria-label="Pilih bidang pencarian"
                >
                  {FIELDS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="search-input-wrapper">
                <Icon name="search" size={16} className="search-input-icon" />
                {renderSearchInput(fieldState, params.get("q") ?? "", agama, pendidikan)}
              </div>
            </div>

            <button type="submit" className="btn btn-primary search-submit-btn" disabled={searching}>
              <Icon name="search" size={15} />
              <span>{searching ? "Mencari…" : "Cari Data"}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className={`btn btn-toggle-filter ${showFilters || hasActiveFilters ? "active" : ""}`}
              aria-expanded={showFilters}
            >
              <Icon name="sliders" size={15} />
              <span>Filter {hasActiveFilters ? "•" : ""}</span>
            </button>
          </div>

          {/* Expandable Filter Bar */}
          <div className={`filters-drawer ${showFilters || hasActiveFilters ? "is-open" : ""}`}>
            <div className="filter-group">
              <label htmlFor="photo-status" className="filter-label">Foto WBP</label>
              <select
                id="photo-status"
                name="photoStatus"
                defaultValue={photoStatus}
                className="filter-select"
              >
                <option value="semua">Semua Status</option>
                <option value="sudah">Sudah Ada Foto</option>
                <option value="belum">Belum Ada Foto</option>
              </select>
            </div>

            <div className="filter-group">
              <label htmlFor="fingerprint-status" className="filter-label">Sidik Jari</label>
              <select
                id="fingerprint-status"
                name="fingerprintStatus"
                defaultValue={fingerprintStatus}
                className="filter-select"
              >
                <option value="semua">Semua Status</option>
                <option value="sudah">Sudah Rekam</option>
                <option value="belum">Belum Rekam</option>
              </select>
            </div>

            <div className="filter-checkbox-group">
              <label className="toggle-chip">
                <input type="hidden" name="activeOnly" value="0" />
                <input
                  type="checkbox"
                  name="activeOnly"
                  value="1"
                  defaultChecked={activeOnly}
                />
                <span className="toggle-chip-indicator">
                  <Icon name="check" size={12} />
                </span>
                <span>Hanya Data Aktif</span>
              </label>

              <label className="toggle-chip">
                <input type="hidden" name="recidivistOnly" value="0" />
                <input
                  type="checkbox"
                  name="recidivistOnly"
                  value="1"
                  defaultChecked={recidivistOnly}
                />
                <span className="toggle-chip-indicator">
                  <Icon name="check" size={12} />
                </span>
                <span>Hanya Residivis</span>
              </label>
            </div>

            {hasActiveFilters ? (
              <Link to="/identitas" className="btn-reset-filters">
                <Icon name="x" size={13} />
                <span>Reset Filter</span>
              </Link>
            ) : null}

            {/* Hidden query state keepers */}
            <input type="hidden" name="mode" value={mode} />
            <input type="hidden" name="perPage" value={params.get("perPage") ?? (mode === "analisa" ? "1" : "20")} />
            <input type="hidden" name="sort" value={params.get("sort") ?? "noin"} />
            <input type="hidden" name="order" value={params.get("order") ?? "desc"} />
          </div>
        </Form>
      </section>

      {/* 3. Results Toolbar & View Switcher */}
      <div className="view-control-toolbar">
        <div className="results-indicator">
          <span className="results-count-text">
            Menampilkan <strong>{from}–{to}</strong> dari <strong>{pagination.total}</strong> identitas
          </span>
          {params.get("q") ? (
            <span className="query-tag">
              Kata kunci: <mark>"{params.get("q")}"</mark>
            </span>
          ) : null}
        </div>

        <div className="view-control-actions">
          {/* Segmented View Mode Toggle */}
          <div className="segmented-switch" role="tablist" aria-label="Tampilan mode">
            <Link
              to={qs(params, { mode: "grid", perPage: 20 })}
              className={`segmented-item ${mode === "grid" ? "active" : ""}`}
              role="tab"
              aria-selected={mode === "grid"}
            >
              <Icon name="grid" size={14} />
              <span>Tabel</span>
            </Link>

            <Link
              to={qs(params, { mode: "analisa", perPage: 1 })}
              className={`segmented-item ${mode === "analisa" ? "active" : ""}`}
              role="tab"
              aria-selected={mode === "analisa"}
            >
              <Icon name="user-check" size={14} />
              <span>Mode Analisa</span>
            </Link>
          </div>

          {/* Per Page Selector */}
          {mode === "grid" ? (
            <Form method="get" className="per-page-form">
              {hiddenKeep(params, ["perPage"])}
              <label htmlFor="per-page-select" className="per-page-label">Baris:</label>
              <select
                id="per-page-select"
                name="perPage"
                defaultValue={String(pagination.perPage)}
                onChange={(e) => e.currentTarget.form?.requestSubmit()}
                className="per-page-select"
              >
                {[10, 20, 50, 100].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </Form>
          ) : null}
        </div>
      </div>

      {/* 4. Main Content Area: Grid Table or Dossier Analisa */}
      {mode === "analisa" ? (
        <AnalisaDossier
          item={items[0]}
          access={access}
          page={pagination.page}
          pages={pages}
          total={pagination.total}
          params={params}
          legacyBase={legacyBase}
        />
      ) : (
        <section className="table-card" aria-label="Tabel Data Identitas">
          <div className="table-scroll-container">
            <table className="modern-table">
              <thead>
                <tr>
                  <th scope="col" className="col-wbp">
                    {renderSortableTh("namaLengkap", "WBP / Nama Lengkap", params)}
                  </th>
                  <th scope="col" className="col-id">
                    {renderSortableTh("nomorInduk", "No. Induk", params)}
                  </th>
                  <th scope="col" className="col-reg">
                    {renderSortableTh("nomorRegistrasi", "No. Registrasi", params)}
                  </th>
                  <th scope="col" className="col-date">
                    {renderSortableTh("tanggalMasukUpt", "Tgl Masuk", params)}
                  </th>
                  <th scope="col" className="col-birth">
                    {renderSortableTh("tanggalLahir", "Tgl Lahir", params)}
                  </th>
                  <th scope="col" className="col-address">
                    {renderSortableTh("alamat", "Alamat", params)}
                  </th>
                  <th scope="col" className={profileColumn.meta.className}>
                    {renderSortableTh(profileColumn.meta.sortKey, profileColumn.meta.label, params)}
                  </th>
                  <th scope="col" className="col-status">
                    {renderSortableTh("verifikasi", "Verifikasi", params)}
                  </th>
                  <th scope="col" className="col-actions text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="table-empty-row">
                      <div className="empty-state-box">
                        <div className="empty-icon-circle">
                          <Icon name="search-x" size={24} />
                        </div>
                        <h3 className="empty-title">Data identitas tidak ditemukan</h3>
                        <p className="empty-desc">
                          Tidak ada data yang cocok dengan kriteria pencarian saat ini. Silakan ubah kata kunci atau reset filter pencarian.
                        </p>
                        {hasActiveFilters || params.get("q") ? (
                          <Link to="/identitas" className="btn btn-secondary btn-sm">
                            Reset Semua Filter
                          </Link>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr key={item.nomorInduk} className="table-data-row">
                      {/* 1. WBP Identity Column (Avatar + Name + Status Pill) */}
                      <td className="col-wbp">
                        <div className="wbp-profile-cell">
                          <AvatarImage
                            src={item.fotoDepanUrl}
                            name={item.namaLengkap}
                          />
                          <div className="wbp-info-stack">
                            <Link
                              to={`/identitas/${item.nomorInduk}`}
                              className="wbp-name-link"
                              title={item.namaLengkap ?? ""}
                            >
                              {item.namaLengkap || "—"}
                            </Link>
                            <div className="wbp-badges-sub">
                              {item.isTahanan ? (
                                <span className="tag-pill tag-tahanan">Tahanan</span>
                              ) : (
                                <span className="tag-pill tag-napi">Narapidana</span>
                              )}
                              {item.jenisKelamin ? (
                                <span className="text-muted-tag">
                                  {item.jenisKelamin === "L" ? "Pria" : "Wanita"}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 2. No Induk */}
                      <td className="col-id">
                        <code className="monospace-id-tag" title={item.nomorInduk}>
                          {item.nomorInduk}
                        </code>
                      </td>

                      {/* 3. No Registrasi */}
                      <td className="col-reg">
                        {item.nomorRegistrasi ? (
                          <code className="monospace-reg-tag" title={item.nomorRegistrasi}>{item.nomorRegistrasi}</code>
                        ) : (
                          <span className="text-empty">—</span>
                        )}
                      </td>

                      {/* 4. Tgl Masuk UPT */}
                      <td className="col-date">
                        <span className="cell-date">{item.tanggalMasukUpt || "—"}</span>
                      </td>

                      {/* 5. Tgl Lahir */}
                      <td className="col-birth">
                        <span className="cell-date">{item.tanggalLahir || "—"}</span>
                      </td>

                      {/* 6. Alamat */}
                      <td className="col-address">
                        <div className="cell-address-clamp" title={item.alamat ?? ""}>
                          {item.alamat || "—"}
                        </div>
                      </td>

                      {/* 7. Profile column (Agama or Asal UPT) */}
                      <td className={profileColumn.meta.className}>
                        {profileColumn.meta.render(item)}
                      </td>

                      {/* 8. Status Verifikasi */}
                      <td className="col-status">
                        {item.verifikasi === "Sudah" ? (
                          <span className="status-badge status-verified">
                            <span className="status-dot" />
                            Terverifikasi
                          </span>
                        ) : (
                          <span className="status-badge status-unverified">
                            <span className="status-dot" />
                            Belum
                          </span>
                        )}
                      </td>

                      {/* 9. Consolidated Actions */}
                      <td className="col-actions text-right">
                        <ActionMenu item={item} access={access} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* 5. Pagination Bar */}
      {mode === "grid" && pages > 1 ? (
        <nav className="pagination-bar" aria-label="Paginasi Halaman Identitas">
          <div className="pagination-info">
            Halaman <strong>{pagination.page}</strong> dari <strong>{pages}</strong>
          </div>

          <div className="pagination-controls">
            {pagination.page > 1 ? (
              <Link
                to={qs(params, { page: pagination.page - 1 })}
                className="pagination-btn"
                aria-label="Halaman sebelumnya"
              >
                <Icon name="chevron-left" size={14} />
                <span>Sebelumnya</span>
              </Link>
            ) : (
              <button disabled className="pagination-btn disabled">
                <Icon name="chevron-left" size={14} />
                <span>Sebelumnya</span>
              </button>
            )}

            <div className="pagination-pages-list">
              {renderPaginationNumbers(pagination.page, pages, params)}
            </div>

            {pagination.page < pages ? (
              <Link
                to={qs(params, { page: pagination.page + 1 })}
                className="pagination-btn"
                aria-label="Halaman berikutnya"
              >
                <span>Berikutnya</span>
                <Icon name="chevron-right" size={14} />
              </Link>
            ) : (
              <button disabled className="pagination-btn disabled">
                <span>Berikutnya</span>
                <Icon name="chevron-right" size={14} />
              </button>
            )}
          </div>
        </nav>
      ) : null}
    </main>
  );
}

// -------------------------------------------------------------
// Avatar Image with Fallback Initials
// -------------------------------------------------------------
function AvatarImage({
  src,
  name,
}: {
  src: string | null;
  name: string | null;
}) {
  const [hasError, setHasError] = useState(false);

  return (
    <div className="wbp-avatar-wrapper">
      {src && !hasError ? (
        <img
          src={src}
          alt=""
          onError={() => setHasError(true)}
          className="wbp-avatar-img"
          loading="lazy"
        />
      ) : (
        <div className="wbp-avatar-fallback">
          {getInitials(name)}
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------
// Action Menu Component (Portaled to document.body)
// -------------------------------------------------------------
function ActionMenu({ item, access }: { item: IdentityItem; access: Access }) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number; flipUp: boolean } | null>(null);
  const [mounted, setMounted] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleMenu = () => {
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const flipUp = spaceBelow < 220;

      setMenuPos({
        top: flipUp ? rect.top - 6 : rect.bottom + 6,
        right: window.innerWidth - rect.right,
        flipUp,
      });
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    function handleGlobalClick(event: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    function handleScrollOrResize() {
      setIsOpen(false);
    }

    document.addEventListener("mousedown", handleGlobalClick);
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);

    return () => {
      document.removeEventListener("mousedown", handleGlobalClick);
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [isOpen]);

  return (
    <div className="action-button-cluster">
      <Link
        to={`/identitas/${item.nomorInduk}`}
        className="btn-action-primary"
        title="Lihat detail identitas lengkap"
      >
        <Icon name="eye" size={13} />
        <span>Lihat</span>
      </Link>

      {access.canWrite ? (
        <Link
          to={`/identitas/${item.nomorInduk}/ubah`}
          className="btn-action-secondary"
          title="Ubah data identitas WBP"
        >
          <Icon name="edit" size={13} />
          <span>Ubah</span>
        </Link>
      ) : null}

      <button
        ref={buttonRef}
        type="button"
        onClick={toggleMenu}
        className={`btn-action-more ${isOpen ? "active" : ""}`}
        aria-label="Menu aksi dan cetak dokumen"
        aria-expanded={isOpen}
      >
        <Icon name="more-horizontal" size={15} />
      </button>

      {mounted && isOpen && menuPos && createPortal(
        <div
          ref={menuRef}
          className={`dropdown-portal-menu ${menuPos.flipUp ? "flip-up" : ""}`}
          style={{
            position: "fixed",
            top: menuPos.flipUp ? "auto" : `${menuPos.top}px`,
            bottom: menuPos.flipUp ? `${window.innerHeight - menuPos.top}px` : "auto",
            right: `${menuPos.right}px`,
            zIndex: 99999,
          }}
        >
          {access.canPrint ? (
            <>
              <div className="dropdown-section-title">Dokumen Cetak</div>

              <a
                href={item.links.cetakIdentitas}
                target="_blank"
                rel="noreferrer"
                className="dropdown-item"
                onClick={() => setIsOpen(false)}
              >
                <Icon name="file-text" size={14} />
                <span>Cetak Lembar Identitas</span>
              </a>

              {item.isTahanan ? (
                <a
                  href={item.links.cetakTahanan}
                  target="_blank"
                  rel="noreferrer"
                  className="dropdown-item"
                  onClick={() => setIsOpen(false)}
                >
                  <Icon name="calendar" size={14} />
                  <span>Cetak Masa Tahanan</span>
                </a>
              ) : null}

              <a
                href={item.links.cetakSidikJari}
                target="_blank"
                rel="noreferrer"
                className="dropdown-item"
                onClick={() => setIsOpen(false)}
              >
                <Icon name="fingerprint" size={14} />
                <span>Cetak Lembar Sidik Jari</span>
              </a>
            </>
          ) : null}

          {access.canDelete ? (
            <>
              <div className="dropdown-divider" />
              <div className="dropdown-section-title">Manajemen Data</div>
              <Link
                to={`/identitas/${item.nomorInduk}/hapus`}
                className="dropdown-item text-danger"
                onClick={() => setIsOpen(false)}
              >
                <Icon name="trash" size={14} />
                <span>Hapus Identitas</span>
              </Link>
            </>
          ) : null}
        </div>,
        document.body
      )}
    </div>
  );
}

// -------------------------------------------------------------
// Dossier-Style Mode Analisa Component
// -------------------------------------------------------------
function AnalisaDossier({
  item,
  access,
  page,
  pages,
  total,
  params,
  legacyBase,
}: {
  item?: IdentityItem;
  access: Access;
  page: number;
  pages: number;
  total: number;
  params: URLSearchParams;
  legacyBase: string;
}) {
  const [photoError, setPhotoError] = useState(!item?.fotoDepanUrl);

  useEffect(() => {
    setPhotoError(!item?.fotoDepanUrl);
  }, [item?.fotoDepanUrl]);

  if (!item) {
    return (
      <div className="dossier-empty-card">
        <div className="empty-icon-circle">
          <Icon name="search-x" size={24} />
        </div>
        <h3>Data WBP Tidak Ditemukan</h3>
        <p>Tidak ada rekaman identitas yang tersedia untuk dianalisa dengan filter saat ini.</p>
        <Link to="/identitas" className="btn btn-secondary btn-sm">
          Reset Filter
        </Link>
      </div>
    );
  }

  const c = item.case;

  return (
    <article className="dossier-container" aria-label={`Analisa Profil ${item.namaLengkap}`}>
      {/* Dossier Header with Navigation */}
      <div className="dossier-nav-header">
        <div className="dossier-nav-meta">
          <span className="dossier-badge">Mode Analisa Intelijen</span>
          <span className="dossier-index-text">
            Rekaman <strong>{page}</strong> dari <strong>{total}</strong> identitas
          </span>
        </div>

        <div className="dossier-nav-actions">
          {page > 1 ? (
            <Link
              to={qs(params, { page: page - 1, mode: "analisa", perPage: 1 })}
              className="btn btn-secondary btn-sm"
              title="Rekaman sebelumnya"
            >
              <Icon name="chevron-left" size={14} />
              <span>Sebelumnya</span>
            </Link>
          ) : (
            <button disabled className="btn btn-secondary btn-sm disabled">
              <Icon name="chevron-left" size={14} />
              <span>Sebelumnya</span>
            </button>
          )}

          {page < pages ? (
            <Link
              to={qs(params, { page: page + 1, mode: "analisa", perPage: 1 })}
              className="btn btn-secondary btn-sm"
              title="Rekaman berikutnya"
            >
              <span>Berikutnya</span>
              <Icon name="chevron-right" size={14} />
            </Link>
          ) : (
            <button disabled className="btn btn-secondary btn-sm disabled">
              <span>Berikutnya</span>
              <Icon name="chevron-right" size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Dossier Body */}
      <div className="dossier-grid-layout">
        {/* Left Column: Photo Portrait & Biometrics Card */}
        <aside className="dossier-profile-card">
          <div className="dossier-photo-frame">
            {item.fotoDepanUrl && !photoError ? (
              <img
                src={item.fotoDepanUrl}
                alt=""
                onError={() => setPhotoError(true)}
                className="dossier-photo-img"
                loading="lazy"
              />
            ) : (
              <div className="dossier-photo-placeholder">
                <div className="dossier-initials-badge">
                  {getInitials(item.namaLengkap)}
                </div>
                <span>Foto Belum Tersedia</span>
              </div>
            )}
            <div className="dossier-photo-overlay">
              <span className="photo-tag">Foto Tampak Depan</span>
            </div>
          </div>

          <div className="dossier-profile-header">
            <h3 className="dossier-name">{item.namaLengkap || "—"}</h3>
            <div className="dossier-meta-chips">
              {item.isTahanan ? (
                <span className="tag-pill tag-tahanan">Tahanan</span>
              ) : (
                <span className="tag-pill tag-napi">Narapidana</span>
              )}
              {item.verifikasi === "Sudah" ? (
                <span className="status-badge status-verified">
                  <span className="status-dot" />
                  Terverifikasi
                </span>
              ) : (
                <span className="status-badge status-unverified">
                  <span className="status-dot" />
                  Belum Verifikasi
                </span>
              )}
            </div>
          </div>

          <div className="dossier-biometric-indicators">
            <div className="biometric-row">
              <span className="biometric-label">Status Foto:</span>
              <span className="biometric-value text-success">
                {item.fotoDepanUrl && !photoError ? "Tersedia (Depan)" : "Belum Rekam"}
              </span>
            </div>
            <div className="biometric-row">
              <span className="biometric-label">Sidik Jari:</span>
              <span className="biometric-value text-info">Tercatat di Sistem</span>
            </div>
            <div className="biometric-row">
              <span className="biometric-label">Asal UPT:</span>
              <span className="biometric-value">{item.asalUpt || "—"}</span>
            </div>
          </div>

          <div className="dossier-print-group">
            <span className="print-group-title">Modul Terkait</span>
            <a
              href={`${legacyBase}/ManajemenIdentitas/catatKunjungan/${encodeURIComponent(item.nomorInduk)}`}
              className="btn btn-secondary btn-sm btn-block"
            >
              <Icon name="users" size={13} />
              <span>Catat Kunjungan</span>
            </a>
          </div>

          {access.canPrint ? (
            <div className="dossier-print-group">
              <span className="print-group-title">Dokumen Cetak</span>
              <div className="print-buttons-list">
                <a
                  href={item.links.cetakIdentitas}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-secondary btn-sm btn-block"
                >
                  <Icon name="file-text" size={13} />
                  <span>Cetak Identitas</span>
                </a>
                {item.isTahanan ? (
                  <a
                    href={item.links.cetakTahanan}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-secondary btn-sm btn-block"
                  >
                    <Icon name="calendar" size={13} />
                    <span>Masa Tahanan</span>
                  </a>
                ) : null}
                <a
                  href={item.links.cetakSidikJari}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-secondary btn-sm btn-block"
                >
                  <Icon name="fingerprint" size={13} />
                  <span>Sidik Jari</span>
                </a>
              </div>
            </div>
          ) : null}
        </aside>

        {/* Right Column: Structured Information Cards */}
        <div className="dossier-details-column">
          {/* Section 1: Identitas Pokok */}
          <section className="dossier-section-card">
            <div className="section-card-header">
              <Icon name="id-card" size={16} className="section-icon" />
              <h4>Identitas Pokok & Biodata</h4>
            </div>
            <div className="section-data-grid">
              <div className="data-field">
                <span className="data-label">Nomor Induk (No. Induk)</span>
                <span className="data-value monospace">{item.nomorInduk}</span>
              </div>
              <div className="data-field">
                <span className="data-label">Nama Lengkap</span>
                <span className="data-value font-semibold">{item.namaLengkap || "—"}</span>
              </div>
              <div className="data-field">
                <span className="data-label">Tanggal Lahir</span>
                <span className="data-value">{item.tanggalLahir || "—"}</span>
              </div>
              <div className="data-field">
                <span className="data-label">Jenis Kelamin</span>
                <span className="data-value">{item.jenisKelamin === "L" ? "Laki-laki" : item.jenisKelamin === "P" ? "Perempuan" : "—"}</span>
              </div>
              <div className="data-field">
                <span className="data-label">Agama</span>
                <span className="data-value">{item.agama || "—"}</span>
              </div>
              <div className="data-field">
                <span className="data-label">Kewarganegaraan</span>
                <span className="data-value">{item.wargaNegara || "—"}</span>
              </div>
              <div className="data-field col-span-2">
                <span className="data-label">Alamat Lengkap</span>
                <span className="data-value">{item.alamat || "—"}</span>
              </div>
            </div>
          </section>

          {/* Section 2: Registrasi & Kasus */}
          <section className="dossier-section-card">
            <div className="section-card-header">
              <Icon name="layers" size={16} className="section-icon" />
              <h4>Informasi Berkas & Registrasi</h4>
            </div>
            <div className="section-data-grid">
              <div className="data-field">
                <span className="data-label">Nomor Registrasi</span>
                <span className="data-value monospace">{c?.nomorRegistrasi || item.nomorRegistrasi || "—"}</span>
              </div>
              <div className="data-field">
                <span className="data-label">Nomor Berkas</span>
                <span className="data-value monospace">{c?.nomorBerkas || "—"}</span>
              </div>
              <div className="data-field">
                <span className="data-label">Jenis Registrasi</span>
                <span className="data-value">{c?.jenisRegistrasi || "—"}</span>
              </div>
              <div className="data-field">
                <span className="data-label">Kejahatan / Tindak Pidana</span>
                <span className="data-value font-medium text-warning">{c?.kejahatan || "—"}</span>
              </div>
              <div className="data-field">
                <span className="data-label">Tanggal Masuk UPT</span>
                <span className="data-value">{c?.tanggalMasukLapas || item.tanggalMasukUpt || "—"}</span>
              </div>
              <div className="data-field">
                <span className="data-label">Status Penghuni</span>
                <span className="data-value">{c?.statusPenghuni || "—"}</span>
              </div>
            </div>
          </section>

          {/* Section 3: Masa Penahanan & Sel */}
          <section className="dossier-section-card">
            <div className="section-card-header">
              <Icon name="calendar" size={16} className="section-icon" />
              <h4>Masa Penahanan & Lokasi Kamar Sel</h4>
            </div>
            <div className="section-data-grid">
              <div className="data-field">
                <span className="data-label">Mulai Ditahan</span>
                <span className="data-value">{c?.tglMulaiDitahan || "—"}</span>
              </div>
              <div className="data-field">
                <span className="data-label">Tanggal Ekspirasi</span>
                <span className="data-value text-info font-medium">{c?.tglEkspirasi || "—"}</span>
              </div>
              <div className="data-field">
                <span className="data-label">Sisa Masa Pidana</span>
                <span className="data-value font-semibold">{c?.sisaPidana || "—"}</span>
              </div>
              <div className="data-field">
                <span className="data-label">Lokasi Kamar / Sel</span>
                <span className="data-value">{c?.tempatLokasiSel || "—"}</span>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Dossier Footer Action Bar */}
      <footer className="dossier-footer-bar">
        <div className="dossier-primary-actions">
          <Link
            to={`/identitas/${item.nomorInduk}`}
            className="btn btn-primary"
          >
            <Icon name="eye" size={15} />
            <span>Buka Halaman Detail Penuh</span>
          </Link>

          {access.canWrite ? (
            <Link to={`/identitas/${item.nomorInduk}/ubah`} className="btn btn-secondary">
              <Icon name="edit" size={15} />
              <span>Ubah Identitas</span>
            </Link>
          ) : null}

          {access.canDelete ? (
            <Link to={`/identitas/${item.nomorInduk}/hapus`} className="btn btn-danger-outline">
              <Icon name="trash" size={15} />
              <span>Hapus Data</span>
            </Link>
          ) : null}
        </div>

        <div className="dossier-page-indicator">
          Halaman <strong>{page}</strong> dari <strong>{pages}</strong>
        </div>
      </footer>
    </article>
  );
}

// -------------------------------------------------------------
// Helper Functions & Renderers
// -------------------------------------------------------------
function renderSortableTh(columnKey: string, label: string, params: URLSearchParams) {
  const sortKey = SORT_KEYS[columnKey];
  const activeSort = params.get("sort") ?? "noin";
  const activeOrder = params.get("order") ?? "desc";
  const isActive = activeSort === sortKey;
  const nextOrder = isActive && activeOrder === "asc" ? "desc" : "asc";

  if (!sortKey) {
    return <span className="th-label">{label}</span>;
  }

  return (
    <Link
      to={qs(params, { sort: sortKey, order: nextOrder })}
      className={`th-sort-link ${isActive ? "is-active" : ""}`}
      title={`Urutkan berdasarkan ${label}`}
    >
      <span>{label}</span>
      <span className="th-sort-icon">
        {isActive ? (
          activeOrder === "asc" ? "↑" : "↓"
        ) : (
          <span className="th-sort-idle">↕</span>
        )}
      </span>
    </Link>
  );
}

function renderSearchInput(
  field: string,
  currentValue: string,
  agama: LookupItem[],
  pendidikan: LookupItem[]
) {
  const inputClass = "search-input-field";

  if (field === "jk") {
    return (
      <select name="q" defaultValue={currentValue || "L"} className={inputClass}>
        <option value="L">Laki-laki (Pria)</option>
        <option value="P">Perempuan (Wanita)</option>
      </select>
    );
  }
  if (field === "wg") {
    return (
      <select name="q" defaultValue={currentValue || "WNI"} className={inputClass}>
        <option value="WNI">Warga Negara Indonesia (WNI)</option>
        <option value="WNA">Warga Negara Asing (WNA)</option>
      </select>
    );
  }
  if (field === "ver") {
    return (
      <select name="q" defaultValue={currentValue || "Sudah"} className={inputClass}>
        <option value="Sudah">Sudah Terverifikasi</option>
        <option value="Belum">Belum Terverifikasi</option>
      </select>
    );
  }
  if (field === "res" || field === "ruh") {
    return (
      <select name="q" defaultValue={currentValue || "Ya"} className={inputClass}>
        <option value="Ya">Ya</option>
        <option value="Tidak">Tidak</option>
      </select>
    );
  }
  if (field === "agama") {
    return (
      <select name="q" defaultValue={currentValue} className={inputClass}>
        <option value="">-- Pilih Agama --</option>
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
      <select name="q" defaultValue={currentValue} className={inputClass}>
        <option value="">-- Pilih Pendidikan --</option>
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
        type="text"
        name="q"
        defaultValue={currentValue}
        placeholder="Format: dd/mm/yyyy atau yyyy-mm-dd..."
        className={inputClass}
      />
    );
  }

  const placeholderMap: Record<string, string> = {
    nama: "Ketik nama lengkap WBP / Tahanan...",
    no_induk: "Masukkan nomor induk identitas...",
    no_reg: "Masukkan nomor registrasi berkas...",
    usia: "Masukkan umur / usia...",
    alamat: "Cari berdasarkan nama jalan, kota, dll...",
    uu: "Ketik pasal / undang-undang tindak pidana...",
  };

  return (
    <input
      type="text"
      name="q"
      defaultValue={currentValue}
      placeholder={placeholderMap[field] ?? "Ketik kata kunci pencarian..."}
      className={inputClass}
      autoComplete="off"
    />
  );
}

function renderPaginationNumbers(currentPage: number, totalPages: number, params: URLSearchParams) {
  const pages: Array<number | string> = [];
  const maxButtons = 7;

  if (totalPages <= maxButtons) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (currentPage > 3) pages.push("...");

    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);

    for (let i = start; i <= end; i++) pages.push(i);

    if (currentPage < totalPages - 2) pages.push("...");
    pages.push(totalPages);
  }

  return pages.map((page, idx) => {
    if (typeof page === "string") {
      return (
        <span key={`ellipsis-${idx}`} className="pagination-ellipsis">
          …
        </span>
      );
    }
    const isCurrent = page === currentPage;
    return (
      <Link
        key={page}
        to={qs(params, { page })}
        className={`pagination-num-btn ${isCurrent ? "active" : ""}`}
        aria-current={isCurrent ? "page" : undefined}
      >
        {page}
      </Link>
    );
  });
}

function getInitials(name: string | null): string {
  if (!name) return "—";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
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
    .map((key) => (
      <input key={key} type="hidden" name={key} value={params.get(key) ?? ""} />
    ));
}

// -------------------------------------------------------------
// Scalable Icon Component
// -------------------------------------------------------------
type IconName =
  | "calendar"
  | "check"
  | "chevron-left"
  | "chevron-right"
  | "download"
  | "edit"
  | "eye"
  | "file-text"
  | "filter"
  | "fingerprint"
  | "grid"
  | "id-card"
  | "layers"
  | "more-horizontal"
  | "plus"
  | "search"
  | "search-x"
  | "sliders"
  | "trash"
  | "user-check"
  | "users"
  | "x";

function Icon({
  name,
  size = 16,
  className = "",
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
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
    case "user-check":
      paths = (
        <>
          <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="8.5" cy="7" r="4" />
          <polyline points="17 11 19 13 23 9" />
        </>
      );
      break;
    case "grid":
      paths = (
        <>
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
        </>
      );
      break;
    case "plus":
      paths = <path d="M12 5v14M5 12h14" />;
      break;
    case "download":
      paths = (
        <>
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </>
      );
      break;
    case "filter":
      paths = (
        <>
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
        </>
      );
      break;
    case "sliders":
      paths = (
        <>
          <line x1="4" y1="21" x2="4" y2="14" />
          <line x1="4" y1="10" x2="4" y2="3" />
          <line x1="12" y1="21" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12" y2="3" />
          <line x1="20" y1="21" x2="20" y2="16" />
          <line x1="20" y1="12" x2="20" y2="3" />
          <line x1="1" y1="14" x2="7" y2="14" />
          <line x1="9" y1="8" x2="15" y2="8" />
          <line x1="17" y1="16" x2="23" y2="16" />
        </>
      );
      break;
    case "search":
      paths = (
        <>
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </>
      );
      break;
    case "search-x":
      paths = (
        <>
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
          <line x1="8.5" y1="8.5" x2="13.5" y2="13.5" />
          <line x1="13.5" y1="8.5" x2="8.5" y2="13.5" />
        </>
      );
      break;
    case "file-text":
      paths = (
        <>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </>
      );
      break;
    case "calendar":
      paths = (
        <>
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </>
      );
      break;
    case "fingerprint":
      paths = (
        <>
          <path d="M2 12C2 6.5 6.5 2 12 2a10 10 0 0 1 8 4" />
          <path d="M5 19.5C5.5 18 6 15 6 12c0-.7.1-1.4.3-2" />
          <path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4" />
          <path d="M8.65 22c.21-.66.45-1.32.75-2" />
          <path d="M14 13.12c0 2.38 0 6.38-1 8.88" />
          <path d="M2 16h.01" />
          <path d="M21.8 16c.2-2 .131-5.354 0-6" />
          <path d="M9 6.8a6 6 0 0 1 9 5.2c0 .47 0 1.17-.02 2" />
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
    case "eye":
      paths = (
        <>
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </>
      );
      break;
    case "edit":
      paths = (
        <>
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </>
      );
      break;
    case "trash":
      paths = (
        <>
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          <line x1="10" y1="11" x2="10" y2="17" />
          <line x1="14" y1="11" x2="14" y2="17" />
        </>
      );
      break;
    case "more-horizontal":
      paths = (
        <>
          <circle cx="12" cy="12" r="1.5" />
          <circle cx="19" cy="12" r="1.5" />
          <circle cx="5" cy="12" r="1.5" />
        </>
      );
      break;
    case "check":
      paths = <polyline points="20 6 9 17 4 12" />;
      break;
    case "x":
      paths = (
        <>
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </>
      );
      break;
    case "chevron-left":
      paths = <polyline points="15 18 9 12 15 6" />;
      break;
    case "chevron-right":
      paths = <polyline points="9 18 15 12 9 6" />;
      break;
    case "users":
      paths = (
        <>
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </>
      );
      break;
  }

  return (
    <svg
      className={`svg-icon ${className}`}
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
