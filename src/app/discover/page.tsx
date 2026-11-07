import type { Metadata } from 'next';
import { Suspense } from 'react';
import { DiscoverExplorer } from '@/components/discover/DiscoverExplorer';
import { LoadingState } from '@/components/ui/primitives';

export const metadata: Metadata = { title: 'Discover scholarships' };

export default function DiscoverPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading opportunities…" />}>
      <DiscoverExplorer />
    </Suspense>
  );
}
