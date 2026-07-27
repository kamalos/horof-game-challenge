import { Cairo, Aref_Ruqaa } from 'next/font/google';
import './globals.css';

const cairo = Cairo({ subsets: ['arabic', 'latin'] });
const aref = Aref_Ruqaa({ subsets: ['arabic', 'latin'], weight: ['400', '700'], variable: '--font-aref' });

export const metadata = {
  title: 'حروف مع كمال - Beehive Game',
  description: 'Beehive trivia game',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ar">
      <body className={`${cairo.className} ${aref.variable}`}>{children}</body>
    </html>
  )
}
