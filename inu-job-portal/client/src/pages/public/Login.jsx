import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { errorMessage } from '../../api/client';
import { Spinner, TextField } from '../../components/ui';
import GoogleButton from '../../components/GoogleButton';

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/portal';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (user) return <Navigate to={from} replace />;

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(email.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-14">
      <div className="card p-6 sm:p-8">
        <h1 className="text-2xl font-bold">Log in</h1>
        <p className="mt-1 text-sm text-slate-600">Access your Injibara University recruitment portal account (applicant or staff).</p>
        {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
        <form onSubmit={onSubmit} className="mt-5 space-y-4" noValidate>
          <TextField label="Email address" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <TextField label="Password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          <button type="submit" className="btn btn-primary w-full" disabled={busy || !email || !password}>
            {busy && <Spinner className="h-4 w-4" />} Log in
          </button>
        </form>
        <GoogleButton onSuccess={() => navigate(from, { replace: true })} />
        <p className="mt-5 text-center text-sm text-slate-600">
          New applicant? <Link to="/register" className="font-semibold">Create an account</Link>
        </p>
      </div>
    </div>
  );
}
