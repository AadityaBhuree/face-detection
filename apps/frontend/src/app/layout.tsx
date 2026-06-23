import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: {
    default: 'AyuTalk Care — Smart Clinic Intake',
    template: '%s | AyuTalk Care',
  },
  description:
    'AI-powered smart clinic intake system with face recognition and conversational voice intake',
  keywords: [
    'clinic',
    'intake',
    'AI',
    'face recognition',
    'healthcare',
    'telemedicine',
  ],
  authors: [{ name: 'AyuTalk Care' }],
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'AyuTalk Care',
  },
  formatDetection: {
    telephone: true,
    address: false,
    email: false,
  },
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    siteName: 'AyuTalk Care',
    title: 'AyuTalk Care — Smart Clinic Intake',
    description:
      'AI-powered smart clinic intake system with face recognition and conversational voice intake',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0c8ee6',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
      </head>
      <body className="min-h-screen bg-background font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
