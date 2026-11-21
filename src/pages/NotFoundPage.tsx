import { Link } from 'react-router-dom';
import { Logo } from '../components/Logo';

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 text-center dark:bg-slate-950">
      <Logo size="lg" />
      <p className="mt-8 text-6xl font-extrabold text-brand-600 dark:text-brand-400">404</p>
      <h1 className="mt-2 text-xl font-semibold text-slate-900 dark:text-white">
        We couldn&apos;t find that page
      </h1>
      <p className="mt-2 max-w-sm text-sm text-slate-500 dark:text-slate-400">
        The link may be broken, or the page may have moved. Head back to your workspace to continue.
      </p>
      <div className="mt-6 flex gap-2">
        <Link
          to="/app"
          className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-400"
        >
          Go to workspace
        </Link>
        <Link
          to="/"
          className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Home
        </Link>
      </div>
    </div>
  );
}
