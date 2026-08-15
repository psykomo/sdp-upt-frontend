import { Form, Link, redirect, useActionData, useNavigation } from "react-router";
import { useMemo, useState, type ReactNode } from "react";
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

const TABS: Array<{ id: FormTab; label: string }> = [
  { id: "biodata", label: "Biodata & Alamat" },
  { id: "pekerjaan", label: "Pekerjaan & Keahlian" },
  { id: "keluarga", label: "Relasi Keluarga" },
  { id: "fisik", label: "Data Fisik & Ciri" },
  { id: "sidik-jari", label: "Sidik Jari" },
  { id: "foto", label: "Foto" },
];

const BOOL_FIELDS = [
  "beresikoTinggi",
  "pengaruhMasyarakat",
  "disabilitas",
  "bacaLatin",
  "bacaQuran",
] as const;

const FILE_FIELDS = ["fotoKiri", "fotoKanan", "fotoDepan", "fotoCloseup", "ciri1File", "ciri2File", "ciri3File"] as const;

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
      <nav className="detail-top-nav" aria-label="Navigasi Halaman">
        <Link to={`/identitas/${d.nomorInduk}`} className="btn-back-link">
          Kembali ke detail
        </Link>
        <div className="detail-breadcrumbs">
          <span>SDP 4.0</span>
          <span className="separator">/</span>
          <Link to="/identitas">Manajemen Identitas</Link>
          <span className="separator">/</span>
          <span className="current">Ubah</span>
        </div>
      </nav>

      <header className="detail-hero-card">
        <div className="hero-info-stack">
          <h1 className="hero-wbp-name">Ubah Identitas</h1>
          <p className="module-desc" style={{ margin: 0 }}>
            {d.namaLengkap || "—"} · {d.nomorInduk}
            {d.isTahanan ? " · Tahanan" : " · Narapidana"}
          </p>
        </div>
      </header>

      {d.readOnly ? (
        <div className="empty-panel-notice">
          <span>Pusat/Kanwil atau hak akses baca tidak dapat mengubah identitas. Form ini hanya tampilan.</span>
        </div>
      ) : null}

      {actionData?.message ? (
        <div className="form-alert" role="alert">
          {actionData.message}
        </div>
      ) : null}

      <Form method="post" encType="multipart/form-data" className="ubah-form" noValidate>
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

        <div className="detail-tabs-bar" role="tablist">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              className={`detail-tab-btn ${tab === item.id ? "active" : ""}`}
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <section className="content-card" hidden={tab !== "biodata"}>
            <div className="content-card-header">
              <h3>Biodata & Alamat</h3>
            </div>
            <div className="grid-data-2col">
              <Field label="Nomor Induk">
                <input className="form-control" value={d.nomorInduk} readOnly />
              </Field>
              <Text name="nik" label="NIK KTP" defaultValue={str(v.nik)} error={errors.nik} disabled={disabled} maxLength={16} />
              <Text name="namaLengkap" label="Nama Lengkap" defaultValue={str(v.namaLengkap)} error={errors.namaLengkap} disabled={disabled} required />
              <Select
                name="jenisKelamin"
                label="Jenis Kelamin"
                items={d.lookups.kelamin}
                defaultValue={str(v.jenisKelamin)}
                disabled={disabled}
              />
              <Text name="tanggalLahir" label="Tanggal Lahir (dd/mm/yyyy)" defaultValue={str(v.tanggalLahir)} error={errors.tanggalLahir} disabled={disabled} required />
              <Select
                name="kewarganegaraan"
                label="Kewarganegaraan"
                items={d.lookups.kewarganegaraan}
                defaultValue={str(v.kewarganegaraan)}
                disabled={disabled}
                onChange={(value) => setWni(value === "WNI")}
              />
              {wni ? null : (
                <Select name="negaraAsing" label="Negara Asing" items={d.lookups.negara} defaultValue={str(v.negaraAsing)} disabled={disabled} />
              )}
              <Select
                name="agama"
                label="Agama"
                items={d.lookups.agama}
                defaultValue={str(v.agama)}
                disabled={disabled}
                onChange={setAgama}
              />
              {agama === "LAIN" ? <Text name="agamaLain" label="Agama lain-lain" defaultValue={str(v.agamaLain)} disabled={disabled} /> : <input type="hidden" name="agamaLain" value="" />}
              <Select name="suku" label="Suku" items={d.lookups.suku} defaultValue={str(v.suku)} disabled={disabled} onChange={setSuku} />
              {suku === "LAN" ? <Text name="sukuLain" label="Suku lain-lain" defaultValue={str(v.sukuLain)} disabled={disabled} /> : <input type="hidden" name="sukuLain" value="" />}
              <Select name="statusPerkawinan" label="Status Perkawinan" items={d.lookups.perkawinan} defaultValue={str(v.statusPerkawinan)} disabled={disabled} />
              <Select name="residivis" label="Residivis" items={d.lookups.residivis} defaultValue={str(v.residivis)} disabled={disabled} onChange={setResidivis} />
              {residivis === "RDV1" ? <Text name="residivisKe" label="Residivis ke" defaultValue={str(v.residivisKe)} disabled={disabled} /> : <input type="hidden" name="residivisKe" value="" />}
              {wni ? (
                <>
                  <Select name="tempatLahir" label="Tempat Lahir" items={d.lookups.dati2} defaultValue={str(v.tempatLahir)} disabled={disabled} />
                  <Select name="tempatAsal" label="Tempat Asal" items={d.lookups.dati2} defaultValue={str(v.tempatAsal)} disabled={disabled} />
                  <Select
                    name="propinsi"
                    label="Propinsi"
                    items={d.lookups.propinsi}
                    defaultValue={str(v.propinsi)}
                    disabled={disabled}
                    onChange={setPropinsi}
                  />
                  <Select name="kota" label="Kota / Kabupaten" items={kotaOptions} defaultValue={str(v.kota)} disabled={disabled} />
                  <input type="hidden" name="tempatLahirLain" defaultValue={str(v.tempatLahirLain)} />
                  <input type="hidden" name="propinsiLain" value="" />
                  <input type="hidden" name="kotaLain" value="" />
                  <input type="hidden" name="tempatAsalLain" value="" />
                </>
              ) : (
                <>
                  <Text name="tempatLahirLain" label="Tempat Lahir" defaultValue={str(v.tempatLahirLain)} disabled={disabled} />
                  <Text name="tempatAsalLain" label="Tempat Asal" defaultValue={str(v.tempatAsalLain)} disabled={disabled} />
                  <Text name="propinsiLain" label="Propinsi" defaultValue={str(v.propinsiLain)} disabled={disabled} />
                  <Text name="kotaLain" label="Kota" defaultValue={str(v.kotaLain)} disabled={disabled} />
                  <input type="hidden" name="tempatLahir" value="" />
                  <input type="hidden" name="tempatAsal" value="" />
                  <input type="hidden" name="propinsi" value="" />
                  <input type="hidden" name="kota" value="" />
                </>
              )}
              <Area name="alamat" label="Alamat" defaultValue={str(v.alamat)} error={errors.alamat} disabled={disabled} required />
              <Text name="alamatAlternatif" label="Alamat Alternatif" defaultValue={str(v.alamatAlternatif)} disabled={disabled} />
              <Text name="telepon" label="Telepon" defaultValue={str(v.telepon)} disabled={disabled} />
              <Text name="kodepos" label="Kode Pos" defaultValue={str(v.kodepos)} error={errors.kodepos} disabled={disabled} />
              <Text name="namaAlias1" label="Nama Alias 1" defaultValue={str(v.namaAlias1)} disabled={disabled} />
              <Text name="namaAlias2" label="Nama Alias 2" defaultValue={str(v.namaAlias2)} disabled={disabled} />
              <Area name="namaAlias3" label="Nama Alias 3" defaultValue={str(v.namaAlias3)} disabled={disabled} />
              <Text name="namaKecil1" label="Nama Kecil 1" defaultValue={str(v.namaKecil1)} disabled={disabled} />
              <Text name="namaKecil2" label="Nama Kecil 2" defaultValue={str(v.namaKecil2)} disabled={disabled} />
              <Text name="namaKecil3" label="Nama Kecil 3" defaultValue={str(v.namaKecil3)} disabled={disabled} />
              <Check name="beresikoTinggi" label="WBP Beresiko Tinggi" defaultChecked={bool(v.beresikoTinggi)} disabled={disabled} />
              <Check name="pengaruhMasyarakat" label="Pengaruh Terhadap Masyarakat" defaultChecked={bool(v.pengaruhMasyarakat)} disabled={disabled} />
              <Check name="disabilitas" label="Penyandang Disabilitas" defaultChecked={bool(v.disabilitas)} disabled={disabled} />
            </div>
          </section>

        <section className="content-card" hidden={tab !== "pekerjaan"}>
            <div className="content-card-header">
              <h3>Pekerjaan & Keahlian</h3>
            </div>
            <div className="grid-data-2col">
              <Select name="jenisPekerjaan" label="Pekerjaan" items={d.lookups.pekerjaan} defaultValue={str(v.jenisPekerjaan)} disabled={disabled} onChange={setPekerjaan} />
              {pekerjaan === "89" ? <Text name="pekerjaanLain" label="Pekerjaan lain-lain" defaultValue={str(v.pekerjaanLain)} disabled={disabled} /> : <input type="hidden" name="pekerjaanLain" value="" />}
              {pekerjaan === "5" ? (
                <>
                  <Text name="namaInstansiPns" label="Nama Instansi PNS" defaultValue={str(v.namaInstansiPns)} disabled={disabled} />
                  <Text name="nip" label="NIP" defaultValue={str(v.nip)} disabled={disabled} />
                </>
              ) : (
                <>
                  <input type="hidden" name="namaInstansiPns" value="" />
                  <input type="hidden" name="nip" value="" />
                </>
              )}
              <Text name="alamatPekerjaan" label="Alamat Pekerjaan" defaultValue={str(v.alamatPekerjaan)} disabled={disabled} />
              <Area name="keteranganPekerjaan" label="Keterangan Pekerjaan" defaultValue={str(v.keteranganPekerjaan)} disabled={disabled} />
              <Select name="tingkatPenghasilan" label="Tingkat Penghasilan" items={d.lookups.penghasilan} defaultValue={str(v.tingkatPenghasilan)} disabled={disabled} />
              <Select name="pendidikan" label="Pendidikan" items={d.lookups.pendidikan} defaultValue={str(v.pendidikan)} disabled={disabled} onChange={setPendidikan} />
              {pendidikan === "PDLA" ? <Text name="pendidikanLain" label="Pendidikan lain-lain" defaultValue={str(v.pendidikanLain)} disabled={disabled} /> : <input type="hidden" name="pendidikanLain" value="" />}
              <Select name="keahlian1" label="Keahlian 1" items={d.lookups.keahlian} defaultValue={str(v.keahlian1)} disabled={disabled} onChange={setKeahlian1} />
              {keahlian1 === "ZA99" ? <Text name="keahlian1Lain" label="Keahlian 1 lain-lain" defaultValue={str(v.keahlian1Lain)} disabled={disabled} /> : <input type="hidden" name="keahlian1Lain" value="" />}
              <Select name="level1" label="Level 1" items={d.lookups.level} defaultValue={str(v.level1)} disabled={disabled} />
              <Select name="keahlian2" label="Keahlian 2" items={d.lookups.keahlian} defaultValue={str(v.keahlian2)} disabled={disabled} onChange={setKeahlian2} />
              {keahlian2 === "ZA99" ? <Text name="keahlian2Lain" label="Keahlian 2 lain-lain" defaultValue={str(v.keahlian2Lain)} disabled={disabled} /> : <input type="hidden" name="keahlian2Lain" value="" />}
              <Select name="level2" label="Level 2" items={d.lookups.level} defaultValue={str(v.level2)} disabled={disabled} />
              <Area name="minat" label="Minat" defaultValue={str(v.minat)} disabled={disabled} />
              <Check name="bacaLatin" label="Bisa baca Latin" defaultChecked={bool(v.bacaLatin)} disabled={disabled} />
              <Check name="bacaQuran" label="Bisa baca Quran" defaultChecked={bool(v.bacaQuran)} disabled={disabled} />
            </div>
          </section>

        <section className="content-card" hidden={tab !== "keluarga"}>
            <div className="content-card-header">
              <h3>Relasi Keluarga</h3>
            </div>
            <div className="grid-data-2col">
              <Text name="namaAyah" label="Nama Ayah" defaultValue={str(v.namaAyah)} error={errors.namaAyah} disabled={disabled} required />
              <Text name="alamatAyah" label="Alamat / Tempat Ayah" defaultValue={str(v.alamatAyah)} disabled={disabled} />
              <Text name="namaIbu" label="Nama Ibu" defaultValue={str(v.namaIbu)} error={errors.namaIbu} disabled={disabled} required />
              <Text name="alamatIbu" label="Alamat / Tempat Ibu" defaultValue={str(v.alamatIbu)} disabled={disabled} />
              <Text name="anakKe" label="Anak ke" defaultValue={str(v.anakKe)} error={errors.anakKe} disabled={disabled} />
              <Text name="jumlahSaudara" label="Jumlah Saudara" defaultValue={str(v.jumlahSaudara)} error={errors.jumlahSaudara} disabled={disabled} />
              <Area name="namaSaudara" label="Nama Saudara" defaultValue={str(v.namaSaudara)} disabled={disabled} />
              <Text name="jumlahIstriSuami" label="Jumlah Istri / Suami" defaultValue={str(v.jumlahIstriSuami)} error={errors.jumlahIstriSuami} disabled={disabled} />
              <Area name="namaIstriSuami" label="Nama Istri / Suami" defaultValue={str(v.namaIstriSuami)} disabled={disabled} />
              <Text name="alamatIstriSuami" label="Alamat Istri / Suami" defaultValue={str(v.alamatIstriSuami)} disabled={disabled} />
              <Text name="jumlahAnak" label="Jumlah Anak" defaultValue={str(v.jumlahAnak)} error={errors.jumlahAnak} disabled={disabled} required />
              <Area name="namaAnak" label="Nama Anak" defaultValue={str(v.namaAnak)} disabled={disabled} />
              <Text name="teleponKeluarga" label="Telepon Keluarga" defaultValue={str(v.teleponKeluarga)} disabled={disabled} />
            </div>
          </section>

        <section className="content-card" hidden={tab !== "fisik"}>
            <div className="content-card-header">
              <h3>Data Fisik & Ciri Khusus</h3>
            </div>
            <div className="grid-data-2col">
              <Text name="tinggi" label="Tinggi (cm)" defaultValue={str(v.tinggi)} error={errors.tinggi} disabled={disabled} />
              <Text name="berat" label="Berat (kg)" defaultValue={str(v.berat)} error={errors.berat} disabled={disabled} />
              <Select name="bentukRambut" label="Bentuk Rambut" items={d.lookups.bentukRambut} defaultValue={str(v.bentukRambut)} disabled={disabled} />
              <Select name="warnaRambut" label="Warna Rambut" items={d.lookups.rambut} defaultValue={str(v.warnaRambut)} disabled={disabled} />
              <Select name="bentukBibir" label="Bibir" items={d.lookups.bibir} defaultValue={str(v.bentukBibir)} disabled={disabled} />
              <Select name="kacamata" label="Kacamata" items={d.lookups.kacamata} defaultValue={str(v.kacamata)} disabled={disabled} />
              <Select name="bentukMata" label="Bentuk Mata" items={d.lookups.bentukMata} defaultValue={str(v.bentukMata)} disabled={disabled} />
              <Select name="warnaMata" label="Warna Mata" items={d.lookups.warnaMata} defaultValue={str(v.warnaMata)} disabled={disabled} />
              <Select name="hidung" label="Hidung" items={d.lookups.hidung} defaultValue={str(v.hidung)} disabled={disabled} />
              <Select name="rautMuka" label="Raut Muka" items={d.lookups.muka} defaultValue={str(v.rautMuka)} disabled={disabled} />
              <Select name="telinga" label="Telinga" items={d.lookups.telinga} defaultValue={str(v.telinga)} disabled={disabled} />
              <Select name="mulut" label="Mulut" items={d.lookups.mulut} defaultValue={str(v.mulut)} disabled={disabled} />
              <Select name="lengan" label="Lengan" items={d.lookups.lengan} defaultValue={str(v.lengan)} disabled={disabled} />
              <Select name="tangan" label="Tangan" items={d.lookups.tangan} defaultValue={str(v.tangan)} disabled={disabled} />
              <Select name="kaki" label="Kaki" items={d.lookups.kaki} defaultValue={str(v.kaki)} disabled={disabled} />
              <Select name="warnaKulit" label="Warna Kulit" items={d.lookups.kulit} defaultValue={str(v.warnaKulit)} disabled={disabled} />
              <Area name="cacat" label="Cacat" defaultValue={str(v.cacat)} disabled={disabled} />
              <Area name="ciri1" label="Ciri khusus 1" defaultValue={str(v.ciri1)} error={errors.ciri1} disabled={disabled} />
              <PhotoInput name="ciri1File" label="Foto ciri 1" preview={d.foto.ciri1} disabled={disabled} />
              <Area name="ciri2" label="Ciri khusus 2" defaultValue={str(v.ciri2)} disabled={disabled} />
              <PhotoInput name="ciri2File" label="Foto ciri 2" preview={d.foto.ciri2} disabled={disabled} />
              <Area name="ciri3" label="Ciri khusus 3" defaultValue={str(v.ciri3)} disabled={disabled} />
              <PhotoInput name="ciri3File" label="Foto ciri 3" preview={d.foto.ciri3} disabled={disabled} />
            </div>
          </section>

        <section className="content-card" hidden={tab !== "sidik-jari"}>
            <div className="content-card-header">
              <h3>Sidik Jari</h3>
            </div>
            <p className="module-desc">
              Rekam sidik jari scanner tetap di legacy.{" "}
              <a href={d.links.rekamSidikJari} className="wbp-name-link">
                Buka halaman PHP untuk merekam
              </a>
              .
            </p>
            <div className="grid-data-2col">
              <Text name="pengambilSidikJari" label="Pengambil sidik jari" defaultValue={str(v.pengambilSidikJari)} disabled={disabled} />
              <Text name="noPaspor" label="No. Paspor" defaultValue={str(v.noPaspor)} disabled={disabled} />
              <Text name="rumusDaktil" label="Rumus daktil" defaultValue={str(v.rumusDaktil)} disabled={disabled} />
              <Text name="nomorDaktil" label="Nomor daktil" defaultValue={str(v.nomorDaktil)} disabled={disabled} />
              <Text name="tanggalSidikJari" label="Tanggal ambil (dd/mm/yyyy)" defaultValue={str(v.tanggalSidikJari)} error={errors.tanggalSidikJari} disabled={disabled} />
            </div>
          </section>

        <section className="content-card" hidden={tab !== "foto"}>
            <div className="content-card-header">
              <h3>Foto Identitas</h3>
            </div>
            <div className="grid-data-2col">
              <PhotoInput name="fotoKiri" label="Foto kiri" preview={d.foto.kiri} error={errors.fotoKiri} disabled={disabled} required />
              <PhotoInput name="fotoDepan" label="Foto depan" preview={d.foto.depan} error={errors.fotoDepan} disabled={disabled} required />
              <PhotoInput name="fotoKanan" label="Foto kanan" preview={d.foto.kanan} error={errors.fotoKanan} disabled={disabled} required />
              <PhotoInput name="fotoCloseup" label="Foto close-up" preview={d.foto.closeup} disabled={disabled} />
            </div>
          </section>

        <div className="ubah-actions">
          <Link to={`/identitas/${d.nomorInduk}`} className="btn btn-secondary">
            Batal
          </Link>
          {d.readOnly ? null : (
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Menyimpan…" : "Simpan"}
            </button>
          )}
        </div>
      </Form>
    </main>
  );
}

