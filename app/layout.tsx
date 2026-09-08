import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Cut — Your product. A fresh little video.',
  description:
    'Turn a product link into an eight-second vertical video with real visuals, bold captions, music, and a reaction GIF. Just start a conversation.',
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
