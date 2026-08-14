import { isRouteErrorResponse, Link } from "react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { apiGet, requireToken } from "../lib/session.server";
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
};

type DetailTab = "pekerjaan" | "keluarga" | "fisik" | "sidik-jari" | "foto" | "identitas-lama";

const detailTabs: Array<{ id: DetailTab; label: string }> = [
  { id: "pekerjaan", label: "Pekerjaan & keahlian" },
  { id: "keluarga", label: "Keluarga" },
  { id: "fisik", label: "Data fisik" },
  { id: "sidik-jari", label: "Sidik jari" },
  { id: "foto", label: "Foto" },
  { id: "identitas-lama", label: "Identitas lama" },
];

export function meta({ loaderData }: Route.MetaArgs) {
  const nama = loaderData?.namaLengkap ? ` — ${loaderData.namaLengkap}` : "";
  return [{ title: `Lihat Identitas${nama} — SDP` }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const token = await requireToken(request);
  return apiGet<IdentityDetail>(
    token,
    `/identities/${encodeURIComponent(params.nomorInduk)}`,
    request,
  );
}

export default function IdentitasDetailPage({ loaderData }: Route.ComponentProps) {
  const d = loaderData;
  const { access, biodata, alamat, pekerjaan, keluarga, fisik, sidikJari, foto } = d;
  const [activeTab, setActiveTab] = useState<DetailTab>("pekerjaan");
  const status = d.case.statusSubPenghuni || d.case.statusPenghuni || "—";
  const statusTone = /aktif/i.test(status) ? "" : "pending";
  const initials = (d.namaLengkap || "ID")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  const flags = [
    biodata.beresikoTinggi ? "WBP beresiko tinggi" : null,
    biodata.pengaruhMasyarakat ? "Pengaruh terhadap masyarakat" : null,
    biodata.disabilitas ? "Disabilitas" : null,
  ].filter(Boolean) as string[];

  return (
    <main className="page-shell detail-page">
      <section className="identity-hero">
        <div className="identity-hero-main">
          <HeroPhoto
            src={foto.depan}
            alt={`Foto ${d.namaLengkap || d.nomorInduk}`}
            initials={initials}
          />

          <div className="heading-copy">
          <div className="eyebrow">
            <span className="eyebrow-line" />
            Data / Identitas / Lihat
          </div>
            <h1 className="page-title identity-title">{d.namaLengkap || "Identitas"}</h1>
            <div className="identity-meta">
              <span>
                <small>No induk</small>
                <code>{d.nomorInduk}</code>
              </span>
              {biodata.nik ? (
                <span>
                  <small>NIK</small>
                  <code>{String(biodata.nik)}</code>
                </span>
              ) : null}
            </div>
            <div className="identity-tags">
              <span className={`status-pill ${statusTone}`}>
                <span className="status-dot" />
                {status}
              </span>
              <span className="identity-tag">
                <small>Registrasi</small>
                {d.case.jenisRegistrasi}
              </span>
              <span className="identity-tag">
                <small>Perkara</small>
                {d.case.kejahatan}
              </span>
              {flags.map((flag) => (
                <span key={flag} className="flag-pill">
                  {flag}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="heading-actions detail-toolbar">
          <div className="toolbar-primary">
            <Link to="/identitas" className="secondary-button">
              <Icon name="arrow-left" size={14} />
              Kembali
            </Link>
            {access.canWrite ? (
              <a href={d.links.ubah} className="primary-button detail-action">
                <Icon name="edit" size={13} />
                Ubah data
              </a>
            ) : null}
            {access.canDelete ? (
              <a href={d.links.hapus} className="danger-button">
                <Icon name="trash" size={13} />
                Hapus
              </a>
            ) : null}
          </div>
          {access.canPrint ? (
            <div className="toolbar-secondary">
              <span className="toolbar-caption">Dokumen</span>
              <a href={d.links.cetakIdentitas} target="_blank" rel="noreferrer" className="toolbar-action">
                <Icon name="file-text" size={13} />
                Identitas
              </a>
              {d.isTahanan ? (
                <a href={d.links.cetakTahanan} target="_blank" rel="noreferrer" className="toolbar-action">
                  <Icon name="calendar" size={13} />
                  Masa tahanan
                </a>
              ) : null}
              <a href={d.links.cetakSidikJari} target="_blank" rel="noreferrer" className="toolbar-action">
                <Icon name="fingerprint" size={13} />
                Sidik jari
              </a>
            </div>
          ) : null}
        </div>
      </section>

      <section className="results-card case-strip" aria-label="Ringkasan perkara">
        <div className="results-card-header case-summary-header">
          <div>
            <span className="section-label">Ringkasan perkara</span>
            <p>Informasi registrasi dan status penghuni saat ini</p>
          </div>
          <span className={`status-pill ${statusTone}`}>
            <span className="status-dot" />
            {status}
          </span>
        </div>
        <dl className="detail-grid case-grid">
          <Item label="Nomor berkas" value={d.case.nomorBerkas} />
          <Item label="Nomor registrasi" value={d.case.nomorRegistrasi} />
          <Item label="Jenis registrasi" value={d.case.jenisRegistrasi} />
          <Item label="Kejahatan" value={d.case.kejahatan} />
          <Item label="Tgl mulai ditahan" value={d.case.tglMulaiDitahan} />
          <Item label="Tanggal ekspirasi" value={d.case.tglEkspirasi} />
          <Item label="Sisa pidana" value={d.case.sisaPidana} />
          <Item label="Tgl masuk UPT" value={d.case.tanggalMasukLapas} />
          <Item label="Lokasi sel" value={d.case.tempatLokasiSel} />
          <Item label="Status" value={status} />
        </dl>
      </section>

      <div className="detail-stack">
        <Panel title="Biodata" id="biodata" index="01" meta="Profil utama" open>
          <dl className="detail-grid">
            <Item label="No induk" value={d.nomorInduk} />
            <Item label="NIK" value={biodata.nik} />
            <Item
              label="Residivis"
              value={
                biodata.residivisKe
                  ? `${text(biodata.residivis)} ke ${text(biodata.residivisKe)}`
                  : biodata.residivis
              }
            />
            <Item label="Tempat asal" value={biodata.tempatAsal} />
            <Item label="Nama lengkap" value={biodata.namaLengkap} />
            <Item label="Tempat lahir" value={biodata.tempatLahir} />
            <Item label="Nama alias 1" value={biodata.namaAlias1} />
            <Item label="Tanggal lahir" value={biodata.tanggalLahir} />
            <Item label="Nama alias 2" value={biodata.namaAlias2} />
            <Item label="Usia" value={biodata.usia} />
            <Item label="Nama alias 3" value={biodata.namaAlias3} />
            <Item label="Jenis kelamin" value={biodata.jenisKelamin} />
            <Item label="Nama kecil 1" value={biodata.namaKecil1} />
            <Item label="Negara" value={biodata.negara} />
            <Item label="Nama kecil 2" value={biodata.namaKecil2} />
            <Item label="Kewarganegaraan" value={biodata.kewarganegaraan} />
            <Item label="Nama kecil 3" value={biodata.namaKecil3} />
            <Item label="Agama" value={biodata.agama} />
            <Item label="Suku" value={biodata.suku} />
            <Item label="Status perkawinan" value={biodata.statusPerkawinan} />
            <Item label="Disabilitas" value={biodata.disabilitas ? "Ya" : "Tidak"} />
          </dl>

          <h2 className="panel-subtitle">Alamat</h2>
          <dl className="detail-grid">
            <Item label="Propinsi" value={alamat.propinsi} />
            <Item label="Telephone" value={alamat.telepon} />
            <Item label="Kota" value={alamat.kota} />
            <Item label="Kodepos" value={alamat.kodepos} />
            <Item label="Alamat detail" value={alamat.alamat} wide />
            <Item label="Alamat alternatif" value={alamat.alamatAlternatif} wide />
          </dl>

          <h2 className="panel-subtitle">Penyesuaian identitas sesuai putusan</h2>
          {d.history.length === 0 ? (
            <p className="empty-copy">Tidak ada perubahan</p>
          ) : (
            <div className="table-scroll">
              <table className="identity-table history-table">
                <thead>
                  <tr>
                    <th>No.</th>
                    <th>Nama kolom</th>
                    <th>Isi</th>
                    <th>No. berkas</th>
                    <th>Jenis registrasi</th>
                    <th>Diubah</th>
                    <th>Yang mengubah</th>
                  </tr>
                </thead>
                <tbody>
                  {d.history.map((row, i) => (
                    <tr key={`${row.namaField}-${row.diubah}-${i}`}>
                      <td>{i + 1}</td>
                      <td>{text(row.namaField)}</td>
                      <td>{text(row.isi)}</td>
                      <td>{text(row.nomorBerkas)}</td>
                      <td>{text(row.jenisRegistrasi)}</td>
                      <td>{text(row.diubah)}</td>
                      <td>{text(row.yangMengubah)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <nav className="detail-tabs" aria-label="Bagian detail identitas" role="tablist">
          {detailTabs.map((tab) => (
            <button
              key={tab.id}
              id={`tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={tab.id}
              className={activeTab === tab.id ? "detail-tab is-active" : "detail-tab"}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="detail-tab-index">
                {String(detailTabs.findIndex((item) => item.id === tab.id) + 2).padStart(2, "0")}
              </span>
              {tab.label}
            </button>
          ))}
        </nav>

        <Panel
          title="Pekerjaan & keahlian"
          id="pekerjaan"
          index="02"
          meta="14 kolom"
          open
          hidden={activeTab !== "pekerjaan"}
        >
          <h2 className="panel-subtitle">Pekerjaan</h2>
          <dl className="detail-grid">
            <Item label="Jenis pekerjaan" value={pekerjaan.jenisPekerjaan} />
            <Item label="Nama instansi pemerintah" value={pekerjaan.namaInstansiPns} />
            <Item label="Nomor induk pegawai" value={pekerjaan.nip} />
            <Item label="Bekerja di" value={pekerjaan.alamatPekerjaan} wide />
            <Item label="Keterangan pekerjaan" value={pekerjaan.keteranganPekerjaan} wide />
            <Item label="Tingkat penghasilan" value={pekerjaan.tingkatPenghasilan} wide />
          </dl>
          <h2 className="panel-subtitle">Keahlian</h2>
          <dl className="detail-grid">
            <Item label="Tingkat pendidikan" value={pekerjaan.pendidikan} />
            <Item label="Keahlian 1" value={pekerjaan.keahlian1} />
            <Item label="Level 1" value={pekerjaan.level1} />
            <Item label="Keahlian 2" value={pekerjaan.keahlian2} />
            <Item label="Level 2" value={pekerjaan.level2} />
            <Item label="Minat" value={pekerjaan.minat} />
            <Item label="Baca latin" value={pekerjaan.bacaLatin} />
            <Item label="Baca quran" value={pekerjaan.bacaQuran} />
          </dl>
        </Panel>

        <Panel
          title="Keluarga"
          id="keluarga"
          index="03"
          meta="Relasi keluarga"
          open
          hidden={activeTab !== "keluarga"}
        >
          <dl className="detail-grid">
            <Item label="Nama ayah" value={keluarga.namaAyah} wide />
            <Item label="Alamat ayah" value={keluarga.alamatAyah} wide />
            <Item label="Nama ibu" value={keluarga.namaIbu} wide />
            <Item label="Alamat ibu" value={keluarga.alamatIbu} wide />
            <Item label="Anak ke" value={keluarga.anakKe} />
            <Item
              label="Bersaudara"
              value={keluarga.jumlahSaudara ? `${keluarga.jumlahSaudara} bersaudara` : null}
            />
            <Item label="Nama saudara kandung" value={namedList("Saudara", keluarga.namaSaudara)} wide />
            <Item
              label="Jumlah istri/suami"
              value={keluarga.jumlahIstriSuami ? `${keluarga.jumlahIstriSuami} orang` : null}
            />
            <Item label="Nama istri/suami" value={namedList("Istri/Suami", keluarga.namaIstriSuami)} wide />
            <Item label="Alamat istri/suami" value={keluarga.alamatIstriSuami} wide />
            <Item
              label="Jumlah anak"
              value={keluarga.jumlahAnak ? `${keluarga.jumlahAnak} orang` : null}
            />
            <Item label="Nama anak" value={namedList("Anak", keluarga.namaAnak)} wide />
            <Item label="Telepon keluarga" value={keluarga.teleponKeluarga} />
          </dl>
        </Panel>

        <Panel
          title="Data fisik"
          id="fisik"
          index="04"
          meta="17 atribut"
          open
          hidden={activeTab !== "fisik"}
        >
          <dl className="detail-grid">
            <Item label="Tinggi badan" value={suffix(fisik.tinggi, "cm")} />
            <Item label="Telinga" value={fisik.telinga} />
            <Item label="Berat badan" value={suffix(fisik.berat, "kg")} />
            <Item label="Mulut" value={fisik.mulut} />
            <Item label="Bentuk rambut" value={fisik.bentukRambut} />
            <Item label="Lengan" value={fisik.lengan} />
            <Item label="Warna rambut" value={fisik.warnaRambut} />
            <Item label="Tangan" value={fisik.tangan} />
            <Item label="Bentuk bibir" value={fisik.bentukBibir} />
            <Item label="Kaki" value={fisik.kaki} />
            <Item label="Berkacamata" value={fisik.kacamata} />
            <Item label="Warna kulit" value={fisik.warnaKulit} />
            <Item label="Bentuk mata" value={fisik.bentukMata} />
            <Item label="Cacat tubuh" value={fisik.cacat} />
            <Item label="Warna mata" value={fisik.warnaMata} />
            <Item label="Hidung" value={fisik.hidung} />
            <Item label="Raut muka" value={fisik.rautMuka} />
          </dl>
          <h2 className="panel-subtitle">Ciri khusus</h2>
          <div className="photo-strip ciri-strip">
            {fisik.ciri.map((ciri, i) => (
              <figure key={i} className="photo-cell">
                <Media src={ciri.fotoUrl} alt={`Ciri khusus ${i + 1}`} />
                <figcaption>
                  Ciri {i + 1}
                  {ciri.keterangan ? ` — ${ciri.keterangan}` : ""}
                </figcaption>
              </figure>
            ))}
          </div>
        </Panel>

        <Panel
          title="Sidik jari"
          id="sidik-jari"
          index="05"
          meta="10 jari"
          open
          hidden={activeTab !== "sidik-jari"}
        >
          <div className="fingerprint-grid">
            {(
              [
                ["jempolKanan", "F1 · Ibu jari kanan"],
                ["telunjukKanan", "F2 · Telunjuk kanan"],
                ["tengahKanan", "F3 · Jari tengah kanan"],
                ["manisKanan", "F4 · Jari manis kanan"],
                ["kelingkingKanan", "F5 · Kelingking kanan"],
                ["jempolKiri", "F6 · Ibu jari kiri"],
                ["telunjukKiri", "F7 · Telunjuk kiri"],
                ["tengahKiri", "F8 · Jari tengah kiri"],
                ["manisKiri", "F9 · Jari manis kiri"],
                ["kelingkingKiri", "F10 · Kelingking kiri"],
              ] as const
            ).map(([key, label]) => (
              <figure key={key} className="photo-cell">
                <Media src={sidikJari[key]} alt={label} />
                <figcaption>{label}</figcaption>
              </figure>
            ))}
          </div>
          <h2 className="panel-subtitle">Data tambahan</h2>
          <dl className="detail-grid">
            <Item label="No paspor" value={sidikJari.noPaspor} />
            <Item label="Pengambil sidik jari" value={sidikJari.pengambil} />
            <Item label="Rumus daktiloskopi" value={sidikJari.rumusDaktil} />
            <Item label="Tanggal pengambilan" value={sidikJari.tanggalAmbil} />
            <Item label="Nomor daktiloskopi" value={sidikJari.nomorDaktil} />
          </dl>
        </Panel>

        <Panel
          title="Foto"
          id="foto"
          index="06"
          meta="4 tampilan"
          open
          hidden={activeTab !== "foto"}
        >
          <div className="photo-strip">
            <figure className="photo-cell">
              <Media src={foto.kiri} alt="Tampak kiri" />
              <figcaption>1 · Tampak kiri</figcaption>
            </figure>
            <figure className="photo-cell">
              <Media src={foto.depan} alt="Tampak depan" />
              <figcaption>2 · Tampak depan</figcaption>
            </figure>
            <figure className="photo-cell">
              <Media src={foto.kanan} alt="Tampak kanan" />
              <figcaption>3 · Tampak kanan</figcaption>
            </figure>
            <figure className="photo-cell">
              <Media src={foto.closeup} alt="Tampak close-up" />
              <figcaption>4 · Tampak close-up</figcaption>
            </figure>
          </div>
        </Panel>

        <Panel
          title="Identitas lama"
          id="identitas-lama"
          index="07"
          meta={`${d.identitasLama.length} rekaman`}
          open
          hidden={activeTab !== "identitas-lama"}
        >
          {d.identitasLama.length === 0 ? (
            <p className="empty-copy">Tidak ada identitas lama yang tercatat.</p>
          ) : (
            <ul className="similar-list">
              {d.identitasLama.map((item) => (
                <li key={item.nomorInduk}>
                  <Link to={`/identitas/${item.nomorInduk}`} className="action-link">
                    {item.namaLengkap || item.nomorInduk}
                  </Link>
                  <span>{item.nomorInduk}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </main>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  const message = isRouteErrorResponse(error)
    ? String(error.data || error.statusText)
    : "Terjadi kesalahan saat memuat identitas.";

  return (
    <main className="page-shell">
      <div className="results-card empty-state">
        <span className="empty-state-icon">
          <Icon name="search-x" size={19} />
        </span>
        <strong>{notFound ? "Identitas tidak ditemukan" : "Gagal memuat identitas"}</strong>
        <p>{message}</p>
        <Link to="/identitas" className="secondary-button">
          <Icon name="arrow-left" size={14} />
          Kembali ke pencarian
        </Link>
      </div>
    </main>
  );
}

function Panel({
  title,
  id,
  index,
  meta,
  open = false,
  hidden = false,
  children,
}: {
  title: string;
  id: string;
  index: string;
  meta?: string;
  open?: boolean;
  hidden?: boolean;
  children: ReactNode;
}) {
  return (
    <details id={id} className="detail-section" open={open} hidden={hidden}>
      <summary>
        <span className="section-summary-main">
          <span className="section-number">{index}</span>
          <span className="section-label">{title}</span>
        </span>
        <span className="section-summary-meta">
          {meta ? <span>{meta}</span> : null}
          <span className="summary-chevron" />
        </span>
      </summary>
      <div className="detail-section-body">{children}</div>
    </details>
  );
}

function Item({
  label,
  value,
  wide = false,
}: {
  label: string;
  value: unknown;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "detail-item detail-item-wide" : "detail-item"}>
      <dt>{label}</dt>
      <dd>{text(value)}</dd>
    </div>
  );
}

function Media({ src, alt }: { src: string | null | undefined; alt: string }) {
  const image = useImageFailure(src);

  if (!src || image.failed) {
    return <div className="photo-empty">Tidak ada foto</div>;
  }

  return (
    <a href={src} target="_blank" rel="noreferrer">
      <img
        ref={image.ref}
        src={src}
        alt={alt}
        loading="lazy"
        onError={image.markFailed}
      />
    </a>
  );
}

function HeroPhoto({
  src,
  alt,
  initials,
}: {
  src: string | null | undefined;
  alt: string;
  initials: string;
}) {
  const image = useImageFailure(src);

  return (
    <div className="identity-photo">
      {src && !image.failed ? (
        <a href={src} target="_blank" rel="noreferrer">
          <img ref={image.ref} src={src} alt={alt} onError={image.markFailed} />
        </a>
      ) : (
        <span>{initials}</span>
      )}
      <small>Foto utama</small>
    </div>
  );
}

function useImageFailure(src: string | null | undefined) {
  const [failed, setFailed] = useState(!src);
  const ref = useRef<HTMLImageElement>(null);

  useEffect(() => {
    setFailed(!src);
    if (ref.current?.complete && ref.current.naturalWidth === 0) {
      setFailed(true);
    }
  }, [src]);

  return {
    failed,
    ref,
    markFailed: () => setFailed(true),
  };
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

function namedList(prefix: string, items: string[]) {
  if (!items.length) {
    return null;
  }
  return items.map((item, i) => `${prefix} ${i + 1}: ${item}`).join("\n");
}

type IconName =
  | "arrow-left"
  | "calendar"
  | "edit"
  | "file-text"
  | "fingerprint"
  | "id-card"
  | "search-x"
  | "trash";

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
    case "arrow-left":
      paths = <path d="M19 12H5M11 6l-6 6 6 6" />;
      break;
    case "edit":
      paths = (
        <>
          <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3z" />
          <path d="m13.5 6.5 3 3" />
        </>
      );
      break;
    case "trash":
      paths = (
        <>
          <path d="M5 7h14M10 7V5h4v2M8 7l1 12h6l1-12" />
        </>
      );
      break;
    case "file-text":
      paths = (
        <>
          <path d="M14 3H7.5A1.5 1.5 0 0 0 6 4.5v15A1.5 1.5 0 0 0 7.5 21h9A1.5 1.5 0 0 0 18 19.5V8z" />
          <path d="M14 3v5h5M8.5 12h7M8.5 16h5" />
        </>
      );
      break;
    case "calendar":
      paths = (
        <>
          <rect x="4" y="5" width="16" height="15" rx="2" />
          <path d="M8 3v4M16 3v4M4 10h16" />
        </>
      );
      break;
    case "fingerprint":
      paths = (
        <>
          <path d="M7 10.5a5 5 0 0 1 10 0v4.2" />
          <path d="M9.2 11.2a2.8 2.8 0 0 1 5.6 0v5" />
          <path d="M12 13.2v4.3" />
          <path d="M5.8 13.5c.2 4 2.4 6.5 6.2 6.5 3.2 0 5.4-1.8 6.2-4.8" />
        </>
      );
      break;
    default:
      paths = (
        <>
          <circle cx="10.5" cy="10.5" r="6.5" />
          <path d="m15.5 15.5 4.5 4.5M8.5 8.5l4 4M12.5 8.5l-4 4" />
        </>
      );
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
