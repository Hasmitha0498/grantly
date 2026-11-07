import type { Metadata } from 'next';
import { OnboardingStepper } from '@/components/onboarding/OnboardingStepper';

export const metadata: Metadata = { title: 'Create your funding profile' };

export default function OnboardingPage() {
  return <OnboardingStepper />;
}
