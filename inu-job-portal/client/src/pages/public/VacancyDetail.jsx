import { Link, useLocation, useParams } from 'react-router-dom';
import useApi from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { ErrorState, PageLoader, StatusBadge } from '../../components/ui';
import { formatDateTime, label } from '../../utils/format';

export default function VacancyDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const location = useLocation();
  const { data: v, loading, error, reload } = useApi(`/vacancies/${id}`);

  if (loading) return <PageLoader />;
  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <ErrorState message={error} onRetry={reload} />
        <Link to="/vacancies" className="btn btn-secondary mt-4">Back to vacancies</Link>
      </div>
    );
  }

  let action;
  if (!user) {
    action = (
      <>
        <p className="mb-3 text-sm text-slate-600">Log in as an applicant to apply for this vacancy.</p>
        <Link to="/login" state={{ from: location }} className="btn btn-primary w-full">Log in to apply</Link>
        <Link to="/register" className="btn btn-secondary mt-2 w-full">Create an account</Link>
      </>
    );
  } else if (user.role === 'applicant') {
    if (v.my_application) {
      action = (
        <>
          <p className="mb-3 text-sm text-slate-600">You have already applied for this vacancy.</p>
          <Link to={`/portal/applications/${v.my_application.id}`} className="btn btn-primary w-full">View my application</Link>
        </>
      );
    } else if (v.is_open) {
      action = <Link to={`/portal/apply/${v.id}`} className="btn btn-primary w-full">Apply now</Link>;
    } else {
      action = <p className="text-sm font-medium text-slate-600">Applications for this vacancy are closed.</p>;
    }
  } else if (['hr_officer', 'admin'].includes(user.role)) {
    action = <Link to={`/portal/manage/vacancies/${v.id}`} className="btn btn-primary w-full">Open management page</Link>;
  } else {
    action = <p className="text-sm text-slate-600">Only applicants can apply for vacancies.</p>;
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Link to="/vacancies" className="text-sm font-semibold">&larr; All vacancies</Link>
      <div className="mt-4 grid gap-6 lg:grid-cols-3">
        <article className="card p-6 lg:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">{v.department}</p>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold">{v.title}</h1>
            {!v.is_open && <StatusBadge status={v.status} />}
          </div>
          <p className="mt-1 text-sm text-slate-500">Reference {v.reference_no}</p>

          <h2 className="mt-6 text-lg font-semibold">Job description</h2>
          <p className="mt-2 whitespace-pre-line text-slate-700">{v.description}</p>

          <h2 className="mt-6 text-lg font-semibold">Qualifications and requirements</h2>
          <p className="mt-2 whitespace-pre-line text-slate-700">{v.qualifications}</p>
          {v.required_skills?.length > 0 && (
            <>
              <h2 className="mt-6 text-lg font-semibold">Required skills</h2>
              <ul className="mt-2 flex flex-wrap gap-2">
                {v.required_skills.map((s) => <li key={s} className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800">{s}</li>)}
              </ul>
            </>
          )}
        </article>

        <aside className="space-y-4">
          <div className="card p-5">
            <h2 className="text-base font-semibold">At a glance</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Category</dt><dd className="font-medium">{label(v.category)}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Employment</dt><dd className="font-medium">{label(v.employment_type)}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Location</dt><dd className="font-medium">{v.location}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Positions</dt><dd className="font-medium">{v.positions_count}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Deadline</dt><dd className="font-medium">{formatDateTime(v.deadline_at)}</dd></div>
            </dl>
          </div>
          <div className="card p-5">
            <h2 className="text-base font-semibold">Required documents</h2>
            <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-slate-700">
              {v.required_documents.map((d) => <li key={d.code}>{d.name}</li>)}
            </ul>
            <p className="mt-3 text-xs text-slate-500">PDF, JPEG or PNG, up to 5 MB each.</p>
          </div>
          <div className="card p-5">{action}</div>
        </aside>
      </div>
    </div>
  );
}
