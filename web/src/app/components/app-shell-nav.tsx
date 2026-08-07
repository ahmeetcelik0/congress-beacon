'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { adminLogoutAction } from '../admin/login/actions';
import { IconButton } from '@/components/ui/icon-button';
import { CollapsibleRegion } from '@/components/ui/collapsible';
import { CongressIdReader } from './congress-id-reader';

export type NavCongress = { id: string; name: string };

type NavItem = { href: string; label: string; icon: React.ReactNode };
type NavGroup = { label: string; items: NavItem[] };

const ICONS = {
  congress: (
    <svg viewBox="0 0 20 20" fill="none">
      <path d="M3 17V8l7-4 7 4v9" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M8 17v-5h4v5" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  ),
  hall: (
    <svg viewBox="0 0 20 20" fill="none">
      <rect x="3" y="4" width="14" height="12" rx="1" stroke="currentColor" strokeWidth="1.4" />
      <path d="M3 9h14M8 9v7" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  ),
  beacon: (
    <svg viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="1.8" fill="currentColor" />
      <path
        d="M6.5 6.5a5 5 0 0 0 0 7M13.5 6.5a5 5 0 0 1 0 7M4 4a8 8 0 0 0 0 12M16 4a8 8 0 0 1 0 12"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  ),
  registrations: (
    <svg viewBox="0 0 20 20" fill="none">
      <circle cx="7.5" cy="6.5" r="2.5" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M2.8 16c.5-2.8 2.4-4.3 4.7-4.3s4.2 1.5 4.7 4.3"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        d="M13 7.2a2.2 2.2 0 1 0 0-4.4M14.3 11.9c1.9.3 3.3 1.6 3.7 4"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  ),
  live: (
    <svg viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="10" cy="10" r="2.2" fill="currentColor" />
    </svg>
  ),
  health: (
    <svg viewBox="0 0 20 20" fill="none">
      <path d="M3 10h3l2-5 4 10 2-5h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  report: (
    <svg viewBox="0 0 20 20" fill="none">
      <path d="M4 16V4M9 16V8M14 16v-6M4 16h12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
  program: (
    <svg viewBox="0 0 20 20" fill="none">
      <rect x="3" y="3.5" width="14" height="13" rx="1" stroke="currentColor" strokeWidth="1.4" />
      <path d="M3 7.5h14M7 3.5v-1M13 3.5v-1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
};

const ChevronIcon = () => (
  <svg viewBox="0 0 12 12" fill="none" aria-hidden="true">
    <path
      d="M3 4.5 6 7.5 9 4.5"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const MenuIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

// "Kongreler" dışındaki gruplar — congressId, o an aktif olan kongreye göre
// (URL'deki ?congressId=) her linke otomatik eklenir, böylece sayfalar
// arası geçişte seçili kongre kaybolmaz.
const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Canlı',
    items: [
      { href: '/attendance', label: 'Canlı Takip', icon: ICONS.live },
      { href: '/tracking-health', label: 'Takip Sağlığı', icon: ICONS.health },
    ],
  },
  {
    label: 'Yönetim',
    items: [
      { href: '/sessions', label: 'Bilimsel Program', icon: ICONS.program },
      { href: '/reports', label: 'Raporlar', icon: ICONS.report },
    ],
  },
];

function withCongressId(href: string, congressId: string | null): string {
  return congressId ? `${href}?congressId=${congressId}` : href;
}

function CongressNode({
  congress,
  activeCongressId,
  pathname,
  isOpen,
  onToggle,
}: {
  congress: NavCongress;
  activeCongressId: string | null;
  pathname: string | null;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const panelId = `sidebar-congress-panel-${congress.id}`;
  const isActiveCongress = activeCongressId === congress.id;

  return (
    <li className="shell-congress-item">
      <div className="shell-congress-row">
        <Link
          href={`/halls?congressId=${congress.id}`}
          className="shell-congress-link"
          data-active={isActiveCongress || undefined}
          title={congress.name}
        >
          {congress.name}
        </Link>
        <IconButton
          aria-label={isOpen ? `${congress.name} alt menüsünü kapat` : `${congress.name} alt menüsünü aç`}
          aria-expanded={isOpen}
          aria-controls={panelId}
          size="sm"
          className="shell-nav-toggle"
          onClick={onToggle}
        >
          <ChevronIcon />
        </IconButton>
      </div>
      <CollapsibleRegion id={panelId} open={isOpen} innerClassName="shell-congress-sublinks">
        <Link
          href={`/halls?congressId=${congress.id}`}
          className="shell-congress-sublink"
          data-active={(isActiveCongress && pathname === '/halls') || undefined}
        >
          Salonlar
        </Link>
        <Link
          href={`/beacons?congressId=${congress.id}`}
          className="shell-congress-sublink"
          data-active={(isActiveCongress && pathname === '/beacons') || undefined}
        >
          Beacon&apos;lar
        </Link>
      </CollapsibleRegion>
    </li>
  );
}

export function AppShellNav({
  recentCongresses,
  recentCongressesFailed = false,
  children,
}: {
  recentCongresses: NavCongress[];
  recentCongressesFailed?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isAuthPage = pathname?.startsWith('/admin/login');

  const [congressId, setCongressId] = useState<string | null>(null);
  const [recentOpen, setRecentOpen] = useState(false);
  const [openCongressId, setOpenCongressId] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const previousCongressId = useRef<string | null>(null);

  function handleCongressIdChange(value: string | null) {
    setCongressId(value);
    // Sadece seçili kongre GERÇEKTEN değiştiğinde otomatik aç — kullanıcı
    // aynı kongredeyken listeyi elle kapatmışsa bunu geri açmayalım.
    if (value && value !== previousCongressId.current) {
      setRecentOpen(true);
      setOpenCongressId(value);
    }
    previousCongressId.current = value;
  }

  // Rota değiştiğinde mobil çekmeceyi kapat — render sırasında state
  // ayarlama deseni (React'ın önerdiği "adjust state during render"),
  // ayrı bir effect yerine kullanılır ki gereksiz kademeli render olmasın.
  const [renderedPathname, setRenderedPathname] = useState(pathname);
  if (pathname !== renderedPathname) {
    setRenderedPathname(pathname);
    if (mobileOpen) setMobileOpen(false);
  }

  // Escape ile mobil çekmeceyi kapat + Tab/Shift+Tab odağını çekmece
  // içinde tut. `.shell-main` çekmece açıkken `inert` olduğu için tarayıcı
  // zaten oraya Tab ile girmeyi engelliyor (asıl doğrulanan hatayı bu
  // çözer); burada eklenen döngü ise Tab'ın son öğeden sonra tarayıcı
  // arayüzüne (adres çubuğu) kaçmasını ve Shift+Tab'ın hamburger'dan
  // geriye kaçmasını da engelleyerek klavye gezintisini tamamen kapalı
  // bir döngü haline getirir.
  useEffect(() => {
    if (!mobileOpen) return;

    function getFocusable(): HTMLElement[] {
      const selector =
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
      return Array.from(document.querySelectorAll<HTMLElement>(selector)).filter(
        (element) => !element.closest('[inert]') && element.offsetParent !== null,
      );
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMobileOpen(false);
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = getFocusable();
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (event.shiftKey) {
        if (active === first || !active || !focusable.includes(active)) {
          event.preventDefault();
          last.focus();
        }
      } else if (active === last || !active || !focusable.includes(active)) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [mobileOpen]);

  // Çekmece açıkken arka plan (body) scroll etmesin.
  useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen]);

  if (isAuthPage) {
    return <>{children}</>;
  }

  const isCongressesActive = pathname === '/congresses';

  return (
    <>
      <div className="shell-topbar">
        <IconButton
          aria-label={mobileOpen ? 'Menüyü kapat' : 'Menüyü aç'}
          aria-expanded={mobileOpen}
          aria-controls="primary-navigation"
          className="shell-menu-toggle"
          onClick={() => setMobileOpen((open) => !open)}
        >
          <MenuIcon />
        </IconButton>
        <span className="shell-topbar-brand">KONGRE BEACON</span>
      </div>

      <div
        className="shell-backdrop"
        data-open={mobileOpen}
        aria-hidden="true"
        onClick={() => setMobileOpen(false)}
      />

      <div className="shell">
        <aside className="shell-sidebar" data-open={mobileOpen}>
          <Link href="/attendance" className="shell-brand">
            <span className="shell-brand-mark" aria-hidden="true">
              <span className="shell-brand-dot" />
              <span className="shell-brand-ring" />
            </span>
            <span className="shell-brand-text">
              KONGRE
              <br />
              BEACON
            </span>
          </Link>

          <nav id="primary-navigation" className="shell-nav" aria-label="Ana menü">
            <div className="shell-nav-group">
              <span className="shell-nav-group-label">Kurulum</span>

              <div className="shell-nav-row">
                <Link
                  href="/congresses"
                  className={`shell-nav-item${isCongressesActive ? ' shell-nav-item-active' : ''}`}
                >
                  <span className="shell-nav-icon">{ICONS.congress}</span>
                  Kongreler
                </Link>
                <IconButton
                  aria-label={recentOpen ? 'Son kongreler listesini kapat' : 'Son kongreler listesini aç'}
                  aria-expanded={recentOpen}
                  aria-controls="sidebar-recent-congresses"
                  size="sm"
                  className="shell-nav-toggle"
                  onClick={() => setRecentOpen((open) => !open)}
                >
                  <ChevronIcon />
                </IconButton>
              </div>

              <CollapsibleRegion id="sidebar-recent-congresses" open={recentOpen} className="shell-subnav">
                {recentCongressesFailed ? (
                  <p className="shell-nav-empty shell-nav-error">
                    Kongre listesi yüklenemedi.
                  </p>
                ) : recentCongresses.length === 0 ? (
                  <p className="shell-nav-empty">Henüz kongre yok.</p>
                ) : (
                  <ul className="shell-congress-list">
                    {recentCongresses.map((congress) => (
                      <CongressNode
                        key={congress.id}
                        congress={congress}
                        activeCongressId={congressId}
                        pathname={pathname}
                        isOpen={openCongressId === congress.id}
                        onToggle={() =>
                          setOpenCongressId((current) => (current === congress.id ? null : congress.id))
                        }
                      />
                    ))}
                  </ul>
                )}
              </CollapsibleRegion>

              <Link
                href={withCongressId('/halls', congressId)}
                className={`shell-nav-item${pathname === '/halls' ? ' shell-nav-item-active' : ''}`}
              >
                <span className="shell-nav-icon">{ICONS.hall}</span>
                Salonlar
              </Link>
              <Link
                href={withCongressId('/beacons', congressId)}
                className={`shell-nav-item${pathname === '/beacons' ? ' shell-nav-item-active' : ''}`}
              >
                <span className="shell-nav-icon">{ICONS.beacon}</span>
                Beacon&apos;lar
              </Link>
              <Link
                href={withCongressId('/registrations', congressId)}
                className={`shell-nav-item${pathname === '/registrations' ? ' shell-nav-item-active' : ''}`}
              >
                <span className="shell-nav-icon">{ICONS.registrations}</span>
                Katılımcılar
              </Link>
            </div>

            {NAV_GROUPS.map((group) => (
              <div className="shell-nav-group" key={group.label}>
                <span className="shell-nav-group-label">{group.label}</span>
                {group.items.map((item) => {
                  const href = withCongressId(item.href, congressId);
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={href}
                      className={`shell-nav-item${active ? ' shell-nav-item-active' : ''}`}
                    >
                      <span className="shell-nav-icon">{item.icon}</span>
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>

          <form action={adminLogoutAction} className="shell-logout">
            <button type="submit">Çıkış Yap</button>
          </form>
        </aside>

        <div className="shell-main" inert={mobileOpen || undefined} aria-hidden={mobileOpen || undefined}>
          {children}
        </div>
      </div>

      <Suspense fallback={null}>
        <CongressIdReader onChange={handleCongressIdChange} />
      </Suspense>
    </>
  );
}
