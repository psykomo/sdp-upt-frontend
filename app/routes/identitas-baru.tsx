import { Form, Link, isRouteErrorResponse, redirect, useNavigation } from "react-router";
import { useState } from "react";
import { apiGet, apiPostJson, failData, isApiFail } from "../lib/session";
import type { Route } from "./+types/identitas-baru";
import { HeroAvatar, Icon, IdentitasFormTabs } from "./identitas-form-fields";
import {
  FORM_TABS,
  type CreateMatch,
  type FormTabId,
  type FormValues,
  type LookupItem,
  type SimilarItem,
  buildIdentitasPayload,
  str,
} from "./identitas-form-shared";

type Access = { level: string; canWrite: boolean; canDelete: boolean; canPrint: boolean };
type BaruForm = {
  nomorInduk: string | null;
  namaLengkap: string | null;
  isTahanan: boolean;
  access: Access;
  readOnly: boolean;
  canEditSensitiveFields?: boolean;
  lockedFields?: string[];
  case: null;
  links: { kembali: string };
  values: FormValues;
  foto: Record<string, string | null>;
  sidikJari: Record<string, string | null>;
  identitasLama: SimilarItem[];
  lookups: Record<string, LookupItem[]>;
};

type ActionResult = {
  ok: false;
  message: string;
  errors: Record<string, string>;
  matches?: CreateMatch[];
  status?: number;
};

export function meta() {
  return [{ title: "Tambah Identitas — SDP 4.0" }];
}

export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  try {
    return await apiGet<BaruForm>("/identitas/form", request);
  } catch (error) {
    if (isFormForbidden(error)) {
      throw redirect("/identitas");
    }
    throw error;
  }
}

function isFormForbidden(error: unknown): boolean {
  if (isRouteErrorResponse(error) && error.status === 403) {
    return true;
  }

  return (
    typeof error === "object" &&
    error !== null &&
    "type" in error &&
    (error as { type?: string }).type === "DataWithResponseInit" &&
    (error as { init?: { status?: number } }).init?.status === 403
  );
}

export async function clientAction({ request }: Route.ClientActionArgs) {
  const form = await request.formData();
  const payload = await buildIdentitasPayload(form);

  const result = await apiPostJson<{ nomorInduk: string }>("/identitas", payload, request);

  if (isApiFail(result)) {
    return failData(result);
  }

  throw redirect(`/identitas/${encodeURIComponent(result.nomorInduk)}`);
}

