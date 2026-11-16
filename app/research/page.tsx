import type { Metadata } from 'next';
import { ResearchDashboard } from '@/components/research-dashboard';
export const metadata: Metadata = {
  title: 'Private research dashboard · Suggestion Discovery Lab',
  robots: { index: false, follow: false },
};
export default function ResearchPage() {
  return <ResearchDashboard />;
}
