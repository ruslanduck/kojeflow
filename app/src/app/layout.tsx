import type { Metadata } from 'next';
import { Suspense } from 'react';
import { IBM_Plex_Sans, Poppins } from 'next/font/google';
import './globals.css';
import { AppShell } from '@/components/shell/AppShell';

const ibmPlexSans = IBM_Plex_Sans({
  variable: '--font-ibm-plex-sans',
  subsets: ['latin'],
  weight: ['500', '600', '700'],
});

const poppins = Poppins({
  variable: '--font-poppins',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'Kojeflow',
  description: 'Bed-level hostel operations — properties, bookings, check-in, finance.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${ibmPlexSans.variable} ${poppins.variable}`}>
      <body>
        <Suspense>
          <AppShell>{children}</AppShell>
        </Suspense>
      </body>
    </html>
  );
}
