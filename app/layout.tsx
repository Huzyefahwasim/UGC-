import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Cut — Your product. Their next obsession.',
  description:
    'Turn a product link into a short creator-style video with animated text, music and a GIF. Shape the direction and get the result in chat.',
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
