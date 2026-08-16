import { Form, Link, redirect, useActionData, useNavigation } from "react-router";
import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { apiGet, apiPutJson, fileToPayload, requireToken } from "../lib/session.server";
import type { Route } from "./+types/identitas-ubah";

type LookupItem = { id: string; label: string; propinsiId?: string };
type Access = { level: string; canWrite: boolean; canDelete: boolean; canPrint: boolean };
type FormValues = Record<string, string | boolean>;
type UbahForm = {
  nomorInduk: string;
  namaLengkap: string | null;
  isTahanan: boolean;
  access: Access;
  readOnly: boolean;
  case: {
    nomorBerkas: string;
    nomorRegistrasi: string;
    jenisRegistrasi: string;
    kejahatan: string;
    statusPenghuni: string;
    statusSubPenghuni: string;
  };
  links: { lihat: string; rekamSidikJari: string };
  values: FormValues;
  foto: Record<string, string | null>;
  sidikJari: Record<string, string | null>;
  identitasLama: Array<{ nomorInduk: string; namaLengkap: string | null; href: string | null }>;
  lookups: Record<string, LookupItem[]>;
};

type ActionResult = { ok: false; message: string; errors: Record<string, string> };

type FormTab = "biodata" | "pekerjaan" | "keluarga" | "fisik" | "sidik-jari" | "foto";

type IconName =
  | "activity"
  | "alert-triangle"
  | "arrow-left"
  | "award"
  | "briefcase"
  | "calendar"
  | "camera"
  | "check"
  | "clock"
  | "edit"
  | "eye"
  | "file-text"
  | "fingerprint"
  | "heart"
  | "id-card"
  | "layers"
  | "lock"
  | "map-pin"
  | "phone"
  | "shield"
  | "trash"
  | "upload"
  | "users";

const TABS: Array<{ id: FormTab; label: string; icon: IconName; num: string }> = [
  { id: "biodata", label: "Biodata & Alamat", icon: "id-card", num: "01" },
  { id: "pekerjaan", label: "Pekerjaan & Keahlian", icon: "briefcase", num: "02" },
  { id: "keluarga", label: "Relasi Keluarga", icon: "users", num: "03" },
  { id: "fisik", label: "Data Fisik & Ciri Khusus", icon: "activity", num: "04" },
  { id: "sidik-jari", label: "Sidik Jari Biometrik", icon: "fingerprint", num: "05" },
  { id: "foto", label: "Galeri Foto 4 Sudut", icon: "camera", num: "06" },
];

const BOOL_FIELDS = [
  "beresikoTinggi",
  "pengaruhMasyarakat",
  "disabilitas",
  "bacaLatin",
  "bacaQuran",
] as const;

const FILE_FIELDS = [
  "fotoKiri",
  "fotoKanan",
  "fotoDepan",
  "fotoCloseup",
  "ciri1File",
  "ciri2File",
  "ciri3File",
] as const;

