import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="card mx-auto max-w-xl p-8 text-center">
      <h1 className="font-display text-2xl font-semibold">This page doesn’t exist.</h1>
      <p className="mt-2 text-muted">If you followed a link to an opportunity, we couldn’t find that opportunity.</p>
      <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
        <Link href="/dashboard" className="btn btn-primary">
          Go to Home
        </Link>
        <Link href="/discover" className="btn btn-secondary">
          Explore scholarships
        </Link>
      </div>
    </div>
  );
}
