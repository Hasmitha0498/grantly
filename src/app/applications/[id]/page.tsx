import type { Metadata } from 'next';
import { ApplicationWorkspace } from '@/components/apply/ApplicationWorkspace';

export const metadata: Metadata = { title: 'Application workspace' };

export default async function ApplicationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ApplicationWorkspace id={decodeURIComponent(id)} />;
}