export function meta({ loaderData }: Route.MetaArgs) {
  const nama = loaderData?.namaLengkap ? ` — ${loaderData.namaLengkap}` : "";
  return [{ title: `Ubah Identitas${nama} — SDP 4.0` }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const token = await requireToken(request);
  return apiGet<UbahForm>(token, `/identitas/${encodeURIComponent(params.nomorInduk)}/form`, request);
}

export async function action({ request, params }: Route.ActionArgs) {
  const token = await requireToken(request);
  const form = await request.formData();
  const payload: Record<string, unknown> = {};

  for (const [key, value] of form.entries()) {
    if (typeof value !== "string") continue;
    if (FILE_FIELDS.includes(key as (typeof FILE_FIELDS)[number])) continue;
    payload[key] = value;
  }

  for (const key of BOOL_FIELDS) {
    payload[key] = form.getAll(key).includes("1");
  }

  const files = {
    fotoKiri: await fileToPayload(form.get("fotoKiri") as File | null),
    fotoKanan: await fileToPayload(form.get("fotoKanan") as File | null),
    fotoDepan: await fileToPayload(form.get("fotoDepan") as File | null),
    fotoCloseup: await fileToPayload(form.get("fotoCloseup") as File | null),
    fotoCiri1: await fileToPayload(form.get("ciri1File") as File | null),
    fotoCiri2: await fileToPayload(form.get("ciri2File") as File | null),
    fotoCiri3: await fileToPayload(form.get("ciri3File") as File | null),
  };
  for (const [key, file] of Object.entries(files)) {
    if (file) payload[key] = file;
  }

  const result = await apiPutJson<{ nomorInduk: string }>(
    token,
    `/identitas/${encodeURIComponent(params.nomorInduk)}`,
    payload,
    request,
  );

  if (result && typeof result === "object" && "ok" in result && result.ok === false) {
    return result;
  }

  throw redirect(`/identitas/${encodeURIComponent(params.nomorInduk)}`);
}

export default function IdentitasUbahPage({ loaderData }: Route.ComponentProps) {
  const d = loaderData;
  const v = d.values;
  const actionData = useActionData<ActionResult>();
  const navigation = useNavigation();
  const saving = navigation.state === "submitting";
  const disabled = d.readOnly || saving;
  const [tab, setTab] = useState<FormTab>("biodata");
  const [wni, setWni] = useState(String(v.kewarganegaraan ?? "WNI") === "WNI");
  const [propinsi, setPropinsi] = useState(String(v.propinsi ?? ""));
  const [suku, setSuku] = useState(String(v.suku ?? ""));
  const [agama, setAgama] = useState(String(v.agama ?? ""));
  const [pendidikan, setPendidikan] = useState(String(v.pendidikan ?? ""));
  const [pekerjaan, setPekerjaan] = useState(String(v.jenisPekerjaan ?? ""));
  const [keahlian1, setKeahlian1] = useState(String(v.keahlian1 ?? ""));
  const [keahlian2, setKeahlian2] = useState(String(v.keahlian2 ?? ""));
  const [residivis, setResidivis] = useState(String(v.residivis ?? ""));

  const kotaOptions = useMemo(
    () => (d.lookups.dati2 ?? []).filter((item) => !propinsi || item.propinsiId === propinsi),
    [d.lookups.dati2, propinsi],
  );

  const errors = actionData?.errors ?? {};

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
          <span className="current">Ubah Identitas</span>
        </div>
      </nav>

      {/* 2. Executive Hero Profile Card */}
      <header className="detail-hero-card">
        <div className="hero-left-section">
          <HeroAvatar
            src={d.foto.depan}
            name={d.namaLengkap}
          />

          <div className="hero-info-stack">
            <div className="hero-title-row">
              <h1 className="hero-wbp-name">{d.namaLengkap || "—"}</h1>
              <div className="hero-status-pills">
                {d.isTahanan ? (
                  <span className="tag-pill tag-tahanan">Tahanan</span>
                ) : (
                  <span className="tag-pill tag-napi">Narapidana</span>
                )}
                {d.readOnly ? (
                  <span className="status-badge status-unverified">
                    <Icon name="lock" size={12} />
                    <span>Mode Baca (Terkunci)</span>
                  </span>
                ) : (
                  <span className="status-badge status-verified">
                    <span className="status-dot" />
                    <span>Form Edit Aktif</span>
                  </span>
                )}
              </div>
            </div>

            <div className="hero-id-tags-row">
              <div className="id-tag-item">
                <span className="id-tag-label">No. Induk</span>
                <code className="monospace-id-tag">{d.nomorInduk}</code>
              </div>
              {str(v.nik) ? (
                <div className="id-tag-item">
                  <span className="id-tag-label">NIK KTP</span>
                  <code className="monospace-reg-tag">{str(v.nik)}</code>
                </div>
              ) : null}
              {d.case.nomorRegistrasi ? (
                <div className="id-tag-item">
                  <span className="id-tag-label">No. Registrasi</span>
                  <code className="monospace-reg-tag">{d.case.nomorRegistrasi}</code>
                </div>
              ) : null}
            </div>

            <div className="hero-chips-row">
              {d.case.jenisRegistrasi ? (
                <span className="meta-chip">
                  <Icon name="layers" size={13} />
                  <span>Registrasi: <strong>{d.case.jenisRegistrasi}</strong></span>
                </span>
              ) : null}
              {d.case.kejahatan ? (
                <span className="meta-chip chip-warning">
                  <Icon name="activity" size={13} />
                  <span>Kejahatan: <strong>{d.case.kejahatan}</strong></span>
                </span>
              ) : null}
            </div>
          </div>
        </div>

        {/* Hero Actions Cluster */}
        <div className="hero-actions-section">
          <div className="hero-action-buttons">
            <Link to={`/identitas/${d.nomorInduk}`} className="btn btn-secondary">
              <span>Batal</span>
            </Link>
            {!d.readOnly ? (
              <button
                type="submit"
                form="form-ubah-identitas"
                className="btn btn-primary"
                disabled={disabled}
              >
                <Icon name="check" size={14} />
                <span>{saving ? "Menyimpan…" : "Simpan Perubahan"}</span>
              </button>
            ) : null}
          </div>

          <div className="hero-meta-indicator">
            <span className="form-mode-label">
              {d.readOnly ? "Akses Terbatas: Hanya Baca" : "Pemutakhiran Data WBP"}
            </span>
          </div>
        </div>
      </header>

      {d.readOnly ? (
        <div className="empty-panel-notice" role="alert">
          <Icon name="lock" size={16} />
          <span>Pusat/Kanwil atau hak akses baca tidak dapat mengubah identitas. Form ini disajikan dalam mode tampilan saja.</span>
        </div>
      ) : null}

      {actionData?.message ? (
        <div className="form-alert" role="alert">
          <Icon name="alert-triangle" size={18} />
          <div className="form-alert-content">
            <strong>Gagal Menyimpan Perubahan</strong>
            <p>{actionData.message}</p>
          </div>
        </div>
      ) : null}

      {/* 3. Main Form with Segmented Dossier Tabs */}
      <Form
        id="form-ubah-identitas"
        method="post"
        encType="multipart/form-data"
        className="ubah-form"
        noValidate
      >
        <input type="hidden" name="nomorInduk" value={d.nomorInduk} />
        <input type="hidden" name="idSidikJari" defaultValue={str(v.idSidikJari)} />
        <input type="hidden" name="nomorIndukSimilar" defaultValue={str(v.nomorIndukSimilar)} />
        <input type="hidden" name="fotoKiriPath" defaultValue={str(v.fotoKiriPath)} />
        <input type="hidden" name="fotoKananPath" defaultValue={str(v.fotoKananPath)} />
        <input type="hidden" name="fotoDepanPath" defaultValue={str(v.fotoDepanPath)} />
        <input type="hidden" name="fotoCloseupPath" defaultValue={str(v.fotoCloseupPath)} />
        <input type="hidden" name="fotoCiri1Path" defaultValue={str(v.fotoCiri1Path)} />
        <input type="hidden" name="fotoCiri2Path" defaultValue={str(v.fotoCiri2Path)} />
        <input type="hidden" name="fotoCiri3Path" defaultValue={str(v.fotoCiri3Path)} />

        {/* Tab Navigation */}
        <div className="detail-tabs-bar" role="tablist">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              className={`detail-tab-btn ${tab === item.id ? "active" : ""}`}
              onClick={() => setTab(item.id)}
            >
              <span className="tab-index-num">{item.num}</span>
              <Icon name={item.icon} size={15} />
              <span>{item.label}</span>
            </button>
          ))}
        </div>

        {/* TAB 1: BIODATA & ALAMAT */}
        <section className="content-card" hidden={tab !== "biodata"}>
          <div className="content-card-header">
            <Icon name="id-card" size={18} className="section-icon" />
            <h3>Biodata & Identitas Personal</h3>
          </div>

          <div className="form-section-group">
            <h4 className="form-section-title">Identitas Utama & Kependudukan</h4>
            <div className="form-grid-2col">
              <LockedField
                label="Nomor Induk WBP"
                value={d.nomorInduk}
                helperText="Nomor Induk digenerate otomatis dan tidak dapat diubah"
              />
              <Text
                name="nik"
                label="NIK KTP (16 Digit)"
                defaultValue={str(v.nik)}
                error={errors.nik}
                disabled={disabled}
                maxLength={16}
                placeholder="Contoh: 1607102708670081"
              />
              <Text
                name="namaLengkap"
                label="Nama Lengkap Sesuai Berkas"
                defaultValue={str(v.namaLengkap)}
                error={errors.namaLengkap}
                disabled={disabled}
                required
                placeholder="Masukkan nama lengkap WBP"
              />
              <Select
                name="jenisKelamin"
                label="Jenis Kelamin"
                items={d.lookups.kelamin}
                defaultValue={str(v.jenisKelamin)}
                disabled={disabled}
              />
              <Text
                name="tanggalLahir"
                label="Tanggal Lahir"
                defaultValue={str(v.tanggalLahir)}
                error={errors.tanggalLahir}
                disabled={disabled}
                required
                placeholder="dd/mm/yyyy (Contoh: 27/08/1967)"
              />
              <Select
                name="kewarganegaraan"
                label="Kewarganegaraan"
                items={d.lookups.kewarganegaraan}
                defaultValue={str(v.kewarganegaraan)}
                disabled={disabled}
                onChange={(value) => setWni(value === "WNI")}
              />
              {wni ? null : (
                <Select
                  name="negaraAsing"
                  label="Negara Asal / Asing"
                  items={d.lookups.negara}
                  defaultValue={str(v.negaraAsing)}
                  disabled={disabled}
                />
              )}
              <Select
                name="agama"
                label="Agama"
                items={d.lookups.agama}
                defaultValue={str(v.agama)}
                disabled={disabled}
                onChange={setAgama}
              />
              {agama === "LAIN" ? (
                <Text
                  name="agamaLain"
                  label="Keterangan Agama Lain"
                  defaultValue={str(v.agamaLain)}
                  disabled={disabled}
                  placeholder="Sebutkan agama"
                />
              ) : (
                <input type="hidden" name="agamaLain" value="" />
              )}
              <Select
                name="suku"
                label="Suku / Etnis"
                items={d.lookups.suku}
                defaultValue={str(v.suku)}
                disabled={disabled}
                onChange={setSuku}
              />
              {suku === "LAN" ? (
                <Text
                  name="sukuLain"
                  label="Keterangan Suku Lain"
                  defaultValue={str(v.sukuLain)}
                  disabled={disabled}
                  placeholder="Sebutkan suku"
                />
              ) : (
                <input type="hidden" name="sukuLain" value="" />
              )}
              <Select
                name="statusPerkawinan"
                label="Status Perkawinan"
                items={d.lookups.perkawinan}
                defaultValue={str(v.statusPerkawinan)}
                disabled={disabled}
              />
              <Select
                name="residivis"
                label="Status Residivis"
                items={d.lookups.residivis}
                defaultValue={str(v.residivis)}
                disabled={disabled}
                onChange={setResidivis}
              />
              {residivis === "RDV1" ? (
                <Text
                  name="residivisKe"
                  label="Residivis Kali Ke-"
                  defaultValue={str(v.residivisKe)}
                  disabled={disabled}
                  placeholder="Contoh: 2"
                />
              ) : (
                <input type="hidden" name="residivisKe" value="" />
              )}
            </div>
          </div>

          <div className="form-section-group">
            <h4 className="form-section-title">Tempat Asal & Wilayah Domisili</h4>
            <div className="form-grid-2col">
              {wni ? (
                <>
                  <Select
                    name="tempatLahir"
                    label="Tempat Lahir (Kota/Kab)"
                    items={d.lookups.dati2}
                    defaultValue={str(v.tempatLahir)}
                    disabled={disabled}
                  />
                  <Select
                    name="tempatAsal"
                    label="Tempat Asal (Kota/Kab)"
                    items={d.lookups.dati2}
                    defaultValue={str(v.tempatAsal)}
                    disabled={disabled}
                  />
                  <Select
                    name="propinsi"
                    label="Propinsi Domisili"
                    items={d.lookups.propinsi}
                    defaultValue={str(v.propinsi)}
                    disabled={disabled}
                    onChange={setPropinsi}
                  />
                  <Select
                    name="kota"
                    label="Kota / Kabupaten Domisili"
                    items={kotaOptions}
                    defaultValue={str(v.kota)}
                    disabled={disabled}
                  />
                  <input type="hidden" name="tempatLahirLain" defaultValue={str(v.tempatLahirLain)} />
                  <input type="hidden" name="propinsiLain" value="" />
                  <input type="hidden" name="kotaLain" value="" />
                  <input type="hidden" name="tempatAsalLain" value="" />
                </>
              ) : (
                <>
                  <Text
                    name="tempatLahirLain"
                    label="Tempat Lahir (Luar Negeri)"
                    defaultValue={str(v.tempatLahirLain)}
                    disabled={disabled}
                  />
                  <Text
                    name="tempatAsalLain"
                    label="Tempat Asal (Luar Negeri)"
                    defaultValue={str(v.tempatAsalLain)}
                    disabled={disabled}
                  />
                  <Text
                    name="propinsiLain"
                    label="Propinsi / Wilayah Asing"
                    defaultValue={str(v.propinsiLain)}
                    disabled={disabled}
                  />
                  <Text
                    name="kotaLain"
                    label="Kota Luar Negeri"
                    defaultValue={str(v.kotaLain)}
                    disabled={disabled}
                  />
                  <input type="hidden" name="tempatLahir" value="" />
                  <input type="hidden" name="tempatAsal" value="" />
                  <input type="hidden" name="propinsi" value="" />
                  <input type="hidden" name="kota" value="" />
                </>
              )}
            </div>
          </div>

          <div className="form-section-group">
            <h4 className="form-section-title">Alamat Lengkap & Kontak</h4>
            <div className="form-grid-2col">
              <div className="col-span-full">
                <Area
                  name="alamat"
                  label="Alamat Lengkap Tempat Tinggal"
                  defaultValue={str(v.alamat)}
                  error={errors.alamat}
                  disabled={disabled}
                  required
                  placeholder="Masukkan jalan, RT/RW, kelurahan, kecamatan, kabupaten/kota"
                />
              </div>
              <div className="col-span-full">
                <Text
                  name="alamatAlternatif"
                  label="Alamat Alternatif / Domisili Lain"
                  defaultValue={str(v.alamatAlternatif)}
                  disabled={disabled}
                  placeholder="Alamat tempat tinggal lain bila ada"
                />
              </div>
              <Text
                name="telepon"
                label="Nomor Telepon / Handphone"
                defaultValue={str(v.telepon)}
                disabled={disabled}
                placeholder="Contoh: 08123456789"
              />
              <Text
                name="kodepos"
                label="Kode Pos"
                defaultValue={str(v.kodepos)}
                error={errors.kodepos}
                disabled={disabled}
                maxLength={5}
                placeholder="Contoh: 30123"
              />
            </div>
          </div>

          <div className="form-section-group">
            <h4 className="form-section-title">Nama Alias & Nama Kecil</h4>
            <div className="form-grid-3col">
              <Text name="namaAlias1" label="Nama Alias 1" defaultValue={str(v.namaAlias1)} disabled={disabled} placeholder="Nama alias 1" />
              <Text name="namaAlias2" label="Nama Alias 2" defaultValue={str(v.namaAlias2)} disabled={disabled} placeholder="Nama alias 2" />
              <Text name="namaAlias3" label="Nama Alias 3" defaultValue={str(v.namaAlias3)} disabled={disabled} placeholder="Nama alias 3" />
              <Text name="namaKecil1" label="Nama Kecil 1" defaultValue={str(v.namaKecil1)} disabled={disabled} placeholder="Nama panggilan 1" />
              <Text name="namaKecil2" label="Nama Kecil 2" defaultValue={str(v.namaKecil2)} disabled={disabled} placeholder="Nama panggilan 2" />
              <Text name="namaKecil3" label="Nama Kecil 3" defaultValue={str(v.namaKecil3)} disabled={disabled} placeholder="Nama panggilan 3" />
            </div>
          </div>

          <div className="form-section-group">
            <h4 className="form-section-title">Status Khusus & Penilaian Keamanan</h4>
            <div className="form-checkbox-grid">
              <CheckCard
                name="beresikoTinggi"
                label="WBP Berisiko Tinggi (High Risk)"
                description="Perhatian khusus dalam pengawasan dan penempatan sel"
                defaultChecked={bool(v.beresikoTinggi)}
                disabled={disabled}
              />
              <CheckCard
                name="pengaruhMasyarakat"
                label="Pengaruh Terhadap Masyarakat"
                description="Perkara menarik perhatian publik atau tokoh masyarakat"
                defaultChecked={bool(v.pengaruhMasyarakat)}
                disabled={disabled}
              />
              <CheckCard
                name="disabilitas"
                label="Penyandang Disabilitas"
                description="Memerlukan sarana dan prasarana aksesibilitas khusus"
                defaultChecked={bool(v.disabilitas)}
                disabled={disabled}
              />
            </div>
          </div>
        </section>

        {/* TAB 2: PEKERJAAN & KEAHLIAN */}
        <section className="content-card" hidden={tab !== "pekerjaan"}>
          <div className="content-card-header">
            <Icon name="briefcase" size={18} className="section-icon" />
            <h3>Pekerjaan, Pendidikan & Keahlian</h3>
          </div>

          <div className="form-section-group">
            <h4 className="form-section-title">Riwayat Pekerjaan & Pendidikan</h4>
            <div className="form-grid-2col">
              <Select
                name="jenisPekerjaan"
                label="Jenis Pekerjaan Utama"
                items={d.lookups.pekerjaan}
                defaultValue={str(v.jenisPekerjaan)}
                disabled={disabled}
                onChange={setPekerjaan}
              />
              {pekerjaan === "89" ? (
                <Text
                  name="pekerjaanLain"
                  label="Pekerjaan Lain-lain"
                  defaultValue={str(v.pekerjaanLain)}
                  disabled={disabled}
                  placeholder="Sebutkan pekerjaan"
                />
              ) : (
                <input type="hidden" name="pekerjaanLain" value="" />
              )}
              {pekerjaan === "5" ? (
                <>
                  <Text
                    name="namaInstansiPns"
                    label="Nama Instansi / Departemen PNS"
                    defaultValue={str(v.namaInstansiPns)}
                    disabled={disabled}
                    placeholder="Nama Kementerian / Dinas"
                  />
                  <Text
                    name="nip"
                    label="NIP (Nomor Induk Pegawai)"
                    defaultValue={str(v.nip)}
                    disabled={disabled}
                    placeholder="18 digit NIP"
                  />
                </>
              ) : (
                <>
                  <input type="hidden" name="namaInstansiPns" value="" />
                  <input type="hidden" name="nip" value="" />
                </>
              )}
              <Select
                name="pendidikan"
                label="Tingkat Pendidikan Terakhir"
                items={d.lookups.pendidikan}
                defaultValue={str(v.pendidikan)}
                disabled={disabled}
                onChange={setPendidikan}
              />
              {pendidikan === "PDLA" ? (
                <Text
                  name="pendidikanLain"
                  label="Pendidikan Lain-lain"
                  defaultValue={str(v.pendidikanLain)}
                  disabled={disabled}
                  placeholder="Sebutkan tingkat pendidikan"
                />
              ) : (
                <input type="hidden" name="pendidikanLain" value="" />
              )}
              <Select
                name="tingkatPenghasilan"
                label="Tingkat Penghasilan Rata-rata"
                items={d.lookups.penghasilan}
                defaultValue={str(v.tingkatPenghasilan)}
                disabled={disabled}
              />
              <Text
                name="alamatPekerjaan"
                label="Alamat Tempat Bekerja / Usaha"
                defaultValue={str(v.alamatPekerjaan)}
                disabled={disabled}
                placeholder="Alamat kantor / tempat usaha"
              />
              <div className="col-span-full">
                <Area
                  name="keteranganPekerjaan"
                  label="Keterangan Detail Pekerjaan"
                  defaultValue={str(v.keteranganPekerjaan)}
                  disabled={disabled}
                  placeholder="Uraian tugas, jabatan, atau spesialisasi pekerjaan"
                />
              </div>
            </div>
          </div>

          <div className="form-section-group">
            <h4 className="form-section-title">Keahlian, Kemampuan & Minat</h4>
            <div className="form-grid-2col">
              <Select
                name="keahlian1"
                label="Keahlian Utama (Keahlian 1)"
                items={d.lookups.keahlian}
                defaultValue={str(v.keahlian1)}
                disabled={disabled}
                onChange={setKeahlian1}
              />
              <Select
                name="level1"
                label="Tingkat Kemahiran 1"
                items={d.lookups.level}
                defaultValue={str(v.level1)}
                disabled={disabled}
              />
              {keahlian1 === "ZA99" ? (
                <div className="col-span-full">
                  <Text
                    name="keahlian1Lain"
                    label="Keahlian 1 Lain-lain"
                    defaultValue={str(v.keahlian1Lain)}
                    disabled={disabled}
                    placeholder="Sebutkan keahlian lain"
                  />
                </div>
              ) : (
                <input type="hidden" name="keahlian1Lain" value="" />
              )}

              <Select
                name="keahlian2"
                label="Keahlian Tambahan (Keahlian 2)"
                items={d.lookups.keahlian}
                defaultValue={str(v.keahlian2)}
                disabled={disabled}
                onChange={setKeahlian2}
              />
              <Select
                name="level2"
                label="Tingkat Kemahiran 2"
                items={d.lookups.level}
                defaultValue={str(v.level2)}
                disabled={disabled}
              />
              {keahlian2 === "ZA99" ? (
                <div className="col-span-full">
                  <Text
                    name="keahlian2Lain"
                    label="Keahlian 2 Lain-lain"
                    defaultValue={str(v.keahlian2Lain)}
                    disabled={disabled}
                    placeholder="Sebutkan keahlian lain"
                  />
                </div>
              ) : (
                <input type="hidden" name="keahlian2Lain" value="" />
              )}

              <div className="col-span-full">
                <Area
                  name="minat"
                  label="Minat & Bakat WBP (Untuk Pembinaan)"
                  defaultValue={str(v.minat)}
                  disabled={disabled}
                  placeholder="Minat bidang pelatihan kemandirian / kepribadian"
                />
              </div>
            </div>

            <div className="form-checkbox-grid mt-4">
              <CheckCard
                name="bacaLatin"
                label="Mampu Membaca Huruf Latin"
                description="Literasi aksara Latin untuk bahan bacaan umum"
                defaultChecked={bool(v.bacaLatin)}
                disabled={disabled}
              />
              <CheckCard
                name="bacaQuran"
                label="Mampu Membaca Al-Qur'an / Kitab Suci"
                description="Kemampuan membaca kitab suci untuk pembinaan kerohanian"
                defaultChecked={bool(v.bacaQuran)}
                disabled={disabled}
              />
            </div>
          </div>
        </section>

        {/* TAB 3: RELASI KELUARGA */}
        <section className="content-card" hidden={tab !== "keluarga"}>
          <div className="content-card-header">
            <Icon name="users" size={18} className="section-icon" />
            <h3>Relasi Keluarga & Kontak Darurat</h3>
          </div>

          <div className="form-section-group">
            <h4 className="form-section-title">Data Orang Tua & Saudara Kandung</h4>
            <div className="form-grid-2col">
              <Text
                name="namaAyah"
                label="Nama Lengkap Ayah Kandung"
                defaultValue={str(v.namaAyah)}
                error={errors.namaAyah}
                disabled={disabled}
                required
                placeholder="Nama ayah"
              />
              <Text
                name="alamatAyah"
                label="Alamat / Tempat Tinggal Ayah"
                defaultValue={str(v.alamatAyah)}
                disabled={disabled}
                placeholder="Alamat atau domisili ayah"
              />
              <Text
                name="namaIbu"
                label="Nama Lengkap Ibu Kandung"
                defaultValue={str(v.namaIbu)}
                error={errors.namaIbu}
                disabled={disabled}
                required
                placeholder="Nama ibu"
              />
              <Text
                name="alamatIbu"
                label="Alamat / Tempat Tinggal Ibu"
                defaultValue={str(v.alamatIbu)}
                disabled={disabled}
                placeholder="Alamat atau domisili ibu"
              />
              <Text
                name="anakKe"
                label="Anak Urutan Ke-"
                defaultValue={str(v.anakKe)}
                error={errors.anakKe}
                disabled={disabled}
                placeholder="Contoh: 1"
              />
              <Text
                name="jumlahSaudara"
                label="Jumlah Saudara Kandung"
                defaultValue={str(v.jumlahSaudara)}
                error={errors.jumlahSaudara}
                disabled={disabled}
                placeholder="Contoh: 3"
              />
              <div className="col-span-full">
                <Area
                  name="namaSaudara"
                  label="Daftar Nama Saudara Kandung"
                  defaultValue={str(v.namaSaudara)}
                  disabled={disabled}
                  placeholder="Sebutkan nama saudara kandung dipisahkan tanda koma"
                />
              </div>
            </div>
          </div>

          <div className="form-section-group">
            <h4 className="form-section-title">Data Pasangan & Anak</h4>
            <div className="form-grid-2col">
              <Text
                name="jumlahIstriSuami"
                label="Jumlah Istri / Suami"
                defaultValue={str(v.jumlahIstriSuami)}
                error={errors.jumlahIstriSuami}
                disabled={disabled}
                placeholder="Contoh: 1"
              />
              <Text
                name="jumlahAnak"
                label="Jumlah Anak"
                defaultValue={str(v.jumlahAnak)}
                error={errors.jumlahAnak}
                disabled={disabled}
                required
                placeholder="Contoh: 2"
              />
              <div className="col-span-full">
                <Area
                  name="namaIstriSuami"
                  label="Nama Istri / Suami"
                  defaultValue={str(v.namaIstriSuami)}
                  disabled={disabled}
                  placeholder="Nama lengkap pasangan"
                />
              </div>
              <div className="col-span-full">
                <Text
                  name="alamatIstriSuami"
                  label="Alamat Tempat Tinggal Pasangan"
                  defaultValue={str(v.alamatIstriSuami)}
                  disabled={disabled}
                  placeholder="Alamat pasangan saat ini"
                />
              </div>
              <div className="col-span-full">
                <Area
                  name="namaAnak"
                  label="Daftar Nama Anak"
                  defaultValue={str(v.namaAnak)}
                  disabled={disabled}
                  placeholder="Sebutkan nama anak dipisahkan tanda koma"
                />
              </div>
              <div className="col-span-full">
                <Text
                  name="teleponKeluarga"
                  label="Nomor Telepon Kontak Keluarga (Darurat)"
                  defaultValue={str(v.teleponKeluarga)}
                  disabled={disabled}
                  placeholder="Contoh: 08123456789 (Kontak darurat yang dapat dihubungi)"
                />
              </div>
            </div>
          </div>
        </section>

        {/* TAB 4: DATA FISIK & CIRI KHUSUS */}
        <section className="content-card" hidden={tab !== "fisik"}>
          <div className="content-card-header">
            <Icon name="activity" size={18} className="section-icon" />
            <h3>Data Fisik, Antropometri & Ciri Khusus</h3>
          </div>

          <div className="form-section-group">
            <h4 className="form-section-title">Parameter Antropometri & Fisik</h4>
            <div className="form-grid-3col">
              <Text name="tinggi" label="Tinggi Badan (cm)" defaultValue={str(v.tinggi)} error={errors.tinggi} disabled={disabled} placeholder="Contoh: 170" />
              <Text name="berat" label="Berat Badan (kg)" defaultValue={str(v.berat)} error={errors.berat} disabled={disabled} placeholder="Contoh: 65" />
              <Select name="warnaKulit" label="Warna Kulit" items={d.lookups.kulit} defaultValue={str(v.warnaKulit)} disabled={disabled} />
              <Select name="bentukRambut" label="Bentuk Rambut" items={d.lookups.bentukRambut} defaultValue={str(v.bentukRambut)} disabled={disabled} />
              <Select name="warnaRambut" label="Warna Rambut" items={d.lookups.rambut} defaultValue={str(v.warnaRambut)} disabled={disabled} />
              <Select name="kacamata" label="Pemakaian Kacamata" items={d.lookups.kacamata} defaultValue={str(v.kacamata)} disabled={disabled} />
              <Select name="bentukMata" label="Bentuk Mata" items={d.lookups.bentukMata} defaultValue={str(v.bentukMata)} disabled={disabled} />
              <Select name="warnaMata" label="Warna Mata" items={d.lookups.warnaMata} defaultValue={str(v.warnaMata)} disabled={disabled} />
              <Select name="hidung" label="Bentuk Hidung" items={d.lookups.hidung} defaultValue={str(v.hidung)} disabled={disabled} />
              <Select name="rautMuka" label="Raut Muka / Wajah" items={d.lookups.muka} defaultValue={str(v.rautMuka)} disabled={disabled} />
              <Select name="bentukBibir" label="Bentuk Bibir" items={d.lookups.bibir} defaultValue={str(v.bentukBibir)} disabled={disabled} />
              <Select name="mulut" label="Bentuk Mulut" items={d.lookups.mulut} defaultValue={str(v.mulut)} disabled={disabled} />
              <Select name="telinga" label="Bentuk Telinga" items={d.lookups.telinga} defaultValue={str(v.telinga)} disabled={disabled} />
              <Select name="lengan" label="Bentuk Lengan" items={d.lookups.lengan} defaultValue={str(v.lengan)} disabled={disabled} />
              <Select name="tangan" label="Bentuk Tangan" items={d.lookups.tangan} defaultValue={str(v.tangan)} disabled={disabled} />
              <Select name="kaki" label="Bentuk Kaki" items={d.lookups.kaki} defaultValue={str(v.kaki)} disabled={disabled} />
              <div className="col-span-full">
                <Area name="cacat" label="Cacat Fisik / Tubuh Lainnya" defaultValue={str(v.cacat)} disabled={disabled} placeholder="Keterangan kelainan fisik atau cacat bawaan/cedera" />
              </div>
            </div>
          </div>

          <div className="form-section-group">
            <h4 className="form-section-title">Dokumentasi Ciri Khusus, Tato & Bekas Luka</h4>
            <div className="form-ciri-grid">
              <CiriSlot
                num={1}
                textName="ciri1"
                fileName="ciri1File"
                textValue={str(v.ciri1)}
                photoUrl={d.foto.ciri1}
                error={errors.ciri1}
                disabled={disabled}
              />
              <CiriSlot
                num={2}
                textName="ciri2"
                fileName="ciri2File"
                textValue={str(v.ciri2)}
                photoUrl={d.foto.ciri2}
                disabled={disabled}
              />
              <CiriSlot
                num={3}
                textName="ciri3"
                fileName="ciri3File"
                textValue={str(v.ciri3)}
                photoUrl={d.foto.ciri3}
                disabled={disabled}
              />
            </div>
          </div>
        </section>

        {/* TAB 5: SIDIK JARI */}
        <section className="content-card" hidden={tab !== "sidik-jari"}>
          <div className="content-card-header">
            <Icon name="fingerprint" size={18} className="section-icon" />
            <h3>Data Daktiloskopi & Sidik Jari Biometrik</h3>
          </div>

          <div className="biometric-notice-box">
            <div className="notice-icon-box">
              <Icon name="fingerprint" size={24} />
            </div>
            <div className="notice-text-content">
              <h4>Perekaman Sensor Biometrik 10 Jari</h4>
              <p>
                Perekaman gambar sidik jari biometrik menggunakan perangkat scanner fisik dilakukan melalui modul perekaman daktiloskopi khusus.
              </p>
              <a
                href={d.links.rekamSidikJari}
                target="_blank"
                rel="noreferrer"
                className="btn btn-secondary btn-sm"
              >
                <Icon name="edit" size={13} />
                <span>Buka Modul Scanner Perekaman Sidik Jari</span>
              </a>
            </div>
          </div>

          <div className="form-section-group">
            <h4 className="form-section-title">Parameter Rumus & Registrasi Daktil</h4>
            <div className="form-grid-2col">
              <Text
                name="pengambilSidikJari"
                label="Nama Petugas Pengambil Sidik Jari"
                defaultValue={str(v.pengambilSidikJari)}
                disabled={disabled}
                placeholder="Nama petugas daktil"
              />
              <Text
                name="noPaspor"
                label="Nomor Paspor (Bila Ada)"
                defaultValue={str(v.noPaspor)}
                disabled={disabled}
                placeholder="Nomor paspor aktif"
              />
              <Text
                name="rumusDaktil"
                label="Rumus Daktiloskopi Henry"
                defaultValue={str(v.rumusDaktil)}
                disabled={disabled}
                placeholder="Contoh: I 17 U O 12 / M 17 U O 10"
              />
              <Text
                name="nomorDaktil"
                label="Nomor Registrasi Kartu Daktiloskopi"
                defaultValue={str(v.nomorDaktil)}
                disabled={disabled}
                placeholder="Nomor kartu daktil"
              />
              <Text
                name="tanggalSidikJari"
                label="Tanggal Pengambilan Sidik Jari"
                defaultValue={str(v.tanggalSidikJari)}
                error={errors.tanggalSidikJari}
                disabled={disabled}
                placeholder="dd/mm/yyyy (Contoh: 14/01/2020)"
              />
            </div>
          </div>
        </section>

        {/* TAB 6: FOTO IDENTITAS 4 SUDUT */}
        <section className="content-card" hidden={tab !== "foto"}>
          <div className="content-card-header">
            <Icon name="camera" size={18} className="section-icon" />
            <h3>Dokumentasi Foto Identitas 4 Sudut</h3>
          </div>

          <p className="form-section-hint">
            Ambil foto dari kamera atau unggah berkas JPG/PNG. Foto disimpan saat Simpan.
          </p>

          <div className="photo-angles-upload-grid">
            <PhotoUploadAngleCard
              angleKey="fotoDepan"
              title="Tampak Depan"
              subtitle="Wajah menghadap lurus ke kamera"
              previewUrl={d.foto.depan}
              error={errors.fotoDepan}
              disabled={disabled}
              required
            />
            <PhotoUploadAngleCard
              angleKey="fotoKiri"
              title="Samping Kiri (90° / 45°)"
              subtitle="Profil wajah tampak sisi kiri"
              previewUrl={d.foto.kiri}
              error={errors.fotoKiri}
              disabled={disabled}
              required
            />
            <PhotoUploadAngleCard
              angleKey="fotoKanan"
              title="Samping Kanan (90° / 45°)"
              subtitle="Profil wajah tampak sisi kanan"
              previewUrl={d.foto.kanan}
              error={errors.fotoKanan}
              disabled={disabled}
              required
            />
            <PhotoUploadAngleCard
              angleKey="fotoCloseup"
              title="Close-Up Wajah"
              subtitle="Fokus area wajah & mata"
              previewUrl={d.foto.closeup}
              disabled={disabled}
            />
          </div>
        </section>

        {/* 4. Bottom Sticky Action Bar */}
        <div className="ubah-sticky-footer">
          <div className="footer-status-indicator">
            <span className="footer-wbp-name">{d.namaLengkap || "—"}</span>
            <span className="footer-id-badge">{d.nomorInduk}</span>
          </div>

          <div className="footer-action-buttons">
            <Link to={`/identitas/${d.nomorInduk}`} className="btn btn-secondary">
              <span>Batal</span>
            </Link>
            {!d.readOnly ? (
              <button
                type="submit"
                className="btn btn-primary btn-save-action"
                disabled={disabled}
              >
                <Icon name="check" size={15} />
                <span>{saving ? "Menyimpan Perubahan…" : "Simpan Perubahan Identitas"}</span>
              </button>
            ) : null}
          </div>
        </div>
      </Form>
    </main>
  );
}

