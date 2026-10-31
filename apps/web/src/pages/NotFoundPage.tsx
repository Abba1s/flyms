import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-3 px-4">
      <h1 className="text-2xl font-bold">Page not found</h1>
      <p className="text-muted">This page doesn&apos;t exist or has moved.</p>
      <Link to="/" className="font-semibold text-primary hover:underline">
        Go to home
      </Link>
    </main>
  );
}
