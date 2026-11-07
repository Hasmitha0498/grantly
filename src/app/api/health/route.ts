import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** Health probe. Exposes no keys or session metadata. */
export function GET() {
  const cloudConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  return NextResponse.json(
    { ok: true, data: { service: 'grantly', cloudConfigured, persistence: 'local-device' } },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