// -------------------------------------------------------------
// Helper Formatters
// -------------------------------------------------------------
function str(value: unknown): string {
  if (value === null || value === undefined || value === false) return "";
  if (value === true) return "1";
  return String(value);
}

function bool(value: unknown): boolean {
  return value === true || value === 1 || value === "1";
}

function getInitials(name?: string | null): string {
  if (!name) return "—";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "—";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

// -------------------------------------------------------------
// Hero Avatar Component with Fallback
// -------------------------------------------------------------
function HeroAvatar({
  src,
  name,
}: {
  src?: string | null;
  name?: string | null;
}) {
  const [hasError, setHasError] = useState(!src);

  useEffect(() => {
    setHasError(!src);
  }, [src]);

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
          <div className="hero-initials-badge">
            {getInitials(name)}
          </div>
          <span className="hero-placeholder-label">Foto Belum Rekam</span>
        </div>
      )}
      <div className="hero-photo-tag">Foto Utama</div>
    </div>
  );
}

// -------------------------------------------------------------
// Form Components
// -------------------------------------------------------------
function Field({
  label,
  error,
  required,
  children,
}: {
  label: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="form-group-field">
      <label className="form-field-header">
        <span className="form-field-label-text">
          {label}
          {required ? <span className="text-required-mark"> *</span> : null}
        </span>
      </label>
      {children}
      {error ? <span className="form-field-error-msg">{error}</span> : null}
    </div>
  );
}

