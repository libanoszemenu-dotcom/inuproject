import useApi from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { BarByStatus, Donut, MonthlyBars } from '../../components/charts';
import { Card, CardHeader, ErrorState, PageHeader, PageLoader, StatusBadge, Table } from '../../components/ui';
import { formatDateTime } from '../../utils/format';

function Section({ title, state, children }) {
  return (
    <Card>
      <CardHeader title={title} />
      {state.loading ? <PageLoader /> : state.error ? <div className="p-4"><ErrorState message={state.error} onRetry={state.reload} /></div> : <div className="p-4">{children}</div>}
    </Card>
  );
}

export default function Reports() {
  const { user } = useAuth();
  const byStatus = useApi('/reports/applications-by-status');
  const vacancies = useApi('/reports/vacancies-by-status');
  const monthly = useApi('/reports/monthly-applications');
  const outcomes = useApi('/reports/outcomes');
  const byVacancy = useApi('/reports/applications-by-vacancy');
  const interviews = useApi('/reports/interview-schedule');

  return (
    <>
      <PageHeader
        title="Reports and analytics"
        subtitle="All figures are calculated from database records."
        actions={
          <>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => window.print()}>Print</button>
            {user.role === 'hr_officer' && <a className="btn btn-primary btn-sm" href="/api/reports/applications.csv">Export applications (CSV)</a>}
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Applications by status" state={byStatus}>{byStatus.data && <BarByStatus counts={byStatus.data} title="Applications by status" />}</Section>
        <Section title="Vacancies by status" state={vacancies}>{vacancies.data && <Donut counts={vacancies.data} title="Vacancies by status" />}</Section>
        <Section title="Applications per month" state={monthly}>{monthly.data && <MonthlyBars rows={monthly.data} />}</Section>
        <Section title="Recruitment outcomes" state={outcomes}>{outcomes.data && <Donut counts={outcomes.data} title="Recruitment outcomes" />}</Section>
      </div>

      <Card className="mt-6">
        <CardHeader title="Applications by vacancy" />
        {byVacancy.loading ? <PageLoader /> : byVacancy.error ? <div className="p-4"><ErrorState message={byVacancy.error} onRetry={byVacancy.reload} /></div> : (
          <Table headers={['Reference', 'Vacancy', 'Status', 'Applications']} caption="Applications by vacancy">
            {byVacancy.data.map((v) => (
              <tr key={v.id}>
                <td className="px-4 py-3">{v.reference_no}</td>
                <td className="px-4 py-3 font-medium">{v.title}</td>
                <td className="px-4 py-3"><StatusBadge status={v.status} /></td>
                <td className="px-4 py-3">{v.applications}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Card className="mt-6">
        <CardHeader title="Upcoming interview schedule" />
        {interviews.loading ? <PageLoader /> : interviews.error ? <div className="p-4"><ErrorState message={interviews.error} onRetry={interviews.reload} /></div> : interviews.data.length === 0 ? (
          <p className="p-5 text-sm text-slate-500">No upcoming interviews.</p>
        ) : (
          <Table headers={['When', 'Vacancy', 'Application', 'Where']} caption="Upcoming interviews">
            {interviews.data.map((i) => (
              <tr key={i.id}>
                <td className="whitespace-nowrap px-4 py-3 font-medium">{formatDateTime(i.scheduled_at)}</td>
                <td className="px-4 py-3">{i.vacancy_title}</td>
                <td className="px-4 py-3">{i.application_no}</td>
                <td className="px-4 py-3">{i.location}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}
