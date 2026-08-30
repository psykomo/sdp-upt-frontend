import { isRouteErrorResponse, Link } from "react-router";
import { useState, useRef, useEffect, type ReactNode } from "react";
import { apiGet } from "../lib/session";
import type { Route } from "./+types/identitas-detail";

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
type Ciri = { fotoUrl: string | null; keterangan: string | null };
type DocumentItem = {
  id: string;
  judul: string | null;
  keterangan: string | null;
  namaFile: string | null;
  mimeType: string | null;
  downloadUrl: string;
  viewUrl: string;
};
type IdentityDetail = {
  nomorInduk: string;
  namaLengkap: string | null;
  isTahanan: boolean;
  access: Access;
  case: CaseView;
  links: {
    ubah: string;
    hapus: string;
    cetakIdentitas: string;
    cetakTahanan: string;
    cetakSidikJari: string;
    kembali: string;
  };
  biodata: Record<string, string | boolean | null>;
  alamat: Record<string, string | null>;
  pekerjaan: Record<string, string | null>;
  keluarga: {
    namaAyah: string | null;
    alamatAyah: string | null;
    namaIbu: string | null;
    alamatIbu: string | null;
    anakKe: string | null;
    jumlahSaudara: string | null;
    namaSaudara: string[];
    jumlahIstriSuami: string | null;
    namaIstriSuami: string[];
    alamatIstriSuami: string | null;
    jumlahAnak: string | null;
    namaAnak: string[];
    teleponKeluarga: string | null;
  };
  fisik: Record<string, string | null> & { ciri: Ciri[] };
  sidikJari: Record<string, string | null>;
  foto: {
    kiri: string | null;
    depan: string | null;
    kanan: string | null;
    closeup: string | null;
  };
  history: Array<{
    namaField: string | null;
    isi: string | null;
    nomorBerkas: string | null;
    jenisRegistrasi: string | null;
    diubah: string | null;
    yangMengubah: string | null;
  }>;
  identitasLama: Array<{
    nomorInduk: string;
    namaLengkap: string | null;
    href: string | null;
  }>;
  documents?: DocumentItem[];
};

type DetailTab = "biodata" | "pekerjaan" | "keluarga" | "fisik" | "sidik-jari" | "foto" | "identitas-lama" | "dokumen";

const DETAIL_TABS: Array<{ id: DetailTab; label: string; icon: IconName; count?: string }> = [
  { id: "biodata", label: "Biodata & Alamat", icon: "id-card" },
  { id: "pekerjaan", label: "Pekerjaan & Keahlian", icon: "briefcase" },
  { id: "keluarga", label: "Relasi Keluarga", icon: "users" },
  { id: "fisik", label: "Data Fisik & Ciri Khusus", icon: "activity" },
  { id: "sidik-jari", label: "Sidik Jari Biometrik", icon: "fingerprint" },
  { id: "foto", label: "Galeri Foto", icon: "camera" },
  { id: "identitas-lama", label: "Histori Identitas", icon: "clock" },
  { id: "dokumen", label: "Dokumen Lampiran", icon: "file-text" },
];

export function meta({ loaderData }: Route.MetaArgs) {
  const nama = loaderData?.namaLengkap ? ` — ${loaderData.namaLengkap}` : "";
  return [{ title: `Detail WBP${nama} — SDP 4.0` }];
}

export async function clientLoader({ request, params }: Route.ClientLoaderArgs) {
  const nomorInduk = encodeURIComponent(params.nomorInduk);
  const [detail, documents] = await Promise.all([
    apiGet<Omit<IdentityDetail, "documents">>(`/identitas/${nomorInduk}`, request),
    apiGet<{ items: DocumentItem[] }>(`/identitas/${nomorInduk}/documents`, request).catch(
      () => ({ items: [] as DocumentItem[] }),
    ),
  ]);

  return { ...detail, documents: documents.items };
}

