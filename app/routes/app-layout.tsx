import { Form, Link, Outlet, isRouteErrorResponse, useLocation } from "react-router";
import { useState, useEffect } from "react";
import { apiGet, requireToken } from "../lib/session.server";
import type { Route } from "./+types/app-layout";

type Me = {
  user: {
    id: string;
    name: string;
    levelName: string | null;
    uptName: string | null;
    isPusat: boolean;
    isKanwil: boolean;
  };
};

export async function loader({ request }: Route.LoaderArgs) {
  const token = await requireToken(request);
  const me = await apiGet<Me>(token, "/auth/me", request);
  return me;
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
  const { user } = loaderData;

  return (
    <div className="min-h-screen app-wrapper">
      <header className="site-header">
        <div className="header-main">
          <Link to="/identitas" className="brand" aria-label="SDP 4.0">
            <span className="brand-mark">SDP</span>
            <span className="brand-copy">
              <strong>Sistem Database</strong>
              <span>Pemasyarakatan · SDP 4.0</span>
            </span>
          </Link>

          <div className="site-context">
            <span>Unit pelaksana teknis</span>
            <strong>{user.uptName ?? "Sistem Database Pemasyarakatan"}</strong>
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
            <Link to="/identitas" className="nav-item nav-item-active">
              <Icon name="id-card" size={14} />
              <span>Data Identitas</span>
            </Link>
            <span className="nav-status">
              <span className="live-dot" />
              <span>Sesi aktif</span>
            </span>
          </div>
        </nav>
      </header>
      <Outlet />
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