export default function IdentitasBaruPage({ loaderData, actionData }: Route.ComponentProps) {
  const d = loaderData;
  const v = d.values;
  const navigation = useNavigation();
  const saving = navigation.state === "submitting";
  const disabled = d.readOnly || saving;
  const locked = new Set(d.lockedFields ?? []);
  const fieldLocked = (name: string) => locked.has(name);
  const inputDisabled = (name?: string) => disabled || (name ? fieldLocked(name) : false);
  const [tab, setTab] = useState<FormTabId>("biodata");
  const [wni, setWni] = useState(String(v.kewarganegaraan ?? "WNI") === "WNI");
  const [propinsi, setPropinsi] = useState(String(v.propinsi ?? ""));
  const [suku, setSuku] = useState(String(v.suku ?? ""));
  const [agama, setAgama] = useState(String(v.agama ?? ""));
  const [pendidikan, setPendidikan] = useState(String(v.pendidikan ?? ""));
  const [pekerjaan, setPekerjaan] = useState(String(v.jenisPekerjaan ?? ""));
  const [keahlian1, setKeahlian1] = useState(String(v.keahlian1 ?? ""));
  const [keahlian2, setKeahlian2] = useState(String(v.keahlian2 ?? ""));
  const [residivis, setResidivis] = useState(String(v.residivis ?? ""));
  const [similarList, setSimilarList] = useState(d.identitasLama);
  const similarCsv = similarList.map((item) => item.nomorInduk).join(",");
  const errors = (actionData as ActionResult | undefined)?.errors ?? {};
  const matches = (actionData as ActionResult | undefined)?.matches ?? [];
  const displayName = str(v.namaLengkap) || "Identitas Baru";

  return (
    <main className="modern-page-shell detail-container">
      <nav className="detail-top-nav" aria-label="Navigasi Halaman">
        <Link to="/identitas" className="btn-back-link">
          <Icon name="arrow-left" size={14} />
          <span>Kembali ke Direktori</span>
        </Link>
        <div className="detail-breadcrumbs">
          <span>SDP 4.0</span>
          <span className="separator">/</span>
          <Link to="/identitas">Manajemen Identitas</Link>
          <span className="separator">/</span>
          <span className="current">Tambah Identitas</span>
        </div>
      </nav>

      <header className="detail-hero-card">
        <div className="hero-left-section">
          <HeroAvatar src={d.foto.depan} name={displayName} />

          <div className="hero-info-stack">
            <div className="hero-title-row">
              <h1 className="hero-wbp-name">Tambah Identitas</h1>
              <div className="hero-status-pills">
                <span className="status-badge status-verified">
                  <span className="status-dot" />
                  <span>Form Tambah Aktif</span>
                </span>
              </div>
            </div>

            <div className="hero-id-tags-row">
              <div className="id-tag-item">
                <span className="id-tag-label">No. Induk</span>
                <code className="monospace-id-tag">Autogenerate</code>
              </div>
            </div>
          </div>
        </div>

        <div className="hero-actions-section">
          <div className="hero-action-buttons">
            <Link to="/identitas" className="btn btn-secondary">
              <span>Batal</span>
            </Link>
            {!d.readOnly ? (
              <button
                type="submit"
                form="form-baru-identitas"
                className="btn btn-primary"
                disabled={disabled}
              >
                <Icon name="check" size={14} />
                <span>{saving ? "Menyimpan…" : "Simpan Identitas"}</span>
              </button>
            ) : null}
          </div>

          <div className="hero-meta-indicator">
            <span className="form-mode-label">Pendaftaran Identitas WBP Baru</span>
          </div>
        </div>
      </header>

      {actionData?.message ? (
        <div className="form-alert" role="alert">
          <Icon name="alert-triangle" size={18} />
          <div className="form-alert-content">
            <strong>
              {(actionData as ActionResult).status === 409
                ? "Ditemukan Identitas Mirip"
                : "Gagal Menyimpan Identitas"}
            </strong>
            <p>{actionData.message}</p>
          </div>
        </div>
      ) : null}

      {matches.length > 0 ? (
        <section className="content-card" aria-label="Identitas mirip">
          <div className="content-card-header">
            <Icon name="users" size={18} className="section-icon" />
            <h3>Identitas yang Mirip</h3>
          </div>
          <div className="identitas-lama-grid">
            {matches.map((item) => (
              <div key={item.nomorInduk} className="identitas-lama-card">
                <div className="lama-info">
                  <Link to={`/identitas/${item.nomorInduk}`} className="lama-name-link">
                    {item.namaLengkap || item.nomorInduk}
                  </Link>
                  <code className="monospace-id-tag">{item.nomorInduk}</code>
                  {item.tanggalLahir ? (
                    <span className="form-field-helper-txt">Lahir: {item.tanggalLahir}</span>
                  ) : null}
                </div>
                <Link to={`/identitas/${item.nomorInduk}`} className="btn btn-secondary btn-sm">
                  <Icon name="eye" size={13} />
                  <span>Lihat</span>
                </Link>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <Form
        id="form-baru-identitas"
        method="post"
        encType="multipart/form-data"
        className="ubah-form"
        noValidate
      >
        <input type="hidden" name="nomorInduk" value="" />
        <input type="hidden" name="idSidikJari" defaultValue={str(v.idSidikJari)} />
        <input type="hidden" name="nomorIndukSimilar" value={similarCsv} />
        <input type="hidden" name="fotoKiriPath" defaultValue={str(v.fotoKiriPath)} />
        <input type="hidden" name="fotoKananPath" defaultValue={str(v.fotoKananPath)} />
        <input type="hidden" name="fotoDepanPath" defaultValue={str(v.fotoDepanPath)} />
        <input type="hidden" name="fotoCloseupPath" defaultValue={str(v.fotoCloseupPath)} />
        <input type="hidden" name="fotoCiri1Path" defaultValue={str(v.fotoCiri1Path)} />
        <input type="hidden" name="fotoCiri2Path" defaultValue={str(v.fotoCiri2Path)} />
        <input type="hidden" name="fotoCiri3Path" defaultValue={str(v.fotoCiri3Path)} />

        <IdentitasFormTabs
          tab={tab}
          onTabChange={setTab}
          tabs={[...FORM_TABS]}
          values={v}
          lookups={d.lookups}
          foto={d.foto}
          errors={errors}
          disabled={disabled}
          inputDisabled={inputDisabled}
          nomorInduk=""
          nomorIndukDisplay="Autogenerate"
          nomorIndukHelper="Nomor Induk digenerate otomatis saat data disimpan"
          rekamSidikJariHref=""
          similarList={similarList}
          onSimilarChange={setSimilarList}
          canWriteSimilar={d.access.canWrite && !d.readOnly}
          wni={wni}
          setWni={setWni}
          propinsi={propinsi}
          setPropinsi={setPropinsi}
          suku={suku}
          setSuku={setSuku}
          agama={agama}
          setAgama={setAgama}
          pendidikan={pendidikan}
          setPendidikan={setPendidikan}
          pekerjaan={pekerjaan}
          setPekerjaan={setPekerjaan}
          keahlian1={keahlian1}
          setKeahlian1={setKeahlian1}
          keahlian2={keahlian2}
          setKeahlian2={setKeahlian2}
          residivis={residivis}
          setResidivis={setResidivis}
        />

        <div className="ubah-sticky-footer">
          <div className="footer-status-indicator">
            <span className="footer-wbp-name">Identitas Baru</span>
            <span className="footer-id-badge">Autogenerate</span>
          </div>

          <div className="footer-action-buttons">
            <Link to="/identitas" className="btn btn-secondary">
              <span>Batal</span>
            </Link>
            {!d.readOnly ? (
              <button
                type="submit"
                className="btn btn-primary btn-save-action"
                disabled={disabled}
              >
                <Icon name="check" size={15} />
                <span>{saving ? "Menyimpan…" : "Simpan Identitas Baru"}</span>
              </button>
            ) : null}
          </div>
        </div>
      </Form>
    </main>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const forbidden = isRouteErrorResponse(error) && error.status === 403;
  const message = isRouteErrorResponse(error)
    ? String(error.data || error.statusText)
    : "Terjadi kesalahan saat memuat formulir tambah identitas.";

  return (
    <main className="modern-page-shell">
      <div className="empty-state-box error-box">
        <div className="empty-icon-circle error-icon">
          <Icon name="alert-triangle" size={24} />
        </div>
        <h3 className="empty-title">
          {forbidden ? "Akses Ditolak — Hak Akses Tidak Memadai" : "Gagal Memuat Formulir"}
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
