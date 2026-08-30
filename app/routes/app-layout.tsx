import { Form, Link, Outlet, isRouteErrorResponse, useLocation, useNavigation } from "react-router";
import { useState, useEffect } from "react";
import { apiGet, apiSetWorkingScope, publicLegacyBase } from "../lib/session";
import type { Route } from "./+types/app-layout";

type LookupItem = { id: string; label: string; kanwilId?: string };

type Me = {
  user: {
    id: string;
    name: string;
    levelName: string | null;
    uptName: string | null;
    isPusat: boolean;
    isKanwil: boolean;
    uptId: string | null;
    sessionFilterUptId?: string | null;
    sessionFilterKanwilId?: string | null;
  };
};

export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  const me = await apiGet<Me>("/auth/me", request);
  return { ...me, legacyBase: publicLegacyBase(request) };
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const location = useLocation();
  const reloadHref = `${location.pathname}${location.search}`;
  const unavailable = isRouteErrorResponse(error) && error.status === 503;
  const message = isRouteErrorResponse(error)
    ? String(error.data || error.statusText)
    : "Terjadi kesalahan saat memuat halaman.";

  return (
    <div className="min-h-screen app-wrapper">
      <header className="site-header">
        <div className="header-main">
          <a href="/identitas" className="brand" aria-label="SDP 4.0">
            <span className="brand-mark">SDP</span>
            <span className="brand-copy">
              <strong>Sistem Database</strong>
              <span>Pemasyarakatan · SDP 4.0</span>
            </span>
          </a>
        </div>
      </header>
      <main className="modern-page-shell">
        <div className="empty-state-box error-box">
          <h3 className="empty-title">
            {unavailable ? "API tidak tersedia" : "Gagal memuat halaman"}
          </h3>
          <p className="empty-desc">{message}</p>
          <a
            href={reloadHref}
            className="btn btn-secondary"
            onClick={(event) => {
              event.preventDefault();
              window.location.reload();
            }}
          >
            Muat ulang
          </a>
        </div>
      </main>
    </div>
  );
}

