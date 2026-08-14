import { Form, Link, Outlet } from "react-router";
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

export default function AppLayout({ loaderData }: Route.ComponentProps) {
  const { user } = loaderData;

  return (
    <div className="min-h-screen">
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
                <Icon name="log-out" />
                Keluar
              </button>
            </Form>
          </div>
        </div>

        <nav className="primary-nav" aria-label="Navigasi utama">
          <div className="primary-nav-inner">
            <Link to="/identitas" className="nav-item nav-item-active">
              <Icon name="id-card" />
              Data identitas
            </Link>
            <span className="nav-status">
              <span className="live-dot" />
              Sesi aktif
            </span>
          </div>
        </nav>
      </header>
      <Outlet />
    </div>
  );
}

function Icon({
  name,
  size = 15,
}: {
  name: "id-card" | "log-out";
  size?: number;
}) {
  const paths =
    name === "id-card" ? (
      <>
        <rect x="2.5" y="4" width="19" height="16" rx="2.5" />
        <circle cx="8" cy="10" r="2" />
        <path d="M5.5 16c.7-1.8 4.3-1.8 5 0M14 9h4.5M14 13h4.5M14 17h3" />
      </>
    ) : (
      <>
        <path d="M10 5H5.5A1.5 1.5 0 0 0 4 6.5v11A1.5 1.5 0 0 0 5.5 19H10" />
        <path d="M14 8l4 4-4 4M9 12h9" />
      </>
    );

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
