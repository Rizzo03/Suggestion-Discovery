import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Suggestion Discovery · Private research pilot',
  description:
    'Listen to personalised audio suggestions for physical pain or an uncomfortable body area, targeting sensory qualities and emotional response. Private pilot, not treatment.',
  robots: { index: false, follow: false },
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
