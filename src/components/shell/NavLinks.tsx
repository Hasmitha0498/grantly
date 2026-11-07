'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Compass, FileText, Home, Scale, UserRound } from 'lucide-react';

const items = [
  { href: '/dashboard', label: 'Home', icon: Home },
  { href: '/discover', label: 'Discover', icon: Compass },
  { href: '/compare', label: 'Compare', icon: Scale },
  { href: '/applications', label: 'Applications', icon: FileText },
] as const;

function isActive(pathname: string, href: string) {
  if (href === '/discover') return pathname.startsWith('/discover') || pathname.startsWith('/scholarships');
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavLinks({ variant }: { variant: 'rail' | 'tabs' | 'profile' }) {
  const pathname = usePathname() ?? '/';

  if (variant === 'profile') {
    const active = pathname.startsWith('/profile');
    return (
      <Link
        href="/profile"
        aria-current={active ? 'page' : undefined}
        className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-forest hover:bg-mint"
      >
        <UserRound aria-hidden="true" size={18} />
        My profile
      </Link>
    );
  }

  if (variant === 'tabs') {
    return (
      <ul className="grid grid-cols-4">
        {items.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-[0.72rem] font-semibold ${
                  active ? 'text-forest' : 'text-muted'
                }`}
              >
                <Icon aria-hidden="true" size={20} strokeWidth={active ? 2.4 : 1.8} />
                {label}
                <span aria-hidden="true" className={`mt-0.5 h-0.5 w-6 rounded-full ${active ? 'bg-forest' : 'bg-transparent'}`} />
              </Link>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <ul className="flex flex-col gap-1">
      {[...items, { href: '/profile', label: 'My profile', icon: UserRound } as const].map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <li key={href} className={href === '/profile' ? 'mt-4 border-t border-line pt-4' : undefined}>
            <Link
              href={href}
              aria-current={active ? 'page' : undefined}
              className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-[0.95rem] font-semibold transition-colors ${
                active ? 'bg-mint text-forest' : 'text-muted hover:bg-canvas hover:text-ink'
              }`}
            >
              <Icon aria-hidden="true" size={19} />
              {label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
