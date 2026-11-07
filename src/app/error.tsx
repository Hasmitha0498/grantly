'use client';

import Link from 'next/link';

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert" className="card mx-auto max-w-xl p-8 text-center">
      <h1 className="font-display text-2xl font-semibold">Something didn’t load as expected.</h1>
      <p className="mt-2 text-muted">Your saved progress on this device hasn’t been changed.</p>
      <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
        <button type="button" className="btn btn-primary" onClick={() => reset()}>
          Try again
        </button>
        <Link href="/dashboard" className="btn btn-secondary">
          Back to Home
        </Link>
      </div>
    </div>
  );
}
