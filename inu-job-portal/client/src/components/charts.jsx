import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { statusLabel } from '../utils/format';

const COLORS = ['#245a91', '#e19d12', '#2f9e6e', '#c2410c', '#7c5cbf', '#0e8aa6', '#b4375a', '#64748b', '#3f7d20'];

/** {submitted: 3, rejected: 1} -> [{name:'Submitted', value:3}, ...] */
export const toData = (counts) =>
  Object.entries(counts || {}).map(([key, value]) => ({ key, name: statusLabel(key), value: Number(value) }));

export function BarByStatus({ counts, height = 280, title = 'Bar chart' }) {
  const data = toData(counts);
  return (
    <div style={{ height }} role="img" aria-label={title}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" allowDecimals={false} />
          <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 12 }} />
          <Tooltip />
          <Bar dataKey="value" name="Total" fill="#245a91" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Donut({ counts, height = 280, title = 'Pie chart' }) {
  const data = toData(counts).filter((d) => d.value > 0);
  if (data.length === 0) return <p className="py-10 text-center text-sm text-slate-500">No data yet.</p>;
  return (
    <div style={{ height }} role="img" aria-label={title}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
            {data.map((d, i) => <Cell key={d.key} fill={COLORS[i % COLORS.length]} />)}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MonthlyBars({ rows, height = 280 }) {
  const data = (rows || []).map((r) => ({ month: r.month, total: Number(r.total) }));
  if (data.length === 0) return <p className="py-10 text-center text-sm text-slate-500">No applications in the last 12 months.</p>;
  return (
    <div style={{ height }} role="img" aria-label="Applications per month">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ left: 0, right: 8 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 12 }} />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="total" name="Applications" fill="#e19d12" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
