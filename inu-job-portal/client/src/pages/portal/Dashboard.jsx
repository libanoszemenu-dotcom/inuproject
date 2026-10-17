import { Link } from 'react-router-dom';
import useApi from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import {
  Card, CardHeader, EmptyState, ErrorState, PageHeader, PageLoader, Progress, StatCard, StatusBadge, Table,
} from '../../components/ui';
import { BarByStatus, Donut, MonthlyBars } from '../../components/charts';
import { formatDate, formatDateTime, label } from '../../utils/format';

const sum = (c, keys) => keys.reduce((a, k) => a + Number(c?.[k] || 0), 0);

function UpcomingInterviews({ items }) {
  return (
    <Card>
      <CardHeader title="Upcoming interviews" action={<Link to="/portal/interviews" className="text-sm font-semibold">View all</Link>} />
      {items.length === 0 ? (
        <p className="p-5 text-sm text-slate-500">No interviews scheduled.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.map((i) => (
            <li key={i.id} className="px-5 py-3 text-sm">
              <p className="font-semibold">{formatDateTime(i.scheduled_at)}</p>
              <p className="text-slate-600">{i.vacancy_title || i.application_no} &middot; {i.location}</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function AdminDashboard({ d }) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Registered users" value={d.total_users} tone="brand" />
        <StatCard label="Job seekers" value={d.users_by_role.applicant} />
        <StatCard label="Published vacancies" value={d.vacancies_by_status.published} tone="green" />
        <StatCard label="Total applications" value={d.total_applications} tone="gold" />
        <StatCard label="Pending approval" value={d.vacancies_by_status.pending_approval} hint="Vacancies waiting for approval" />
        <StatCard label="Closed vacancies" value={d.vacancies_by_status.closed} />
        <StatCard label="HR officers" value={d.users_by_role.hr_officer} />
        <StatCard label="Department Heads" value={d.users_by_role.department_head} />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card><CardHeader title="Applications by status" /><div className="p-4"><BarByStatus counts={d.applications_by_status} title="Applications by status" /></div></Card>
        <Card><CardHeader title="Vacancies by status" /><div className="p-4"><Donut counts={d.vacancies_by_status} title="Vacancies by status" /></div></Card>
        <Card className="lg:col-span-2"><CardHeader title="Applications per month" /><div className="p-4"><MonthlyBars rows={d.monthly_applications} /></div></Card>
      </div>
      <Card className="mt-6">
        <CardHeader title="Recent system activity" action={<Link to="/portal/audit" className="text-sm font-semibold">Audit logs</Link>} />
        <Table headers={['Time', 'User', 'Action', 'Record']} caption="Recent activity">
          {d.recent_activity.map((r) => (
            <tr key={r.id}>
              <td className="px-4 py-3 whitespace-nowrap">{formatDateTime(r.created_at)}</td>
              <td className="px-4 py-3">{r.user_name || 'System / anonymous'}</td>
              <td className="px-4 py-3">{r.action}</td>
              <td className="px-4 py-3">{r.entity_type}{r.entity_id ? ` #${r.entity_id}` : ''}</td>
            </tr>
          ))}
        </Table>
        {d.recent_activity.length === 0 && <p className="p-5 text-sm text-slate-500">No activity recorded yet.</p>}
      </Card>
    </>
  );
}

function HrDashboard({ d }) {
  const a = d.applications_by_status;
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Pending applications" value={d.pending_applications} tone="gold" hint="Submitted, not yet reviewed" />
        <StatCard label="Under review" value={a.under_review} tone="brand" />
        <StatCard label="Shortlisted" value={a.shortlisted} tone="green" />
        <StatCard label="Rejected" value={a.rejected} tone="red" />
        <StatCard label="Interviews scheduled" value={a.interview_scheduled} />
        <StatCard label="Completed interviews" value={d.completed_interviews} />
        <StatCard label="Published vacancies" value={d.vacancies_by_status.published} />
        <StatCard label="Draft / pending vacancies" value={sum(d.vacancies_by_status, ['draft', 'pending_approval'])} />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card><CardHeader title="Recruitment stages" /><div className="p-4"><BarByStatus counts={a} title="Applications by recruitment stage" /></div></Card>
        <Card><CardHeader title="Applications per month" /><div className="p-4"><MonthlyBars rows={d.monthly_applications} /></div></Card>
      </div>
      <div className="mt-6"><UpcomingInterviews items={d.upcoming_interviews} /></div>
    </>
  );
}

function DepartmentHeadDashboard({ d }) {
  const a = d.assigned_by_status;
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Assigned applications" value={d.assigned_total} tone="brand" />
        <StatCard label="Awaiting my evaluation" value={d.pending_evaluations} tone="gold" />
        <StatCard label="Shortlisted" value={a.shortlisted} />
        <StatCard label="Interviews scheduled" value={a.interview_scheduled} />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card><CardHeader title="Applications of my department by status" /><div className="p-4"><BarByStatus counts={a} title="Applications by status" /></div></Card>
        <UpcomingInterviews items={d.upcoming_interviews} />
      </div>
      <p className="mt-6"><Link to="/portal/manage/applications" className="btn btn-primary">Open applications</Link></p>
    </>
  );
}

function ApplicantDashboard({ d }) {
  const a = d.applications_by_status;
  return (
    <>
      <Card className="mb-6 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-semibold">Profile completion: {d.profile_completion_percent}%</p>
            <p className="text-sm text-slate-600">A complete profile helps reviewers evaluate your application.</p>
          </div>
          <Link to="/portal/profile" className="btn btn-secondary btn-sm">Update profile</Link>
        </div>
        <div className="mt-3"><Progress percent={d.profile_completion_percent} /></div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Applications" value={d.total_applications} tone="brand" />
        <StatCard label="Pending" value={sum(a, ['submitted', 'under_review', 'screened'])} hint="Submitted, in review or screened" />
        <StatCard label="Shortlisted" value={a.shortlisted} tone="green" />
        <StatCard label="Interview invitations" value={a.interview_scheduled} tone="gold" />
        <StatCard label="Selected" value={a.selected} tone="green" />
        <StatCard label="Rejected" value={a.rejected} tone="red" />
        <StatCard label="Open vacancies" value={d.open_vacancies} />
        <StatCard label="Unread notifications" value={d.unread_notifications} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Recently published vacancies" action={<Link to="/vacancies" className="text-sm font-semibold">Browse all</Link>} />
          {d.recent_vacancies.length === 0 ? (
            <p className="p-5 text-sm text-slate-500">No open vacancies right now.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {d.recent_vacancies.map((v) => (
                <li key={v.id} className="px-5 py-3 text-sm">
                  <Link to={`/vacancies/${v.id}`} className="font-semibold">{v.title}</Link>
                  <p className="text-slate-600">{v.department} &middot; deadline {formatDate(v.deadline_at)}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <UpcomingInterviews items={d.upcoming_interviews} />
      </div>
    </>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useApi('/dashboard');

  let body;
  if (loading) body = <PageLoader />;
  else if (error) body = <ErrorState message={error} onRetry={reload} />;
  else if (data.role === 'admin') body = <AdminDashboard d={data} />;
  else if (data.role === 'hr_officer') body = <HrDashboard d={data} />;
  else if (data.role === 'department_head') body = <DepartmentHeadDashboard d={data} />;
  else body = <ApplicantDashboard d={data} />;

  return (
    <>
      <PageHeader title={`Welcome, ${user.full_name}`} subtitle="Your dashboard shows live figures from the database." />
      {body}
    </>
  );
}
