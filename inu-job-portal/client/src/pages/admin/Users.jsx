import { useState } from 'react';
import api, { errorMessage, fieldErrors } from '../../api/client';
import useApi from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  Card, ConfirmDialog, EmptyState, ErrorState, Modal, PageHeader, PageLoader, Pagination, SelectField, Spinner, Table, TextField,
} from '../../components/ui';
import { ROLE_LABELS, formatDateTime } from '../../utils/format';

const STAFF_ROLES = ['admin', 'hr_officer', 'department_head'];
const EMPTY = { full_name: '', email: '', phone: '', password: '', role: 'hr_officer', department_id: '' };

function CreateUserModal({ onClose, onDone }) {
  const toast = useToast();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const lookups = useApi('/meta/lookups');
  const set = (f) => (e) => setForm((s) => ({ ...s, [f]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      await api.post('/users', { ...form, department_id: form.role === 'department_head' ? Number(form.department_id) || null : null });
      toast.success('Staff account created');
      onDone();
    } catch (err) {
      setErrors(fieldErrors(err));
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open title="Create staff account" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <TextField label="Full name" required value={form.full_name} onChange={set('full_name')} error={errors.full_name} />
        <TextField label="Email address" type="email" required value={form.email} onChange={set('email')} error={errors.email} />
        <TextField label="Phone (optional)" type="tel" value={form.phone} onChange={set('phone')} error={errors.phone} />
        <SelectField label="Role" value={form.role} onChange={set('role')} error={errors.role}>
          {STAFF_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
        </SelectField>
        {form.role === 'department_head' && (
          <SelectField label="Department" required value={form.department_id} onChange={set('department_id')} error={errors.department_id}>
            <option value="">Select...</option>
            {(lookups.data?.departments || []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </SelectField>
        )}
        <TextField label="Temporary password" type="password" required autoComplete="new-password" value={form.password} onChange={set('password')} error={errors.password} hint="Share it securely and ask the user to change it after the first login." />
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy && <Spinner className="h-4 w-4" />} Create account</button>
        </div>
      </form>
    </Modal>
  );
}

function ResetPasswordModal({ user, onClose, onDone }) {
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.post(`/users/${user.id}/reset-password`, { new_password: password });
      toast.success('Password reset');
      onDone();
    } catch (err) {
      setError(fieldErrors(err).new_password || errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open title={`Reset password for ${user.full_name}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <TextField label="New temporary password" type="password" required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} error={error} hint="At least 8 characters with uppercase, lowercase and a digit." />
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy || !password}>{busy && <Spinner className="h-4 w-4" />} Reset password</button>
        </div>
      </form>
    </Modal>
  );
}

export default function Users() {
  const { user: me } = useAuth();
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [role, setRole] = useState('');
  const [active, setActive] = useState('');
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [resetFor, setResetFor] = useState(null);
  const [toggleFor, setToggleFor] = useState(null);
  const [busy, setBusy] = useState(false);
  const { data, meta, loading, error, reload } = useApi('/users', { page, page_size: 10, role, is_active: active, q: search });
  const lookups = useApi('/meta/lookups');
  const departments = lookups.data?.departments || [];

  async function changeDepartment(u, value) {
    try {
      await api.patch(`/users/${u.id}`, { department_id: value ? Number(value) : null });
      toast.success(`Department of ${u.full_name} updated`);
    } catch (err) { toast.error(errorMessage(err)); }
    reload();
  }

  async function changeRole(u, newRole) {
    try {
      await api.patch(`/users/${u.id}`, { role: newRole });
      toast.success(`Role of ${u.full_name} changed`);
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
      reload();
    }
  }

  async function toggleActive() {
    setBusy(true);
    try {
      await api.patch(`/users/${toggleFor.id}`, { is_active: !toggleFor.is_active });
      toast.success(toggleFor.is_active ? 'Account deactivated' : 'Account activated');
      setToggleFor(null);
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
      setToggleFor(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Users and roles"
        subtitle="Create staff accounts, change roles, and activate or deactivate accounts."
        actions={<button type="button" className="btn btn-primary" onClick={() => setShowCreate(true)}>Create staff account</button>}
      />
      <form className="mb-4 grid gap-4 sm:grid-cols-4" onSubmit={(e) => { e.preventDefault(); setSearch(q.trim()); setPage(1); }} role="search">
        <TextField label="Search name or email" value={q} onChange={(e) => setQ(e.target.value)} />
        <SelectField label="Role" value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }}>
          <option value="">All roles</option>
          {Object.entries(ROLE_LABELS).map(([k, t]) => <option key={k} value={k}>{t}</option>)}
        </SelectField>
        <SelectField label="Account status" value={active} onChange={(e) => { setActive(e.target.value); setPage(1); }}>
          <option value="">All</option>
          <option value="1">Active</option>
          <option value="0">Deactivated</option>
        </SelectField>
        <div className="flex items-end"><button type="submit" className="btn btn-secondary">Search</button></div>
      </form>

      {loading ? (
        <PageLoader />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : data.length === 0 ? (
        <EmptyState title="No users found" message="Try changing the filters." />
      ) : (
        <>
          <Card>
            <Table headers={['Name', 'Email', 'Role', 'Department', 'Status', 'Last login', 'Actions']} caption="User accounts">
              {data.map((u) => {
                const self = u.id === me.id;
                const staff = STAFF_ROLES.includes(u.role);
                return (
                  <tr key={u.id}>
                    <td className="px-4 py-3 font-medium">{u.full_name}{self && <span className="ml-2 text-xs text-slate-500">(you)</span>}</td>
                    <td className="px-4 py-3">{u.email}</td>
                    <td className="px-4 py-3">
                      {staff ? (
                        <select
                          className="input py-1"
                          aria-label={`Role of ${u.full_name}`}
                          value={u.role}
                          disabled={self}
                          onChange={(e) => changeRole(u, e.target.value)}
                        >
                          {STAFF_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                        </select>
                      ) : ROLE_LABELS[u.role]}
                    </td>
                    <td className="px-4 py-3">
                      {staff ? (
                        <select className="input py-1" aria-label={`Department of ${u.full_name}`} value={u.department_id || ''} onChange={(e) => changeDepartment(u, e.target.value)}>
                          <option value="">None</option>
                          {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${u.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {u.is_active ? 'Active' : 'Deactivated'}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">{formatDateTime(u.last_login_at)}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <button type="button" className="btn btn-secondary btn-sm" disabled={self} onClick={() => setToggleFor(u)}>{u.is_active ? 'Deactivate' : 'Activate'}</button>
                      <button type="button" className="btn btn-ghost btn-sm ml-1" onClick={() => setResetFor(u)}>Reset password</button>
                    </td>
                  </tr>
                );
              })}
            </Table>
          </Card>
          <Pagination meta={meta} onChange={setPage} />
        </>
      )}

      {showCreate && <CreateUserModal onClose={() => setShowCreate(false)} onDone={() => { setShowCreate(false); reload(); }} />}
      {resetFor && <ResetPasswordModal user={resetFor} onClose={() => setResetFor(null)} onDone={() => setResetFor(null)} />}
      <ConfirmDialog
        open={Boolean(toggleFor)}
        title={toggleFor?.is_active ? 'Deactivate this account?' : 'Activate this account?'}
        message={toggleFor?.is_active ? `${toggleFor?.full_name} will no longer be able to log in.` : `${toggleFor?.full_name} will be able to log in again.`}
        confirmLabel={toggleFor?.is_active ? 'Deactivate' : 'Activate'}
        danger={Boolean(toggleFor?.is_active)}
        busy={busy}
        onConfirm={toggleActive}
        onCancel={() => setToggleFor(null)}
      />
    </>
  );
}
