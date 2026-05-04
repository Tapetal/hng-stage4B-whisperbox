import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'WhisperBox — End-to-End Encrypted Messaging',
  description: 'Secure, private messaging. Your messages are encrypted before leaving your device.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
