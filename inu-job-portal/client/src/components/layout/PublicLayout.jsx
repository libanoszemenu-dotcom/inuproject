import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Brand from './Brand';

const linkClass = ({ isActive }) =>
  `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
    isActive 
      ? 'bg-emerald-50 text-emerald-800 font-semibold' 
      : 'text-slate-700 hover:bg-slate-100 hover:text-emerald-700'
  }`;

export default function PublicLayout() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:p-2">
        Skip to content
      </a>
      
      <header className="sticky top-0 z-30 border-b border-emerald-100 bg-white/95 backdrop-blur shadow-sm">
        {/* University Green Header Top Bar */}
        <div className="bg-emerald-800 text-white text-xs py-1.5 px-4 text-center font-medium tracking-wide">
          🇪🇹 Injibara University Official Academic and Administrative Staff Recruitment Portal
        </div>

        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          {/* Logo and Branding */}
          <Link to="/" aria-label="Injibara University Home" className="flex items-center gap-3 group">
            <img 
              src="https://www.neaea.com/wp-content/uploads/2020/05/Injibara-University.jpg" 
              alt="Injibara University Logo" 
              className="h-10 w-10 object-contain transition-transform group-hover:scale-105"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
            <div className="flex flex-col">
              <span className="font-bold text-slate-900 leading-tight text-base group-hover:text-emerald-800 transition-colors">
                Injibara University
              </span>
              <span className="text-xs text-emerald-700 font-medium">
                Recruitment & Talent Portal
              </span>
            </div>
          </Link>

          <button
            type="button"
            className="rounded-lg p-2 text-slate-700 hover:bg-emerald-50 md:hidden"
            aria-label="Toggle menu"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>

          <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
            <NavLink to="/" end className={linkClass}>Home</NavLink>
            <NavLink to="/vacancies" className={linkClass}>Vacancies</NavLink>
            {user ? (
              <Link to="/portal" className="ml-2 bg-emerald-800 text-white hover:bg-emerald-700 px-4 py-2 rounded-lg text-sm font-medium shadow-sm transition-all">My portal</Link>
            ) : (
              <>
                <NavLink to="/login" className={linkClass}>Log in</NavLink>
                <Link to="/register" className="ml-2 bg-emerald-800 text-white hover:bg-emerald-700 px-4 py-2 rounded-lg text-sm font-medium shadow-sm transition-all">Register</Link>
              </>
            )}
          </nav>
        </div>

        {open && (
          <nav className="flex flex-col gap-1 border-t border-slate-200 px-4 py-3 md:hidden bg-white shadow-lg" aria-label="Mobile">
            <NavLink to="/" end className={linkClass} onClick={() => setOpen(false)}>Home</NavLink>
            <NavLink to="/vacancies" className={linkClass} onClick={() => setOpen(false)}>Vacancies</NavLink>
            {user ? (
              <Link to="/portal" className="bg-emerald-800 text-white text-center py-2 rounded-lg font-medium shadow-sm" onClick={() => setOpen(false)}>My portal</Link>
            ) : (
              <>
                <NavLink to="/login" className={linkClass} onClick={() => setOpen(false)}>Log in</NavLink>
                <Link to="/register" className="bg-emerald-800 text-white text-center py-2 rounded-lg font-medium shadow-sm" onClick={() => setOpen(false)}>Register</Link>
              </>
            )}
          </nav>
        )}
      </header>

      <main id="main" className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-emerald-100 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-6 text-xs text-slate-500 flex flex-col md:flex-row items-center justify-between gap-4">
          <p>
            &copy; {new Date().getFullYear()} <strong>Injibara University</strong>. Staff Recruitment and Applicant Tracking Portal.
          </p>
          <div className="flex items-center gap-4 text-slate-400">
            <span>Privacy Policy</span>
            <span>Terms of Service</span>
            <span className="text-emerald-700 font-medium">ICT Directorate</span>
          </div>
        </div>
      </footer>
    </div>
  );
}