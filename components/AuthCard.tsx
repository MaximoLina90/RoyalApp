import Image from 'next/image';
import { ReactNode } from 'react';
export default function AuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <div className="relative hidden flex-1 flex-col justify-between overflow-hidden bg-gradient-to-br from-royal-600 via-royal-700 to-royal-900 p-12 text-white lg:flex">
        <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-white/5" />
        <div className="absolute -bottom-40 -left-20 h-[28rem] w-[28rem] rounded-full bg-white/5" />
        <div className="relative flex items-center gap-3"><div className="rounded-full bg-white p-1"><Image src="/icon.png" alt="" width={44} height={44} /></div><span className="text-xl font-bold">Royal App</span></div>
        <div className="relative max-w-md">
          <h2 className="text-4xl font-bold leading-tight">Tu catálogo, tus cotizaciones y tu agenda, en un solo lugar.</h2>
          <p className="mt-4 text-royal-100">Herramienta para el equipo de ventas Royal Prestige®: cotizá en cuotas al instante, registrá cada venta y seguí tus resultados.</p>
        </div>
        <p className="relative text-xs text-royal-100/70">Royal Prestige® es marca registrada de sus respectivos dueños.</p>
      </div>
      <div className="flex flex-1 items-center justify-center bg-white px-6 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex justify-center lg:hidden"><Image src="/logo.png" alt="Royal Prestige" width={150} height={150} priority /></div>
          <h1 className="text-2xl font-bold text-royal-900">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </div>
  );
}
