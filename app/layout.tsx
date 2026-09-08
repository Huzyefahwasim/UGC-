import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Cut — Your product. Their next obsession.',
  description:
    'Turn a product link into an eight-second creator-style video with Higgsfield. Describe your product, shape the direction, and get the result in chat.',
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
