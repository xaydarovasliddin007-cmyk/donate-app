import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { useLocale } from '../i18n/LocaleContext';
import { LanguageSwitcher } from './LanguageSwitcher';
import {
  AdminsIcon,
  AuditIcon,
  CardIcon,
  CloseIcon,
  DashboardIcon,
  GamepadIcon,
  LogoutIcon,
  MenuIcon,
  OrdersIcon,
  ProductIcon,
  ProviderIcon,
  RefundIcon,
  TopUpIcon,
  UsersIcon,
} from './icons';

interface NavItem {
  to: string;
  labelKey: string;
  icon: ReactNode;
  end?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', labelKey: 'nav.dashboard', icon: <DashboardIcon />, end: true },
  { to: '/games', labelKey: 'nav.games', icon: <GamepadIcon /> },
  { to: '/users', labelKey: 'nav.users', icon: <UsersIcon /> },
  { to: '/orders', labelKey: 'nav.orders', icon: <OrdersIcon /> },
  { to: '/topups', labelKey: 'nav.topups', icon: <TopUpIcon /> },
  { to: '/refunds', labelKey: 'nav.refunds', icon: <RefundIcon /> },
  { to: '/receiving-methods', labelKey: 'nav.receivingMethods', icon: <CardIcon /> },
  { to: '/products', labelKey: 'nav.products', icon: <ProductIcon /> },
  { to: '/providers', labelKey: 'nav.providers', icon: <ProviderIcon /> },
  { to: '/audit-logs', labelKey: 'nav.auditLogs', icon: <AuditIcon /> },
];

const SUPER_ADMIN_NAV_ITEMS: NavItem[] = [{ to: '/admins', labelKey: 'nav.admins', icon: <AdminsIcon /> }];

const PENDING_TOPUPS_POLL_MS = 30_000;

/** Polls the pending-top-up count so the sidebar badge stays current without a manual reload — the queue an operator needs to clear fast for a real-money app. */
function usePendingTopUpsCount(): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const result = await api.get<{ topUps: unknown[] }>('/admin/topups', { status: 'PENDING', limit: 100 });
        if (!cancelled) setCount(result.topUps.length);
      } catch {
        // Best-effort — a stale/missing badge isn't worth surfacing an error for.
      }
    }
    poll();
    const interval = window.setInterval(poll, PENDING_TOPUPS_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  return count;
}

function initials(name: string | undefined): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  const chars = parts.length > 1 ? [parts[0][0], parts[parts.length - 1][0]] : [parts[0]?.[0] ?? '?'];
  return chars.join('').toUpperCase();
}

export function Layout() {
  const { admin, logout } = useAuth();
  const { t } = useLocale();
  const [navOpen, setNavOpen] = useState(false);
  const navItems = admin?.role === 'SUPER_ADMIN' ? [...NAV_ITEMS, ...SUPER_ADMIN_NAV_ITEMS] : NAV_ITEMS;
  const pendingTopUps = usePendingTopUpsCount();

  return (
    <div className="app-shell">
      <button
        className="nav-toggle"
        onClick={() => setNavOpen((v) => !v)}
        aria-label={navOpen ? t('nav.closeMenu') : t('nav.openMenu')}
        aria-expanded={navOpen}
      >
        {navOpen ? <CloseIcon /> : <MenuIcon />}
      </button>

      {navOpen && <div className="sidebar-scrim" onClick={() => setNavOpen(false)} />}

      <aside className={`sidebar${navOpen ? ' open' : ''}`}>
        <div className="brand">
          <span className="brand-mark">U</span>
          <span>
            UZDONATE
            <small>{t('nav.tagline')}</small>
          </span>
        </div>
        <nav onClick={() => setNavOpen(false)}>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              <span className="nav-icon">{item.icon}</span>
              {t(item.labelKey)}
              {item.to === '/topups' && pendingTopUps > 0 && (
                <span className="nav-badge">{pendingTopUps > 99 ? '99+' : pendingTopUps}</span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <LanguageSwitcher />
          <div className="admin-identity">
            <span className="admin-avatar">{initials(admin?.fullName)}</span>
            <span>
              <div className="admin-name">{admin?.fullName}</div>
              <div className="admin-role">{admin?.role.replace('_', ' ')}</div>
            </span>
          </div>
          <button className="btn btn-secondary btn-block" onClick={logout}>
            <LogoutIcon width={16} height={16} />
            {t('nav.logout')}
          </button>
        </div>
      </aside>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
