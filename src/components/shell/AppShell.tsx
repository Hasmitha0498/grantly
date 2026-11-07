import Link from 'next/link';
import { NavLinks } from './NavLinks';
import { ModeIndicator } from './ModeIndicator';

export function Wordmark() {
  return (
    <span className="font-display text-xl font-semibold tracking-tight text-forest">
      Grantly<span aria-hidden="true" className="text-accent">.</span>
    </span>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh md:flex">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:shadow"
      >
        Skip to content
      </a>

      {/* Desktop rail */}
      <header className="hidden md:flex md:w-60 md:shrink-0 md:flex-col md:border-r md:border-line md:bg-surface">
        <div className="sticky top-0 flex h-dvh flex-col gap-6 p-5">
          <Link href="/" className="rounded-md px-2 py-1" aria-label="GRANTLY home">
            <Wordmark />
          </Link>
          <nav aria-label="Main">
            <NavLinks variant="rail" />
          </nav>
          <div className="mt-auto">
            <ModeIndicator />
          </div>
        </div>
      </header>

      {/* Mobile top bar */}
      <header className="flex items-center justify-between gap-3 border-b border-line bg-surface px-4 py-2 md:hidden">
        <Link href="/" className="rounded-md py-2" aria-label="GRANTLY home">
          <Wordmark />
        </Link>
        <NavLinks variant="profile" />
      </header>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="md:hidden">
          <ModeIndicator compact />
        </div>
        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-[1200px] flex-1 px-4 pb-28 pt-6 sm:px-6 md:pb-12 md:pt-10 lg:px-10">
          {children}
        </main>
      </div>

      {/* Mobile tab bar */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <NavLinks variant="tabs" />
      </nav>
    </div>
  );
}
