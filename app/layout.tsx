import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/components/AuthProvider';
import { CartProvider } from '@/components/CartProvider';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'Royal App · Ventas Royal Prestige',
  description: 'Catálogo, cotizador, ventas, agenda y estadísticas para vendedores Royal Prestige.',
  manifest: '/manifest.webmanifest',
};
export const viewport: Viewport = { themeColor: '#004a90', width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={inter.variable}>
      <body><AuthProvider><CartProvider>{children}</CartProvider></AuthProvider></body>
    </html>
  );
}
