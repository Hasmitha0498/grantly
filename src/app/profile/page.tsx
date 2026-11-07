import type { Metadata } from 'next';
import { ProfileEditor } from '@/components/onboarding/ProfileEditor';

export const metadata: Metadata = { title: 'Your funding profile' };

export default function ProfilePage() {
  return <ProfileEditor />;
}
