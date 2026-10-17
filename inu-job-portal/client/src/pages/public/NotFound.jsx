import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg px-4 py-24 text-center">
      <p className="text-5xl font-bold text-brand-700">404</p>
      <h1 className="mt-3 text-2xl font-bold">Page not found</h1>
      <p className="mt-2 text-slate-600">The page you are looking for does not exist or was moved.</p>
      <Link to="/" className="btn btn-primary mt-6">Go to home page</Link>
    </div>
  );
}
