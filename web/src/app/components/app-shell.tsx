'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { adminLogoutAction } from '../admin/login/actions';

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

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Kurulum',
    items: [
      { href: '/congresses', label: 'Kongreler', icon: ICONS.congress },
      { href: '/halls', label: 'Salonlar', icon: ICONS.hall },
      { href: '/beacons', label: "Beacon'lar", icon: ICONS.beacon },
    ],
  },
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

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = pathname?.startsWith('/admin/login');

  if (isAuthPage) {
    return <>{children}</>;
  }

  return (
    <div className="shell">
      <aside className="shell-sidebar">
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

        <nav className="shell-nav">
          {NAV_GROUPS.map((group) => (
            <div className="shell-nav-group" key={group.label}>
              <span className="shell-nav-group-label">{group.label}</span>
              {group.items.map((item) => {
                const active = pathname === item.href || pathname?.startsWith(item.href + '?');
                return (
                  <Link
                    key={item.href}
                    href={item.href}
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

      <div className="shell-main">{children}</div>
    </div>
  );
}
