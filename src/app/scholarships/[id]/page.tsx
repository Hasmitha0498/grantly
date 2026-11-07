import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getScholarship, scholarships } from '@/data/demo-catalog';
import { FundingFitPanel } from '@/components/funding/FundingFitPanel';

export function generateStaticParams() {
  return scholarships.map((s) => ({ id: s.id }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const s = getScholarship(id);
  return { title: s ? s.title : 'Opportunity not found' };
}

export default async function ScholarshipPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scholarship = getScholarship(id);
  if (!scholarship) notFound();
  return (
    <div>
      <Link href="/discover" className="btn btn-ghost -ml-3 mb-4 min-h-10 px-3">
        <ArrowLeft aria-hidden="true" size={18} /> All opportunities
      </Link>
      <FundingFitPanel scholarshipId={scholarship.id} />
    </div>
  );
}
