import type { Metadata } from 'next';
import { ApplicationsList } from '@/components/apply/ApplicationsList';

export const metadata: Metadata = { title: 'Applications' };

export default function ApplicationsPage() {
  return <ApplicationsList />;
}