function str(value: unknown): string {
  if (value === null || value === undefined || value === false) return "";
  if (value === true) return "1";
  return String(value);
}

function bool(value: unknown): boolean {
  return value === true || value === 1 || value === "1";
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="form-field">
      <span className="form-field-label">{label}</span>
      {children}
      {error ? <span className="form-field-error">{error}</span> : null}
    </label>
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
}: {
  name: string;
  label: string;
  defaultValue: string;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  maxLength?: number;
}) {
  return (
    <Field label={label} error={error}>
      <input
        className="form-control"
        name={name}
        defaultValue={defaultValue}
        disabled={disabled}
        required={required}
        maxLength={maxLength}
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
}: {
  name: string;
  label: string;
  defaultValue: string;
  error?: string;
  disabled?: boolean;
  required?: boolean;
}) {
  return (
    <Field label={label} error={error}>
      <textarea className="form-control" name={name} defaultValue={defaultValue} disabled={disabled} required={required} rows={3} />
    </Field>
  );
}

function Select({
  name,
  label,
  items,
  defaultValue,
  disabled,
  onChange,
}: {
  name: string;
  label: string;
  items: LookupItem[] | undefined;
  defaultValue: string;
  disabled?: boolean;
  onChange?: (value: string) => void;
}) {
  return (
    <Field label={label}>
      <select
        className="form-control"
        name={name}
        defaultValue={defaultValue}
        disabled={disabled}
        onChange={(event) => onChange?.(event.target.value)}
      >
        <option value="">—</option>
        {(items ?? []).map((item) => (
          <option key={`${name}-${item.id}`} value={item.id}>
            {item.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

function Check({
  name,
  label,
  defaultChecked,
  disabled,
}: {
  name: string;
  label: string;
  defaultChecked: boolean;
  disabled?: boolean;
}) {
  return (
    <label className="form-check">
      <input type="hidden" name={name} value="0" />
      <input type="checkbox" name={name} value="1" defaultChecked={defaultChecked} disabled={disabled} />
      <span>{label}</span>
    </label>
  );
}

function PhotoInput({
  name,
  label,
  preview,
  error,
  disabled,
  required,
}: {
  name: string;
  label: string;
  preview: string | null | undefined;
  error?: string;
  disabled?: boolean;
  required?: boolean;
}) {
  return (
    <Field label={label} error={error}>
      {preview ? <img src={preview} alt="" className="form-photo-preview" /> : <span className="text-empty">Belum ada foto</span>}
      <input className="form-control" type="file" name={name} accept="image/*" disabled={disabled} required={required && !preview} />
    </Field>
  );
}
