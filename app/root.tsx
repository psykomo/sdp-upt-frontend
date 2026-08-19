import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLocation,
} from "react-router";

import type { Route } from "./+types/root";
import "./app.css";

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap",
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var stored = localStorage.getItem('sdp-theme');
                  var theme = stored || 'dark';
                  document.documentElement.setAttribute('data-theme', theme);
                } catch(e) {}
                try {
                  var u = new URL(location.href);
                  if (u.pathname.replace(/\\/$/, '') !== '/auth/legacy') return;
                  var t = u.searchParams.get('token');
                  if (!t) return;
                  sessionStorage.setItem('sdp_handover_token', t);
                  sessionStorage.setItem('sdp_handover_return', u.searchParams.get('return') || '/identitas');
                  u.searchParams.delete('token');
                  var q = u.searchParams.toString();
                  history.replaceState(null, '', u.pathname + (q ? '?' + q : '') + u.hash);
                } catch(e) {}
              })();
            `,
          }}
        />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function HydrateFallback() {
  return (
    <main className="modern-page-shell">
      <div className="empty-state-box">
        <h1 className="empty-title">Memuat SDP 4.0</h1>
        <p className="empty-desc">Menyiapkan halaman…</p>
      </div>
    </main>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const location = useLocation();
  const reloadHref = `${location.pathname}${location.search}`;
  const unavailable = isRouteErrorResponse(error) && error.status === 503;
  let message = "Terjadi kesalahan.";
  let details = "Muat ulang halaman ini, atau coba lagi beberapa saat.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = unavailable ? "API tidak tersedia" : error.status === 404 ? "Halaman tidak ditemukan" : "Gagal memuat halaman";
    details = String(error.data || error.statusText || details);
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="modern-page-shell">
      <div className="empty-state-box error-box">
        <h1 className="empty-title">{message}</h1>
        <p className="empty-desc">{details}</p>
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
        {stack ? (
          <pre className="w-full p-4 overflow-x-auto">
            <code>{stack}</code>
          </pre>
        ) : null}
      </div>
    </main>
  );
}