function LockedField({
  label,
  value,
  helperText,
}: {
  label: string;
  value: string;
  helperText?: string;
}) {
  return (
    <div className="form-group-field">
      <div className="form-field-header">
        <span className="form-field-label-text">{label}</span>
        <span className="locked-badge">
          <Icon name="lock" size={11} />
          <span>Sistem</span>
        </span>
      </div>
      <div className="locked-field-input-box">
        <code className="monospace-locked-val">{value}</code>
      </div>
      {helperText ? <span className="form-field-helper-txt">{helperText}</span> : null}
    </div>
  );
}

function Text({
  name,
  label,
  defaultValue,
  error,
  disabled,
  required,
  maxLength,
  placeholder,
}: {
  name: string;
  label: string;
  defaultValue: string;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  maxLength?: number;
  placeholder?: string;
}) {
  return (
    <Field label={label} error={error} required={required}>
      <input
        className={`form-modern-input ${error ? "has-input-error" : ""}`}
        name={name}
        defaultValue={defaultValue}
        disabled={disabled}
        required={required}
        maxLength={maxLength}
        placeholder={placeholder}
      />
    </Field>
  );
}

function Area({
  name,
  label,
  defaultValue,
  error,
  disabled,
  required,
  placeholder,
}: {
  name: string;
  label: string;
  defaultValue: string;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <Field label={label} error={error} required={required}>
      <textarea
        className={`form-modern-textarea ${error ? "has-input-error" : ""}`}
        name={name}
        defaultValue={defaultValue}
        disabled={disabled}
        required={required}
        placeholder={placeholder}
        rows={3}
      />
    </Field>
  );
}

