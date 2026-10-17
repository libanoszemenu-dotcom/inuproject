import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import useApi from '../../hooks/useApi';
import { ROLE_LABELS } from '../../utils/format';
import Brand from './Brand';
import VerifyBanner from '../VerifyBanner';

const NAV = {
  applicant: [
    ['/portal', 'Dashboard', true],
    ['/vacancies', 'Browse vacancies'],
    ['/portal/profile', 'My profile'],
    ['/portal/applications', 'My applications'],
    ['/portal/interviews', 'Interviews'],
    ['/portal/notifications', 'Notifications'],
    ['/portal/account', 'Account'],
  ],
  hr_officer: [
    ['/portal', 'Dashboard', true],
    ['/portal/manage/vacancies', 'Vacancies'],
    ['/portal/manage/applications', 'Applications'],
    ['/portal/manage/pipeline', 'Pipeline board'],
    ['/portal/interviews', 'Interviews'],
    ['/portal/reports', 'Reports'],
    ['/portal/notifications', 'Notifications'],
    ['/portal/account', 'Account'],
  ],
  department_head: [
    ['/portal', 'Dashboard', true],
    ['/portal/manage/applications', 'Department applications'],
    ['/portal/manage/pipeline', 'Pipeline board'],
    ['/portal/interviews', 'Interviews'],
    ['/portal/notifications', 'Notifications'],
    ['/portal/account', 'Account'],
  ],
  admin: [
    ['/portal', 'Dashboard', true],
    ['/portal/users', 'Users and roles'],
    ['/portal/departments', 'Departments'],
    ['/portal/manage/vacancies', 'Vacancy approvals'],
    ['/portal/reports', 'Reports'],
    ['/portal/audit', 'Audit logs'],
    ['/portal/notifications', 'Notifications'],
    ['/portal/account', 'Account'],
  ],
};

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const unread = useApi('/notifications', { page_size: 1 });
  const reloadUnread = unread.reload;

  useEffect(() => {
    const timer = setInterval(reloadUnread, 60000);
    window.addEventListener('notifications:changed', reloadUnread);
    return () => {
      clearInterval(timer);
      window.removeEventListener('notifications:changed', reloadUnread);
    };
  }, [reloadUnread]);

  useEffect(() => { setOpen(false); }, [location.pathname]);

  const unreadCount = unread.meta?.unread_count || 0;
  const items = NAV[user.role] || [];

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <div className="min-h-screen lg:flex">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:p-2">
        Skip to content
      </a>
      {open && <div className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden" onClick={() => setOpen(false)} aria-hidden="true" />}

      <aside
        aria-label="Sidebar"
        className={`fixed inset-y-0 left-0 z-40 w-64 shrink-0 transform bg-brand-900 text-white transition-transform lg:static lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="px-5 py-5"><Link to="/" aria-label="Injibara University recruitment home"><Brand light /></Link></div>
        <nav className="space-y-1 px-3" aria-label="Portal">
          {items.map(([to, text, end]) => (
            <NavLink
              key={to}
              to={to}
              end={Boolean(end)}
              className={({ isActive }) =>
                `block rounded-lg px-3 py-2 text-sm font-medium ${isActive ? 'bg-white/15 text-white' : 'text-brand-100 hover:bg-white/10 hover:text-white'}`
              }
            >
              {text}
            </NavLink>
          ))}
        </nav>
        <p className="absolute inset-x-0 bottom-0 px-5 py-4 text-xs text-brand-200">&copy; {new Date().getFullYear()} Injibara University</p>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
          <button type="button" className="rounded-lg p-2 text-slate-700 hover:bg-slate-100 lg:hidden" aria-label="Open menu" onClick={() => setOpen(true)}>
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <div className="hidden text-sm text-slate-500 lg:block">{ROLE_LABELS[user.role]}</div>
          <div className="flex items-center gap-3">
            <Link to="/portal/notifications" className="relative rounded-lg p-2 text-slate-700 hover:bg-slate-100" aria-label={`Notifications, ${unreadCount} unread`}>
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8a6 6 0 10-12 0c0 7-3 8-3 8h18s-3-1-3-8M13.7 20a2 2 0 01-3.4 0" />
              </svg>
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-xs font-bold text-white">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </Link>
            <div className="hidden text-right text-sm sm:block">
              <p className="font-semibold text-slate-900">{user.full_name}</p>
              <p className="text-xs text-slate-500">{user.email}</p>
            </div>
            <button type="button" className="btn btn-secondary btn-sm" onClick={handleLogout}>Log out</button>
          </div>
        </header>
        <main id="main" className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-6xl">
            <VerifyBanner />
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
