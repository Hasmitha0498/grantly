import type { Metadata, Viewport } from 'next';
import { AppShell } from '@/components/shell/AppShell';
import { ToastProvider } from '@/components/ui/Toast';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'GRANTLY — Find your funding', template: '%s · GRANTLY' },
  description:
    'Discover scholarships for your US master’s, understand what they really cover, and keep every application on track.',
};

export const viewport: Viewport = {
  themeColor: '#194D43',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ToastProvider>
          <AppShell>{children}</AppShell>
        </ToastProvider>
      </body>
    </html>
  );
}