export default function IdentitasDetailPage({ loaderData }: Route.ComponentProps) {
  const d = loaderData;
  const { access, biodata, alamat, pekerjaan, keluarga, fisik, sidikJari, foto } = d;
  const [activeTab, setActiveTab] = useState<DetailTab>("biodata");
  const status = d.case.statusSubPenghuni || d.case.statusPenghuni || "Aktif";
  const isStatusAktif = /aktif/i.test(status);

  const flags = [
    biodata.beresikoTinggi ? "WBP Beresiko Tinggi" : null,
    biodata.pengaruhMasyarakat ? "Pengaruh Terhadap Masyarakat" : null,
    biodata.disabilitas ? "Penyandang Disabilitas" : null,
  ].filter(Boolean) as string[];

  return (
    <main className="modern-page-shell detail-container">
      {/* 1. Top Breadcrumb & Return Action Bar */}
      <nav className="detail-top-nav" aria-label="Navigasi Halaman">
        <Link to="/identitas" className="btn-back-link">
          <Icon name="arrow-left" size={15} />
          <span>Kembali ke Data Identitas</span>
        </Link>

        <div className="detail-breadcrumbs">
          <span>SDP 4.0</span>
          <span className="separator">/</span>
          <Link to="/identitas">Manajemen Identitas</Link>
          <span className="separator">/</span>
          <span className="current">Detail WBP</span>
        </div>
      </nav>

      {/* 2. Executive Hero Profile Card */}
      <header className="detail-hero-card">
        <div className="hero-left-section">
          <HeroAvatar
            src={foto.depan}
            name={d.namaLengkap}
            nomorInduk={d.nomorInduk}
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
                {isStatusAktif ? (
                  <span className="status-badge status-verified">
                    <span className="status-dot" />
                    {status}
                  </span>
                ) : (
                  <span className="status-badge status-unverified">
                    <span className="status-dot" />
                    {status}
                  </span>
                )}
              </div>
            </div>

            <div className="hero-id-tags-row">
              <div className="id-tag-item">
                <span className="id-tag-label">No. Induk</span>
                <code className="monospace-id-tag">{d.nomorInduk}</code>
              </div>
              {biodata.nik ? (
                <div className="id-tag-item">
                  <span className="id-tag-label">NIK KTP</span>
                  <code className="monospace-reg-tag">{String(biodata.nik)}</code>
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
              {flags.map((flag) => (
                <span key={flag} className="meta-chip chip-danger">
                  <Icon name="alert-triangle" size={13} />
                  <span>{flag}</span>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Hero Actions Cluster */}
        <div className="hero-actions-section">
          <div className="hero-action-buttons">
            {access.canWrite ? (
              <Link to={`/identitas/${d.nomorInduk}/ubah`} className="btn btn-primary">
                <Icon name="edit" size={14} />
                <span>Ubah Data</span>
              </Link>
            ) : null}

            {access.canDelete ? (
              <Link to={`/identitas/${d.nomorInduk}/hapus`} className="btn btn-danger-outline">
                <Icon name="trash" size={14} />
                <span>Hapus</span>
              </Link>
            ) : null}
          </div>

          {access.canPrint ? (
            <div className="hero-print-cluster">
              <span className="print-label">Dokumen Cetak:</span>
              <div className="print-chips">
                <a
                  href={d.links.cetakIdentitas}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-print-chip"
                  title="Cetak Lembar Identitas Lengkap"
                >
                  <Icon name="file-text" size={12} />
                  <span>Lembar Identitas</span>
                </a>
                {d.isTahanan ? (
                  <a
                    href={d.links.cetakTahanan}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-print-chip"
                    title="Cetak Surat Perhitungan Masa Tahanan"
                  >
                    <Icon name="calendar" size={12} />
                    <span>Masa Tahanan</span>
                  </a>
                ) : null}
                <a
                  href={d.links.cetakSidikJari}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-print-chip"
                  title="Cetak Rekam Kartu Sidik Jari"
                >
                  <Icon name="fingerprint" size={12} />
                  <span>Kartu Daktil</span>
                </a>
              </div>
            </div>
          ) : null}
        </div>
      </header>

      {/* 3. Case Summary KPI Strip (Ringkasan Perkara) */}
      <section className="detail-summary-card" aria-label="Ringkasan Perkara">
        <div className="summary-card-header">
          <div className="summary-title-group">
            <Icon name="layers" size={16} className="summary-header-icon" />
            <h2 className="summary-heading">Ringkasan Perkara & Penahanan</h2>
          </div>
          <span className="summary-subtitle">Informasi registrasi berkas dan lokasi penempatan kamar sel</span>
        </div>

        <div className="summary-kpi-grid">
          <div className="kpi-item">
            <span className="kpi-label">Nomor Berkas</span>
            <span className="kpi-value monospace">{d.case.nomorBerkas || "—"}</span>
          </div>

          <div className="kpi-item">
            <span className="kpi-label">Nomor Registrasi</span>
            <span className="kpi-value monospace">{d.case.nomorRegistrasi || "—"}</span>
          </div>

          <div className="kpi-item">
            <span className="kpi-label">Tindak Pidana / Kejahatan</span>
            <span className="kpi-value text-warning font-semibold">{d.case.kejahatan || "—"}</span>
          </div>

          <div className="kpi-item">
            <span className="kpi-label">Lokasi Kamar Sel</span>
            <span className="kpi-value text-info font-medium">{d.case.tempatLokasiSel || "—"}</span>
          </div>

          <div className="kpi-item">
            <span className="kpi-label">Mulai Ditahan</span>
            <span className="kpi-value">{d.case.tglMulaiDitahan || "—"}</span>
          </div>

          <div className="kpi-item">
            <span className="kpi-label">Tanggal Ekspirasi</span>
            <span className="kpi-value text-gold font-medium">{d.case.tglEkspirasi || "—"}</span>
          </div>

          <div className="kpi-item">
            <span className="kpi-label">Sisa Masa Pidana</span>
            <span className="kpi-value font-semibold">{d.case.sisaPidana || "—"}</span>
          </div>

          <div className="kpi-item">
            <span className="kpi-label">Tgl Masuk UPT</span>
            <span className="kpi-value">{d.case.tanggalMasukLapas || "—"}</span>
          </div>
        </div>
      </section>

      {/* 4. Tabbed Detail Navigation Bar */}
      <div className="detail-tabs-bar" role="tablist" aria-label="Navigasi Rincian Data">
        {DETAIL_TABS.map((tab, idx) => (
          <button
            key={tab.id}
            id={`tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`panel-${tab.id}`}
            className={`detail-tab-btn ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="tab-index-num">{String(idx + 1).padStart(2, "0")}</span>
            <Icon name={tab.icon} size={15} className="tab-btn-icon" />
            <span className="tab-btn-text">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* 5. Detail Tab Content Panels */}
      <div className="detail-panels-viewport">
        {/* Tab 1: Biodata, Alamat & Riwayat */}
        {activeTab === "biodata" && (
          <div id="panel-biodata" role="tabpanel" aria-labelledby="tab-biodata" className="tab-panel-body">
            <section className="content-card">
              <div className="content-card-header">
                <Icon name="id-card" size={16} />
                <h3>Biodata & Identitas Personal</h3>
              </div>
              <div className="grid-data-2col">
                <FieldItem label="Nomor Induk (No. Induk)" value={d.nomorInduk} mono />
                <FieldItem label="NIK KTP" value={biodata.nik} mono />
                <FieldItem label="Nama Lengkap" value={biodata.namaLengkap} highlight />
                <FieldItem label="Tempat Lahir" value={biodata.tempatLahir} />
                <FieldItem label="Tanggal Lahir" value={biodata.tanggalLahir} />
                <FieldItem
                  label="Usia / Umur"
                  value={
                    biodata.usia
                      ? /tahun/i.test(String(biodata.usia))
                        ? biodata.usia
                        : `${biodata.usia} Tahun`
                      : null
                  }
                />
                <FieldItem label="Jenis Kelamin" value={biodata.jenisKelamin === "L" ? "Laki-laki (Pria)" : biodata.jenisKelamin === "P" ? "Perempuan (Wanita)" : biodata.jenisKelamin} />
                <FieldItem label="Agama" value={biodata.agama} />
                <FieldItem label="Suku Bangsa" value={biodata.suku} />
                <FieldItem label="Status Perkawinan" value={biodata.statusPerkawinan} />
                <FieldItem label="Kewarganegaraan" value={biodata.kewarganegaraan || biodata.negara} />
                <FieldItem label="Tempat Asal" value={biodata.tempatAsal} />
                <FieldItem
                  label="Status Residivis"
                  value={biodata.residivisKe ? `${text(biodata.residivis)} ke ${text(biodata.residivisKe)}` : biodata.residivis}
                />
                <FieldItem label="Penyandang Disabilitas" value={biodata.disabilitas ? "Ya" : "Tidak"} />
              </div>

              {/* Aliases Grid if present */}
              {(biodata.namaAlias1 || biodata.namaKecil1) ? (
                <>
                  <div className="card-inner-divider" />
                  <h4 className="card-subheading">Nama Alias & Nama Kecil</h4>
                  <div className="grid-data-3col">
                    <FieldItem label="Nama Alias 1" value={biodata.namaAlias1} />
                    <FieldItem label="Nama Alias 2" value={biodata.namaAlias2} />
                    <FieldItem label="Nama Alias 3" value={biodata.namaAlias3} />
                    <FieldItem label="Nama Kecil 1" value={biodata.namaKecil1} />
                    <FieldItem label="Nama Kecil 2" value={biodata.namaKecil2} />
                    <FieldItem label="Nama Kecil 3" value={biodata.namaKecil3} />
                  </div>
                </>
              ) : null}
            </section>

            <section className="content-card">
              <div className="content-card-header">
                <Icon name="map-pin" size={16} />
                <h3>Alamat & Kontak Tempat Tinggal</h3>
              </div>
              <div className="grid-data-2col">
                <FieldItem label="Alamat Lengkap" value={alamat.alamat} wide />
                <FieldItem label="Alamat Alternatif" value={alamat.alamatAlternatif} wide />
                <FieldItem label="Propinsi" value={alamat.propinsi} />
                <FieldItem label="Kota / Kabupaten" value={alamat.kota} />
                <FieldItem label="Kode Pos" value={alamat.kodepos} />
                <FieldItem label="Nomor Telepon" value={alamat.telepon} />
              </div>
            </section>

            <section className="content-card">
              <div className="content-card-header">
                <Icon name="clock" size={16} />
                <h3>Penyesuaian Identitas Sesuai Putusan</h3>
              </div>
              {d.history.length === 0 ? (
                <div className="empty-panel-notice">
                  <Icon name="check" size={15} />
                  <span>Tidak ada riwayat perubahan atau penyesuaian identitas yang tercatat.</span>
                </div>
              ) : (
                <div className="table-scroll-container">
                  <table className="modern-table">
                    <thead>
                      <tr>
                        <th scope="col" style={{ width: 50 }}>No</th>
                        <th scope="col">Nama Kolom</th>
                        <th scope="col">Isi Perubahan</th>
                        <th scope="col">No. Berkas</th>
                        <th scope="col">Jenis Registrasi</th>
                        <th scope="col">Waktu Diubah</th>
                        <th scope="col">Petugas Mengubah</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.history.map((row, i) => (
                        <tr key={`${row.namaField}-${row.diubah}-${i}`}>
                          <td>{i + 1}</td>
                          <td><strong className="text-white">{text(row.namaField)}</strong></td>
                          <td><span className="text-warning">{text(row.isi)}</span></td>
                          <td><code className="monospace-reg-tag">{text(row.nomorBerkas)}</code></td>
                          <td>{text(row.jenisRegistrasi)}</td>
                          <td><span className="cell-date">{text(row.diubah)}</span></td>
                          <td>{text(row.yangMengubah)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}

        {/* Tab 2: Pekerjaan & Keahlian */}
        {activeTab === "pekerjaan" && (
          <div id="panel-pekerjaan" role="tabpanel" aria-labelledby="tab-pekerjaan" className="tab-panel-body">
            <section className="content-card">
              <div className="content-card-header">
                <Icon name="briefcase" size={16} />
                <h3>Pekerjaan & Riwayat Profesi</h3>
              </div>
              <div className="grid-data-2col">
                <FieldItem label="Jenis Pekerjaan" value={pekerjaan.jenisPekerjaan} highlight />
                <FieldItem label="Tingkat Penghasilan" value={pekerjaan.tingkatPenghasilan} />
                <FieldItem label="Nama Instansi Pemerintah (PNS)" value={pekerjaan.namaInstansiPns} />
                <FieldItem label="Nomor Induk Pegawai (NIP)" value={pekerjaan.nip} mono />
                <FieldItem label="Alamat Pekerjaan" value={pekerjaan.alamatPekerjaan} wide />
                <FieldItem label="Keterangan Pekerjaan" value={pekerjaan.keteranganPekerjaan} wide />
              </div>
            </section>

            <section className="content-card">
              <div className="content-card-header">
                <Icon name="award" size={16} />
                <h3>Pendidikan & Keahlian Khusus</h3>
              </div>
              <div className="grid-data-2col">
                <FieldItem label="Tingkat Pendidikan Terakhir" value={pekerjaan.pendidikan} highlight />
                <FieldItem label="Minat / Bakat" value={pekerjaan.minat} />
                <FieldItem label="Keahlian 1" value={pekerjaan.keahlian1} />
                <FieldItem label="Tingkat Kemahiran 1" value={pekerjaan.level1} />
                <FieldItem label="Keahlian 2" value={pekerjaan.keahlian2} />
                <FieldItem label="Tingkat Kemahiran 2" value={pekerjaan.level2} />
                <FieldItem label="Kemampuan Baca Tulisan Latin" value={pekerjaan.bacaLatin} />
                <FieldItem label="Kemampuan Baca Al-Qur'an" value={pekerjaan.bacaQuran} />
              </div>
            </section>
          </div>
        )}

        {/* Tab 3: Relasi Keluarga */}
        {activeTab === "keluarga" && (
          <div id="panel-keluarga" role="tabpanel" aria-labelledby="tab-keluarga" className="tab-panel-body">
            <section className="content-card">
              <div className="content-card-header">
                <Icon name="users" size={16} />
                <h3>Orang Tua Kandung</h3>
              </div>
              <div className="grid-data-2col">
                <FieldItem label="Nama Lengkap Ayah" value={keluarga.namaAyah} highlight />
                <FieldItem label="Nama Lengkap Ibu" value={keluarga.namaIbu} highlight />
                <FieldItem label="Alamat Tempat Tinggal Ayah" value={keluarga.alamatAyah} wide />
                <FieldItem label="Alamat Tempat Tinggal Ibu" value={keluarga.alamatIbu} wide />
              </div>
            </section>

            <section className="content-card">
              <div className="content-card-header">
                <Icon name="heart" size={16} />
                <h3>Pasangan & Anak</h3>
              </div>
              <div className="grid-data-2col">
                <FieldItem
                  label="Jumlah Istri / Suami"
                  value={keluarga.jumlahIstriSuami ? `${keluarga.jumlahIstriSuami} Orang` : null}
                />
                <FieldItem
                  label="Jumlah Anak"
                  value={keluarga.jumlahAnak ? `${keluarga.jumlahAnak} Orang` : null}
                />
                <FieldItem
                  label="Nama Istri / Suami"
                  value={keluarga.namaIstriSuami?.join(", ") || null}
                  wide
                />
                <FieldItem
                  label="Alamat Istri / Suami"
                  value={keluarga.alamatIstriSuami}
                  wide
                />
                <FieldItem
                  label="Nama Anak"
                  value={keluarga.namaAnak?.join(", ") || null}
                  wide
                />
              </div>
            </section>

            <section className="content-card">
              <div className="content-card-header">
                <Icon name="phone" size={16} />
                <h3>Saudara & Kontak Keluarga</h3>
              </div>
              <div className="grid-data-2col">
                <FieldItem label="Anak Ke-" value={keluarga.anakKe} />
                <FieldItem
                  label="Jumlah Saudara Kandung"
                  value={keluarga.jumlahSaudara ? `${keluarga.jumlahSaudara} Bersaudara` : null}
                />
                <FieldItem
                  label="Nama Saudara Kandung"
                  value={keluarga.namaSaudara?.join(", ") || null}
                  wide
                />
                <FieldItem label="Nomor Telepon Keluarga" value={keluarga.teleponKeluarga} mono wide />
              </div>
            </section>
          </div>
        )}

        {/* Tab 4: Data Fisik & Ciri Khusus */}
        {activeTab === "fisik" && (
          <div id="panel-fisik" role="tabpanel" aria-labelledby="tab-fisik" className="tab-panel-body">
            <section className="content-card">
              <div className="content-card-header">
                <Icon name="activity" size={16} />
                <h3>Pengukuran & Ciri Fisik WBP (17 Atribut)</h3>
              </div>
              <div className="grid-data-3col">
                <FieldItem label="Tinggi Badan" value={suffix(fisik.tinggi, "cm")} highlight />
                <FieldItem label="Berat Badan" value={suffix(fisik.berat, "kg")} highlight />
                <FieldItem label="Warna Kulit" value={fisik.warnaKulit} />
                <FieldItem label="Bentuk Rambut" value={fisik.bentukRambut} />
                <FieldItem label="Warna Rambut" value={fisik.warnaRambut} />
                <FieldItem label="Raut Muka" value={fisik.rautMuka} />
                <FieldItem label="Bentuk Mata" value={fisik.bentukMata} />
                <FieldItem label="Warna Mata" value={fisik.warnaMata} />
                <FieldItem label="Bentuk Hidung" value={fisik.hidung} />
                <FieldItem label="Bentuk Mulut" value={fisik.mulut} />
                <FieldItem label="Bentuk Bibir" value={fisik.bentukBibir} />
                <FieldItem label="Bentuk Telinga" value={fisik.telinga} />
                <FieldItem label="Lengan" value={fisik.lengan} />
                <FieldItem label="Tangan" value={fisik.tangan} />
                <FieldItem label="Kaki" value={fisik.kaki} />
                <FieldItem label="Berkacamata" value={fisik.kacamata} />
                <FieldItem label="Cacat Tubuh" value={fisik.cacat} />
              </div>
            </section>

            <section className="content-card">
              <div className="content-card-header">
                <Icon name="camera" size={16} />
                <h3>Dokumentasi Ciri Khusus & Tato</h3>
              </div>
              {fisik.ciri?.length === 0 ? (
                <div className="empty-panel-notice">
                  <Icon name="check" size={15} />
                  <span>Tidak ada rekaman foto ciri khusus atau tanda tubuh yang tercatat.</span>
                </div>
              ) : (
                <div className="ciri-gallery-grid">
                  {fisik.ciri.map((c, i) => (
                    <div key={i} className="ciri-photo-card">
                      <div className="ciri-img-frame">
                        <SafeMedia src={c.fotoUrl} alt={`Ciri khusus ${i + 1}`} />
                      </div>
                      <div className="ciri-card-caption">
                        <span className="ciri-index-tag">Ciri #{i + 1}</span>
                        <p className="ciri-desc">{c.keterangan || "Tidak ada keterangan tertulis."}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {/* Tab 5: Sidik Jari Biometrik */}
        {activeTab === "sidik-jari" && (
          <div id="panel-sidik-jari" role="tabpanel" aria-labelledby="tab-sidik-jari" className="tab-panel-body">
            <section className="content-card">
              <div className="content-card-header">
                <Icon name="fingerprint" size={16} />
                <h3>Rekaman Biometrik 10 Jari</h3>
              </div>

              <div className="fingerprint-dossier-grid">
                {(
                  [
                    ["jempolKanan", "F1 · Ibu Jari Kanan"],
                    ["telunjukKanan", "F2 · Telunjuk Kanan"],
                    ["tengahKanan", "F3 · Jari Tengah Kanan"],
                    ["manisKanan", "F4 · Jari Manis Kanan"],
                    ["kelingkingKanan", "F5 · Kelingking Kanan"],
                    ["jempolKiri", "F6 · Ibu Jari Kiri"],
                    ["telunjukKiri", "F7 · Telunjuk Kiri"],
                    ["tengahKiri", "F8 · Jari Tengah Kiri"],
                    ["manisKiri", "F9 · Jari Manis Kiri"],
                    ["kelingkingKiri", "F10 · Kelingking Kiri"],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key} className="fingerprint-card">
                    <div className="fingerprint-frame">
                      <SafeMedia src={sidikJari[key]} alt={label} isFingerprint />
                    </div>
                    <div className="fingerprint-caption">
                      <span>{label}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="content-card">
              <div className="content-card-header">
                <Icon name="file-text" size={16} />
                <h3>Data Daktiloskopi & Pengambilan</h3>
              </div>
              <div className="grid-data-2col">
                <FieldItem label="Rumus Daktiloskopi" value={sidikJari.rumusDaktil} mono highlight />
                <FieldItem label="Nomor Daktiloskopi" value={sidikJari.nomorDaktil} mono />
                <FieldItem label="Petugas Pengambil Sidik Jari" value={sidikJari.pengambil} />
                <FieldItem label="Tanggal Pengambilan" value={sidikJari.tanggalAmbil} />
                <FieldItem label="Nomor Paspor" value={sidikJari.noPaspor} mono />
              </div>
            </section>
          </div>
        )}

        {/* Tab 6: Galeri Foto 4 Tampilan */}
        {activeTab === "foto" && (
          <div id="panel-foto" role="tabpanel" aria-labelledby="tab-foto" className="tab-panel-body">
            <section className="content-card">
              <div className="content-card-header">
                <Icon name="camera" size={16} />
                <h3>Galeri Foto Standar Registrasi (4 Sudut Pandang)</h3>
              </div>

              <div className="photo-gallery-grid">
                <div className="photo-angle-card">
                  <div className="photo-angle-frame">
                    <SafeMedia src={foto.kiri} alt="Foto WBP Tampak Kiri" />
                  </div>
                  <div className="photo-angle-label">
                    <span className="angle-number">01</span>
                    <span className="angle-text">Tampak Samping Kiri</span>
                  </div>
                </div>

                <div className="photo-angle-card">
                  <div className="photo-angle-frame">
                    <SafeMedia src={foto.depan} alt="Foto WBP Tampak Depan" />
                  </div>
                  <div className="photo-angle-label">
                    <span className="angle-number">02</span>
                    <span className="angle-text">Tampak Depan (Utama)</span>
                  </div>
                </div>

                <div className="photo-angle-card">
                  <div className="photo-angle-frame">
                    <SafeMedia src={foto.kanan} alt="Foto WBP Tampak Kanan" />
                  </div>
                  <div className="photo-angle-label">
                    <span className="angle-number">03</span>
                    <span className="angle-text">Tampak Samping Kanan</span>
                  </div>
                </div>

                <div className="photo-angle-card">
                  <div className="photo-angle-frame">
                    <SafeMedia src={foto.closeup} alt="Foto WBP Close-up Wajah" />
                  </div>
                  <div className="photo-angle-label">
                    <span className="angle-number">04</span>
                    <span className="angle-text">Close-up Wajah</span>
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* Tab 7: Histori Identitas Lama */}
        {activeTab === "identitas-lama" && (
          <div id="panel-identitas-lama" role="tabpanel" aria-labelledby="tab-identitas-lama" className="tab-panel-body">
            <section className="content-card">
              <div className="content-card-header">
                <Icon name="clock" size={16} />
                <h3>Histori Hubungan Identitas Lama</h3>
              </div>

              {d.identitasLama?.length === 0 ? (
                <div className="empty-panel-notice">
                  <Icon name="check" size={15} />
                  <span>Tidak ada tautan identitas lama atau identitas ganda yang tercatat di sistem.</span>
                </div>
              ) : (
                <div className="identitas-lama-grid">
                  {d.identitasLama.map((item) => (
                    <div key={item.nomorInduk} className="identitas-lama-card">
                      <div className="lama-info">
                        <Link to={`/identitas/${item.nomorInduk}`} className="lama-name-link">
                          {item.namaLengkap || item.nomorInduk}
                        </Link>
                        <code className="monospace-id-tag">{item.nomorInduk}</code>
                      </div>
                      <Link to={`/identitas/${item.nomorInduk}`} className="btn btn-secondary btn-sm">
                        <Icon name="eye" size={13} />
                        <span>Buka Detail</span>
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {activeTab === "dokumen" && (
          <div id="panel-dokumen" role="tabpanel" aria-labelledby="tab-dokumen" className="tab-panel-body">
            <section className="content-card">
              <div className="content-card-header">
                <Icon name="file-text" size={16} />
                <h3>Dokumen Lampiran</h3>
              </div>

              {!d.documents || d.documents.length === 0 ? (
                <div className="empty-panel-notice">
                  <Icon name="file-text" size={15} />
                  <span>Belum ada dokumen PDF yang dilampirkan pada identitas ini.</span>
                </div>
              ) : (
                <div className="table-scroll-container">
                  <table className="modern-table">
                    <thead>
                      <tr>
                        <th scope="col">Judul</th>
                        <th scope="col">Keterangan</th>
                        <th scope="col">Berkas</th>
                        <th scope="col" className="col-actions">
                          Aksi
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.documents.map((doc) => (
                        <tr key={doc.id}>
                          <td>{doc.judul || "—"}</td>
                          <td>{doc.keterangan || "—"}</td>
                          <td>{doc.namaFile || "—"}</td>
                          <td className="col-actions">
                            <div className="action-button-group">
                              <a href={doc.downloadUrl} className="btn btn-secondary btn-sm" download>
                                <Icon name="file-text" size={13} />
                                <span>Unduh</span>
                              </a>
                              <a
                                href={doc.viewUrl}
                                className="btn btn-secondary btn-sm"
                                target="_blank"
                                rel="noreferrer"
                              >
                                <Icon name="eye" size={13} />
                                <span>Lihat</span>
                              </a>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}

// -------------------------------------------------------------
// Helper Sub-Components & Formatters
// -------------------------------------------------------------
function FieldItem({
  label,
  value,
  mono = false,
  highlight = false,
  wide = false,
}: {
  label: string;
  value: unknown;
  mono?: boolean;
  highlight?: boolean;
  wide?: boolean;
}) {
  const displayValue = text(value);
  return (
    <div className={`data-field-box ${wide ? "col-wide" : ""}`}>
      <span className="field-box-label">{label}</span>
      <span className={`field-box-value ${mono ? "monospace" : ""} ${highlight ? "highlight" : ""}`}>
        {displayValue}
      </span>
    </div>
  );
}

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

function SafeMedia({
  src,
  alt,
  isFingerprint = false,
}: {
  src: string | null | undefined;
  alt: string;
  isFingerprint?: boolean;
}) {
  const [hasError, setHasError] = useState(!src);

  if (!src || hasError) {
    return (
      <div className={`safe-media-empty ${isFingerprint ? "fingerprint-empty" : ""}`}>
        <Icon name={isFingerprint ? "fingerprint" : "camera"} size={22} className="media-empty-icon" />
        <span>{isFingerprint ? "Belum Rekam" : "Tidak Ada Foto"}</span>
      </div>
    );
  }

  return (
    <a href={src} target="_blank" rel="noreferrer" className="media-link-wrapper" title="Buka gambar resolusi penuh">
      <img
        src={src}
        alt=""
        loading="lazy"
        onError={() => setHasError(true)}
        className="safe-media-img"
      />
    </a>
  );
}

function getInitials(name: string | null): string {
  if (!name) return "ID";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function text(value: unknown) {
  if (value === null || value === undefined || value === "" || value === false) {
    return "—";
  }
  if (value === true) {
    return "Ya";
  }
  return String(value);
}

function suffix(value: unknown, unit: string) {
  const raw = value == null || value === "" ? "" : String(value).trim();
  return raw ? `${raw} ${unit}` : null;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  const message = isRouteErrorResponse(error)
    ? String(error.data || error.statusText)
    : "Terjadi kesalahan saat memuat data identitas WBP.";

  return (
    <main className="modern-page-shell">
      <div className="empty-state-box error-box">
        <div className="empty-icon-circle error-icon">
          <Icon name="alert-triangle" size={24} />
        </div>
        <h3 className="empty-title">{notFound ? "Data WBP Tidak Ditemukan" : "Gagal Memuat Identitas"}</h3>
        <p className="empty-desc">{message}</p>
        <Link to="/identitas" className="btn btn-secondary">
          <Icon name="arrow-left" size={14} />
          <span>Kembali ke Direktori Identitas</span>
        </Link>
      </div>
    </main>
  );
}

// -------------------------------------------------------------
// Scalable Icon Component
// -------------------------------------------------------------
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
  | "map-pin"
  | "phone"
  | "trash"
  | "users";

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
          <rect x="2.5" y="4" width="19" height="16" rx="2.5" />
          <circle cx="8" cy="10" r="2" />
          <path d="M5.5 16c.7-1.8 4.3-1.8 5 0M14 9h4.5M14 13h4.5M14 17h3" />
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