export default function AppLayout({ loaderData }: Route.ComponentProps) {
  const { user, legacyBase } = loaderData;
  const navigation = useNavigation();
  const pending = navigation.state !== "idle";

  return (
    <div className="min-h-screen app-wrapper" aria-busy={pending}>
      <header className="site-header">
        {pending ? (
          <div className="nav-progress" role="progressbar" aria-label="Memuat halaman">
            <span className="nav-progress-bar" />
          </div>
        ) : null}
        <div className="header-main">
          <Link to="/identitas" className="brand" aria-label="SDP 4.0">
            <span className="brand-mark">SDP</span>
            <span className="brand-copy">
              <strong>Sistem Database</strong>
              <span>Pemasyarakatan · SDP 4.0</span>
            </span>
          </Link>

          <div className="site-context">
            {user.isPusat || user.isKanwil ? (
              <WorkingScopePicker user={user} />
            ) : (
              <>
                <span>Unit pelaksana teknis</span>
                <strong>{user.uptName ?? "Sistem Database Pemasyarakatan"}</strong>
              </>
            )}
          </div>

          <div className="header-actions">
            <Link to="/identitas" className="header-link">
              Manajemen Identitas
            </Link>

            {/* Interactive Theme Toggler */}
            <ThemeToggle />

            <div className="account">
              <span className="account-avatar" aria-hidden="true">
                {user.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="account-copy">
                <strong>{user.name}</strong>
                <span>{user.levelName ?? "Pengguna SDP"}</span>
              </span>
            </div>

            <Form action="/logout" method="post">
              <button type="submit" className="logout-button">
                <Icon name="log-out" size={14} />
                <span>Keluar</span>
              </button>
            </Form>
          </div>
        </div>

        <nav className="primary-nav" aria-label="Navigasi utama">
          <div className="primary-nav-inner">
            <div className="primary-nav-links">
              <Link to="/identitas" className="nav-item nav-item-active">
                <Icon name="id-card" size={14} />
                <span>Data Identitas</span>
              </Link>
              <a href={legacyBase} className="nav-item">
                <span>Menu lama</span>
              </a>
            </div>
            <span className={`nav-status${pending ? " is-pending" : ""}`}>
              <span className="live-dot" />
              <span>{pending ? "Memuat halaman…" : "Sesi aktif"}</span>
            </span>
          </div>
        </nav>
      </header>
      <Outlet />
    </div>
  );
}

function WorkingScopePicker({ user }: { user: Me["user"] }) {
  const [kanwilItems, setKanwilItems] = useState<LookupItem[]>([]);
  const [uptItems, setUptItems] = useState<LookupItem[]>([]);
  const [kanwilId, setKanwilId] = useState(user.sessionFilterKanwilId ?? "");
  const [uptId, setUptId] = useState(user.sessionFilterUptId ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user.isPusat) {
      return;
    }

    apiGet<{ items: LookupItem[] }>("/lookups/kanwil")
      .then((data) => setKanwilItems(data.items))
      .catch(() => setKanwilItems([]));
  }, [user.isPusat]);

  useEffect(() => {
    const kanwil = user.isKanwil ? (user.uptId ?? "") : kanwilId;
    const query = kanwil ? `?kanwil=${encodeURIComponent(kanwil)}` : "";
    apiGet<{ items: LookupItem[] }>(`/lookups/upt${query}`)
      .then((data) => setUptItems(data.items))
      .catch(() => setUptItems([]));
  }, [user.isKanwil, user.uptId, kanwilId]);

  const applyScope = async (nextKanwil: string, nextUpt: string) => {
    setSaving(true);
    setError(null);
    try {
      await apiSetWorkingScope(nextUpt || null, user.isPusat ? nextKanwil || null : null);
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal mengubah filter wilayah.");
      setSaving(false);
    }
  };

  const onKanwilChange = (value: string) => {
    setKanwilId(value);
    setUptId("");
    void applyScope(value, "");
  };

  const onUptChange = (value: string) => {
    setUptId(value);
    void applyScope(kanwilId, value);
  };

  const scopeLabel =
    uptId !== ""
      ? (uptItems.find((item) => item.id === uptId)?.label ?? uptId)
      : kanwilId !== ""
        ? (kanwilItems.find((item) => item.id === kanwilId)?.label ?? kanwilId)
        : "Semua Wilayah";

  return (
    <div className="working-scope-picker">
      <span>Filter wilayah kerja</span>
      <strong title={scopeLabel}>{scopeLabel}</strong>
      <div className="working-scope-controls">
        {user.isPusat ? (
          <label className="working-scope-field">
            <span className="sr-only">Kanwil</span>
            <select
              value={kanwilId}
              disabled={saving}
              onChange={(event) => onKanwilChange(event.target.value)}
              aria-label="Filter Kanwil"
            >
              <option value="">Semua Kanwil</option>
              {kanwilItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="working-scope-field">
          <span className="sr-only">UPT</span>
          <select
            value={uptId}
            disabled={saving}
            onChange={(event) => onUptChange(event.target.value)}
            aria-label="Filter UPT"
          >
            <option value="">Semua UPT</option>
            {uptItems.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error ? <span className="working-scope-error">{error}</span> : null}
    </div>
  );
}

function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const current = (document.documentElement.getAttribute("data-theme") as "dark" | "light") || "dark";
    setTheme(current);

    const observer = new MutationObserver(() => {
      const updated = (document.documentElement.getAttribute("data-theme") as "dark" | "light") || "dark";
      setTheme(updated);
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    return () => observer.disconnect();
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    document.documentElement.setAttribute("data-theme", nextTheme);
    try {
      localStorage.setItem("sdp-theme", nextTheme);
    } catch (e) {}
  };

  if (!mounted) {
    return (
      <button type="button" className="theme-toggle-btn" aria-label="Ganti tema warna">
        <Icon name="sun" size={15} />
        <span className="theme-toggle-label">Tema</span>
      </button>
    );
  }

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`theme-toggle-btn ${isDark ? "is-dark" : "is-light"}`}
      aria-label={isDark ? "Beralih ke Tema Terang (Light Mode)" : "Beralih ke Tema Gelap (Dark Mode)"}
      title={isDark ? "Beralih ke Tema Terang" : "Beralih ke Tema Gelap"}
    >
      {isDark ? (
        <>
          <Icon name="sun" size={15} />
          <span className="theme-toggle-label">Terang</span>
        </>
      ) : (
        <>
          <Icon name="moon" size={15} />
          <span className="theme-toggle-label">Gelap</span>
        </>
      )}
    </button>
  );
}

function Icon({
  name,
  size = 15,
}: {
  name: "id-card" | "log-out" | "sun" | "moon";
  size?: number;
}) {
  let paths: React.ReactNode;

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
    case "log-out":
      paths = (
        <>
          <path d="M10 5H5.5A1.5 1.5 0 0 0 4 6.5v11A1.5 1.5 0 0 0 5.5 19H10" />
          <path d="M14 8l4 4-4 4M9 12h9" />
        </>
      );
      break;
    case "sun":
      paths = (
        <>
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </>
      );
      break;
    case "moon":
      paths = (
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
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
