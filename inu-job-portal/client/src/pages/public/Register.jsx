import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { errorMessage, fieldErrors } from '../../api/client';
import { Spinner, TextField } from '../../components/ui';
import GoogleButton from '../../components/GoogleButton';

export default function Register() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', password: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/portal" replace />;

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) {
      setErrors({ confirm: 'Passwords do not match' });
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      await register({ full_name: form.full_name, email: form.email, phone: form.phone, password: form.password });
      navigate('/portal/profile', { replace: true });
    } catch (err) {
      setErrors(fieldErrors(err));
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <div className="card p-6 sm:p-8">
        <h1 className="text-2xl font-bold">Create an applicant account</h1>
        <p className="mt-1 text-sm text-slate-600">Staff accounts are created by the system administrator.</p>
        {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
        <form onSubmit={onSubmit} className="mt-5 space-y-4" noValidate>
          <TextField label="Full name" required autoComplete="name" value={form.full_name} onChange={set('full_name')} error={errors.full_name} />
          <TextField label="Email address" type="email" required autoComplete="email" value={form.email} onChange={set('email')} error={errors.email} />
          <TextField label="Phone (optional)" type="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} error={errors.phone} />
          <TextField
            label="Password" type="password" required autoComplete="new-password" value={form.password} onChange={set('password')} error={errors.password}
            hint="At least 8 characters with an uppercase letter, a lowercase letter and a digit."
          />
          <TextField label="Confirm password" type="password" required autoComplete="new-password" value={form.confirm} onChange={set('confirm')} error={errors.confirm} />
          <button type="submit" className="btn btn-primary w-full" disabled={busy}>
            {busy && <Spinner className="h-4 w-4" />} Create account
          </button>
        </form>
        <GoogleButton label="Sign up with Google" onSuccess={() => navigate('/portal/profile', { replace: true })} />
        <p className="mt-5 text-center text-sm text-slate-600">
          Already registered? <Link to="/login" className="font-semibold">Log in</Link>
        </p>
      </div>
    </div>
  );
}
