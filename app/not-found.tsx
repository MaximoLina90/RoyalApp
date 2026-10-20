import Link from 'next/link';
export default function NotFound() {
  return <div className="flex min-h-screen flex-col items-center justify-center gap-3"><p className="text-5xl font-bold text-royal-600">404</p><p className="text-slate-500">Página no encontrada</p><Link href="/" className="btn-primary">Volver al inicio</Link></div>;
}
