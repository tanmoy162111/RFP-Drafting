import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'RFP drafting review (mock data)',
  description: 'Review drafted RFP and security questionnaire answers. All data is synthetic.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <Link href="/" className="brand">
            RFP drafting review
          </Link>
          <span className="mock-pill">Mock data · nothing is sent anywhere</span>
        </header>
        <div className="page">{children}</div>
      </body>
    </html>
  );
}
