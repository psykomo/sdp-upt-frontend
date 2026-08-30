import { fileToPayload } from "../lib/session";

export type LookupItem = { id: string; label: string; propinsiId?: string };
export type FormValues = Record<string, string | boolean>;
export type SimilarItem = { nomorInduk: string; namaLengkap: string | null; href: string | null };
export type CreateMatch = {
  nomorInduk: string;
  namaLengkap: string | null;
  tanggalLahir?: string | null;
  tempatLahir?: string | null;
  namaIbu?: string | null;
  jenisKelamin?: string | null;
  href: string | null;
};

export type FormTabId =
  | "biodata"
  | "pekerjaan"
  | "keluarga"
  | "fisik"
  | "sidik-jari"
  | "foto"
  | "kemiripan"
  | "dokumen";

export type IconName =
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

export const FORM_TABS: Array<{ id: Exclude<FormTabId, "dokumen">; label: string; icon: IconName; num: string }> = [
  { id: "biodata", label: "Biodata & Alamat", icon: "id-card", num: "01" },
  { id: "pekerjaan", label: "Pekerjaan & Keahlian", icon: "briefcase", num: "02" },
  { id: "keluarga", label: "Relasi Keluarga", icon: "users", num: "03" },
  { id: "fisik", label: "Data Fisik & Ciri Khusus", icon: "activity", num: "04" },
  { id: "sidik-jari", label: "Sidik Jari Biometrik", icon: "fingerprint", num: "05" },
  { id: "foto", label: "Galeri Foto 4 Sudut", icon: "camera", num: "06" },
  { id: "kemiripan", label: "Identitas Lama", icon: "clock", num: "07" },
];

export const DOKUMEN_TAB: { id: "dokumen"; label: string; icon: IconName; num: string } = {
  id: "dokumen",
  label: "Dokumen Lampiran",
  icon: "file-text",
  num: "08",
};

export const BOOL_FIELDS = [
  "beresikoTinggi",
  "pengaruhMasyarakat",
  "disabilitas",
  "bacaLatin",
  "bacaQuran",
] as const;

export const FILE_FIELDS = [
  "fotoKiri",
  "fotoKanan",
  "fotoDepan",
  "fotoCloseup",
  "ciri1File",
  "ciri2File",
  "ciri3File",
] as const;

export function str(value: unknown): string {
  if (value === null || value === undefined || value === false) return "";
  if (value === true) return "1";
  return String(value);
}

export function bool(value: unknown): boolean {
  return value === true || value === 1 || value === "1";
}

export async function buildIdentitasPayload(form: FormData): Promise<Record<string, unknown>> {
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

  return payload;
}
