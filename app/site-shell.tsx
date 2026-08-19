type SiteShellProps = {
  children: React.ReactNode;
};

export function PageLoading() {
  return (
    <main className="modern-page-shell">
      <div className="empty-state-box">
        <h1 className="empty-title">Memuat halaman</h1>
        <p className="empty-desc">Menyiapkan data…</p>
      </div>
    </main>
  );
}

/** First-paint chrome. No user data — baked into index.html at build time. */
export function SiteShell({ children }: SiteShellProps) {
  return (
    <div className="min-h-screen app-wrapper" aria-busy="true">
      <header className="site-header">
        <div className="nav-progress" role="progressbar" aria-label="Memuat halaman">
          <span className="nav-progress-bar" />
        </div>
        <div className="header-main">
          <a href="/identitas" className="brand" aria-label="SDP 4.0">
            <span className="brand-mark">SDP</span>
            <span className="brand-copy">
              <strong>Sistem Database</strong>
              <span>Pemasyarakatan · SDP 4.0</span>
            </span>
          </a>
          <div className="site-context">
            <span>Unit pelaksana teknis</span>
            <strong>Sistem Database Pemasyarakatan</strong>
          </div>
          <div className="header-actions">
            <a href="/identitas" className="header-link">
              Manajemen Identitas
            </a>
          </div>
        </div>
        <nav className="primary-nav" aria-label="Navigasi utama">
          <div className="primary-nav-inner">
            <a href="/identitas" className="nav-item nav-item-active">
              <svg
                className="icon"
                width={14}
                height={14}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="2.5" y="4" width="19" height="16" rx="2.5" />
                <circle cx="8" cy="10" r="2" />
                <path d="M5.5 16c.7-1.8 4.3-1.8 5 0M14 9h4.5M14 13h4.5M14 17h3" />
              </svg>
              <span>Data Identitas</span>
            </a>
            <span className="nav-status is-pending">
              <span className="live-dot" />
              <span>Memuat halaman…</span>
            </span>
          </div>
        </nav>
      </header>
      {children}
    </div>
  );
}
