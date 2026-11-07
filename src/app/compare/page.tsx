import type { Metadata } from 'next';
import { DecisionStudio } from '@/components/compare/DecisionStudio';

export const metadata: Metadata = { title: 'Decision Studio' };

export default function ComparePage() {
  return <DecisionStudio />;
}
