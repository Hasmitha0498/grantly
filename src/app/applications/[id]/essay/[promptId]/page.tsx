import type { Metadata } from 'next';
import dynamic from 'next/dynamic';
import { LoadingState } from '@/components/ui/primitives';

export const metadata: Metadata = { title: 'Essay Studio' };

const EssayStudio = dynamic(() => import('@/components/essay/EssayStudio').then((m) => m.EssayStudio), {
  loading: () => <LoadingState label="Opening Essay Studio…" />,
});

export default async function EssayPage({ params }: { params: Promise<{ id: string; promptId: string }> }) {
  const { id, promptId } = await params;
  return <EssayStudio applicationId={decodeURIComponent(id)} promptId={decodeURIComponent(promptId)} />;
}
