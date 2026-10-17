import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { PageLoader } from '../ui';

export function RequireAuth() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return <Outlet />;
}

export function RequireRole({ roles }) {
  const { user } = useAuth();
  if (!roles.includes(user.role)) {
    return (
      <div className="card mx-auto max-w-lg p-8 text-center">
        <h1 className="text-xl font-bold">Access denied</h1>
        <p className="mt-2 text-sm text-slate-600">Your account type is not allowed to open this page.</p>
        <Link to="/portal" className="btn btn-primary mt-5">Back to dashboard</Link>
      </div>
    );
  }
  return <Outlet />;
}
