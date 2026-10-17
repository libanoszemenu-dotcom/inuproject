import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useApi from '../../hooks/useApi';
import { VacancyCard } from './Vacancies.jsx';
import { EmptyState, PageLoader } from '../../components/ui';

const STEPS = [
  ['1', 'Create an account', 'Register as an applicant and complete your profile.'],
  ['2', 'Find a vacancy', 'Search open announcements and read the requirements.'],
  ['3', 'Apply online', 'Submit your application with the required documents.'],
  ['4', 'Track progress', 'Follow your status, interview invitations and notifications.'],
];

export default function Home() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const latest = useApi('/vacancies', { page: 1, page_size: 3 });

  function onSearch(e) {
    e.preventDefault();
    if (q.trim()) {
      navigate(`/vacancies?q=${encodeURIComponent(q.trim())}`);
    }
  }

  return (
    <>
      {/* Hero Section with Full Background Video & Floating Content */}
      <section className="relative min-h-[550px] flex items-center justify-center text-white overflow-hidden bg-emerald-950">
        
        {/* Background Video */}
        <video
          src="/video_2026-10-17_12-58-29.mp4"
          className="absolute inset-0 h-full w-full object-cover"
          autoPlay
          loop
          muted
          playsInline
        />

        {/* Dark Emerald Gradient Overlay (so text is clearly readable over the video) */}
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-950/90 via-emerald-900/85 to-emerald-950/80"></div>

        {/* Floating Content / Text */}
        <div className="relative mx-auto max-w-7xl px-4 py-20 sm:py-28 lg:px-8 w-full z-10">
          <div className="max-w-3xl">
            <p className="mb-4 inline-block rounded-full bg-emerald-700/60 border border-emerald-400/40 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-100 backdrop-blur-sm">
              Injibara University Recruitment Portal
            </p>
            <h1 className="text-3xl font-extrabold leading-tight sm:text-5xl lg:text-6xl text-white drop-shadow-md">
              One place to announce vacancies, apply, and follow every step
            </h1>
            <p className="mt-4 text-lg text-emerald-100/95 drop-shadow">
              Browse open academic and administrative positions, submit your applications online, and track your progress in real-time.
            </p>
            
            <form onSubmit={onSearch} className="mt-8 flex flex-col gap-2 sm:flex-row max-w-xl" role="search">
              <label htmlFor="hero-search" className="sr-only">Search vacancies</label>
              <input
                id="hero-search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by job title or keyword..."
                className="input flex-1 py-3 text-slate-800 text-base shadow-lg focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white/95 backdrop-blur-sm"
              />
              <button 
                type="submit" 
                className="btn bg-amber-400 hover:bg-amber-300 text-emerald-950 font-bold px-6 py-3 text-base transition-colors shadow-lg"
              >
                Search
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* Latest Vacancies Section */}
      <section className="mx-auto max-w-7xl px-4 py-12 lg:px-8">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Latest Vacancies</h2>
            <p className="text-sm text-slate-500">Explore recent job openings at Injibara University</p>
          </div>
          <Link to="/vacancies" className="text-sm font-semibold text-emerald-700 hover:text-emerald-800 hover:underline">
            View all &rarr;
          </Link>
        </div>

        {latest.loading ? (
          <PageLoader />
        ) : latest.error ? (
          <EmptyState title="Vacancies are unavailable right now" message={latest.error} />
        ) : !latest.data || latest.data.length === 0 ? (
          <EmptyState title="No open vacancies at the moment" message="Please check again later." />
        ) : (
          <div className="grid gap-6 md:grid-cols-3">
            {latest.data.map((v) => (
              <VacancyCard key={v.id} vacancy={v} />
            ))}
          </div>
        )}
      </section>

      {/* How it works Section */}
      <section className="border-t border-slate-200 bg-emerald-50/40">
        <div className="mx-auto max-w-7xl px-4 py-12 lg:px-8">
          <h2 className="text-2xl font-bold text-slate-900">How it works</h2>
          <p className="mt-1 text-sm text-slate-600">Follow these simple steps to complete your job application.</p>
          
          <ol className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(([n, title, text]) => (
              <li key={n} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-700 text-base font-bold text-white shadow">
                  {n}
                </span>
                <h3 className="mt-4 font-semibold text-slate-900">{title}</h3>
                <p className="mt-2 text-sm text-slate-600">{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </>
  );
}