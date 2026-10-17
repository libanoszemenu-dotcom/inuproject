import { useState } from 'react';
import api, { errorMessage, fieldErrors } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Card, CardHeader, PageHeader, Spinner, TextField } from '../../components/ui';
import { ROLE_LABELS } from '../../utils/format';

export default function Account() {
  const { user } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ current_password: '', new_password: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (f) => (e) => setForm((s) => ({ ...s, [f]: e.target.value }));

  async function onSubmit(e) {
    e.preventDefault();
    if (form.new_password !== form.confirm) { setErrors({ confirm: 'Passwords do not match' }); return; }
    setErrors({});
    setBusy(true);
    try {
      await api.post('/auth/change-password', { current_password: form.current_password, new_password: form.new_password });
      toast.success('Password changed successfully');
      setForm({ current_password: '', new_password: '', confirm: '' });
    } catch (err) {
      setErrors(fieldErrors(err));
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="Account" subtitle="Your sign-in details and password." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Sign-in details" />
          <dl className="space-y-3 p-5 text-sm">
            <div><dt className="text-slate-500">Name</dt><dd className="font-medium">{user.full_name}</dd></div>
            <div><dt className="text-slate-500">Email</dt><dd className="font-medium">{user.email}</dd></div>
            <div><dt className="text-slate-500">Account type</dt><dd className="font-medium">{ROLE_LABELS[user.role]}</dd></div>
          </dl>
        </Card>
        <Card>
          <CardHeader title="Change password" />
          <form onSubmit={onSubmit} className="space-y-4 p-5" noValidate>
            <TextField label="Current password" type="password" autoComplete="current-password" required value={form.current_password} onChange={set('current_password')} error={errors.current_password} />
            <TextField label="New password" type="password" autoComplete="new-password" required value={form.new_password} onChange={set('new_password')} error={errors.new_password} hint="At least 8 characters with uppercase, lowercase and a digit." />
            <TextField label="Confirm new password" type="password" autoComplete="new-password" required value={form.confirm} onChange={set('confirm')} error={errors.confirm} />
            <button type="submit" className="btn btn-primary" disabled={busy}>{busy && <Spinner className="h-4 w-4" />} Change password</button>
          </form>
        </Card>
      </div>
    </>
  );
}
