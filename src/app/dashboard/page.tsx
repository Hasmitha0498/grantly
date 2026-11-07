import type { Metadata } from 'next';
import { Dashboard } from '@/components/dashboard/Dashboard';

export const metadata: Metadata = { title: 'My funding home' };

export default function DashboardPage() {
  return <Dashboard />;
}