function Select({
  name,
  label,
  items,
  defaultValue,
  disabled,
  required,
  onChange,
}: {
  name: string;
  label: string;
  items: LookupItem[] | undefined;
  defaultValue: string;
  disabled?: boolean;
  required?: boolean;
  onChange?: (value: string) => void;
}) {
  return (
    <Field label={label} required={required}>
      <div className="select-wrapper-styled">
        <select
          className="form-modern-select"
          name={name}
          defaultValue={defaultValue}
          disabled={disabled}
          onChange={(event) => onChange?.(event.target.value)}
        >
          <option value="">— Pilih {label} —</option>
          {(items ?? []).map((item) => (
            <option key={`${name}-${item.id}`} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </div>
    </Field>
  );
}

function CheckCard({
  name,
  label,
  description,
  defaultChecked,
  disabled,
}: {
  name: string;
  label: string;
  description?: string;
  defaultChecked: boolean;
  disabled?: boolean;
}) {
  const [checked, setChecked] = useState(defaultChecked);

  return (
    <label className={`checkbox-card-box ${checked ? "is-checked" : ""} ${disabled ? "is-disabled" : ""}`}>
      <input type="hidden" name={name} value="0" />
      <input
        type="checkbox"
        name={name}
        value="1"
        checked={checked}
        disabled={disabled}
        onChange={(e) => setChecked(e.target.checked)}
        className="sr-only"
      />
      <div className="custom-checkbox-indicator">
        {checked ? <Icon name="check" size={12} /> : null}
      </div>
      <div className="checkbox-text-stack">
        <span className="checkbox-main-label">{label}</span>
        {description ? <span className="checkbox-sub-desc">{description}</span> : null}
      </div>
    </label>
  );
}

function CiriSlot({
  num,
  textName,
  fileName,
  textValue,
  photoUrl,
  error,
  disabled,
}: {
  num: number;
  textName: string;
  fileName: string;
  textValue: string;
  photoUrl?: string | null;
  error?: string;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(photoUrl ?? null);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setPreview(photoUrl ?? null);
    setImgError(false);
  }, [photoUrl]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setPreview(url);
      setImgError(false);
    }
  };

  return (
    <div className="ciri-slot-card">
      <div className="ciri-slot-header">
        <span className="ciri-slot-badge">Ciri Khusus #{num}</span>
      </div>

      <div className="ciri-slot-body">
        <div className="ciri-preview-thumbnail">
          {preview && !imgError ? (
            <img
              src={preview}
              alt=""
              onError={() => setImgError(true)}
              className="ciri-img-preview"
              loading="lazy"
            />
          ) : (
            <div className="ciri-empty-placeholder">
              <Icon name="camera" size={20} />
              <span>Belum Ada Foto Ciri</span>
            </div>
          )}
        </div>

        <div className="ciri-fields-stack">
          <Field label={`Deskripsi Ciri Khusus ${num}`} error={error}>
            <textarea
              name={textName}
              defaultValue={textValue}
              disabled={disabled}
              rows={2}
              className="form-modern-textarea"
              placeholder={`Contoh: Tato motif naga di lengan kanan / bekas luka di pelipis`}
            />
          </Field>

          <div className="file-upload-input-row">
            <AmbilFotoButton
              inputRef={inputRef}
              fileName={`ciri${num}.jpg`}
              disabled={disabled}
              className="btn-file-upload"
            />
            <label className="btn-file-upload">
              <Icon name="upload" size={13} />
              <span>Unggah / Ganti Foto Ciri</span>
              <input
                ref={inputRef}
                type="file"
                name={fileName}
                accept="image/*"
                disabled={disabled}
                onChange={handleFileChange}
                className="sr-only"
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

function assignFileToInput(input: HTMLInputElement | null, file: File) {
  if (!input) return;
  const data = new DataTransfer();
  data.items.add(file);
  input.files = data.files;
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function AmbilFotoButton({
  inputRef,
  fileName,
  disabled,
  className = "btn-angle-upload-trigger",
}: {
  inputRef: RefObject<HTMLInputElement | null>;
  fileName: string;
  disabled?: boolean;
  className?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const deviceIdRef = useRef("");
  const [open, setOpen] = useState(false);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  const listCameras = async () => {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videos = devices.filter((device) => device.kind === "videoinput" && device.deviceId);
    setCameras(videos);
    return videos;
  };

  const startCamera = async (id?: string) => {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setError("Kamera hanya tersedia di HTTPS atau localhost.");
      return;
    }

    const preferred = id || deviceIdRef.current;
    setError(null);
    stopCamera();

    const videoConstraint = preferred
      ? { deviceId: { exact: preferred }, width: { ideal: 640 }, height: { ideal: 480 } }
      : { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } };

    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: videoConstraint });
      } catch {
        if (!preferred) throw new Error("camera");
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { width: { ideal: 640 }, height: { ideal: 480 } },
        });
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }

      await listCameras();
      const current = stream.getVideoTracks()[0]?.getSettings().deviceId ?? preferred ?? "";
      if (current) {
        deviceIdRef.current = current;
        setDeviceId(current);
      }
    } catch {
      setError("Kamera tidak dapat dibuka. Izinkan akses kamera di peramban.");
    }
  };

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open) {
      stopCamera();
      if (dialog?.open) dialog.close();
      return;
    }

    if (dialog && !dialog.open) dialog.showModal();
    void startCamera(deviceIdRef.current || undefined);

    const onDeviceChange = () => {
      void listCameras();
    };
    navigator.mediaDevices?.addEventListener?.("devicechange", onDeviceChange);

    return () => {
      navigator.mediaDevices?.removeEventListener?.("devicechange", onDeviceChange);
      stopCamera();
    };
  }, [open]);

  const snap = async () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) {
      setError("Gambar kamera belum siap.");
      return;
    }

    setBusy(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas");
      ctx.drawImage(video, 0, 0);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
      if (!blob) throw new Error("blob");
      assignFileToInput(inputRef.current, new File([blob], fileName, { type: "image/jpeg" }));
      setOpen(false);
    } catch {
      setError("Gagal mengambil foto.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button type="button" className={className} disabled={disabled} onClick={() => setOpen(true)}>
        <Icon name="camera" size={13} />
        <span>Ambil Foto</span>
      </button>
      <dialog
        ref={dialogRef}
        className="ambil-foto-dialog"
        onCancel={(event) => {
          event.preventDefault();
          setOpen(false);
        }}
      >
        <div className="ambil-foto-header">
          <h3>Ambil Foto</h3>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOpen(false)}>
            Tutup
          </button>
        </div>
        <video ref={videoRef} className="ambil-foto-video" autoPlay playsInline muted />
        {cameras.length > 0 ? (
          <label className="ambil-foto-camera">
            <span>Sumber kamera</span>
            <select
              value={cameras.some((camera) => camera.deviceId === deviceId) ? deviceId : cameras[0]?.deviceId ?? ""}
              onChange={(event) => {
                const next = event.target.value;
                deviceIdRef.current = next;
                setDeviceId(next);
                void startCamera(next);
              }}
            >
              {cameras.map((camera, index) => (
                <option key={camera.deviceId || String(index)} value={camera.deviceId}>
                  {camera.label || `Kamera ${index + 1}`}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {error ? <p className="angle-error-msg">{error}</p> : null}
        <div className="ambil-foto-actions">
          <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>
            Batal
          </button>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void snap()}>
            Ambil Foto
          </button>
        </div>
      </dialog>
    </>
  );
}

function PhotoUploadAngleCard({
  angleKey,
  title,
  subtitle,
  previewUrl,
  error,
  disabled,
  required,
}: {
  angleKey: string;
  title: string;
  subtitle: string;
  previewUrl?: string | null;
  error?: string;
  disabled?: boolean;
  required?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [currentPreview, setCurrentPreview] = useState<string | null>(previewUrl ?? null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setCurrentPreview(previewUrl ?? null);
    setImgError(false);
  }, [previewUrl]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFileName(file.name);
      const url = URL.createObjectURL(file);
      setCurrentPreview(url);
      setImgError(false);
    }
  };

  return (
    <div className={`photo-angle-upload-card ${error ? "has-card-error" : ""}`}>
      <div className="angle-card-top-bar">
        <div className="angle-title-stack">
          <span className="angle-badge-label">{title}</span>
          <span className="angle-subtitle">{subtitle}</span>
        </div>
        {required && (!previewUrl || imgError) && !selectedFileName ? (
          <span className="tag-required-pill">Wajib</span>
        ) : null}
      </div>

      <div className="angle-photo-viewport">
        {currentPreview && !imgError ? (
          <img
            src={currentPreview}
            alt=""
            onError={() => setImgError(true)}
            className="angle-img-rendered"
            loading="lazy"
          />
        ) : (
          <div className="angle-empty-view">
            <div className="angle-empty-icon">
              <Icon name="camera" size={28} />
            </div>
            <span className="angle-empty-txt">Foto Belum Diunggah</span>
          </div>
        )}
      </div>

      <div className="angle-upload-footer">
        <div className="angle-upload-actions">
          <AmbilFotoButton inputRef={inputRef} fileName={`${angleKey}.jpg`} disabled={disabled} />
          <label className="btn-angle-upload-trigger">
            <Icon name="upload" size={13} />
            <span>{currentPreview && !imgError ? "Ganti Foto" : "Pilih Berkas"}</span>
            <input
              ref={inputRef}
              type="file"
              name={angleKey}
              accept="image/*"
              disabled={disabled}
              required={required && (!previewUrl || imgError) && !selectedFileName}
              onChange={handleFile}
              className="sr-only"
            />
          </label>
        </div>
        {selectedFileName ? (
          <span className="selected-filename-tag" title={selectedFileName}>
            {selectedFileName}
          </span>
        ) : null}
      </div>

      {error ? <span className="angle-error-msg">{error}</span> : null}
    </div>
  );
}

// -------------------------------------------------------------
// SVG Icon Renderer
// -------------------------------------------------------------
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
    case "award":
      paths = (
        <>
          <circle cx="12" cy="8" r="7" />
          <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
        </>
      );
      break;
    case "briefcase":
      paths = (
        <>
          <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
          <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
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
    case "camera":
      paths = (
        <>
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
          <circle cx="12" cy="13" r="4" />
        </>
      );
      break;
    case "check":
      paths = <polyline points="20 6 9 17 4 12" />;
      break;
    case "clock":
      paths = (
        <>
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
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
    case "eye":
      paths = (
        <>
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
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
    case "heart":
      paths = (
        <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
      );
      break;
    case "id-card":
      paths = (
        <>
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <circle cx="8" cy="12" r="2" />
          <path d="M14 9h4" />
          <path d="M14 12h4" />
          <path d="M14 15h2" />
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
    case "map-pin":
      paths = (
        <>
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
          <circle cx="12" cy="10" r="3" />
        </>
      );
      break;
    case "phone":
      paths = (
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
      );
      break;
    case "shield":
      paths = <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />;
      break;
    case "trash":
      paths = (
        <>
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </>
      );
      break;
    case "upload":
      paths = (
        <>
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
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
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {paths}
    </svg>
  );
}
