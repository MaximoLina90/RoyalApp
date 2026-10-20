'use client';
import { ReactNode, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-royal-900 md:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h); document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', h); document.body.style.overflow = ''; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 backdrop-blur-sm md:items-center md:p-6" onClick={onClose}>
      <div className={`flex max-h-[92vh] w-full flex-col rounded-t-3xl bg-white shadow-2xl md:rounded-3xl ${wide ? 'md:max-w-3xl' : 'md:max-w-lg'}`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-lg font-bold text-royal-900">{title}</h2>
          <button className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100" onClick={onClose} aria-label="Cerrar"><X size={20} /></button>
        </div>
        <div className="overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return <div className="flex items-center justify-center gap-2 py-16 text-slate-500"><Loader2 className="animate-spin" size={20} />{label ?? 'Cargando…'}</div>;
}

export function Empty({ icon, title, text, action }: { icon: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center px-6 py-12 text-center">
      <div className="mb-3 rounded-2xl bg-royal-50 p-4 text-royal-600">{icon}</div>
      <p className="font-semibold text-slate-800">{title}</p>
      {text && <p className="mt-1 max-w-sm text-sm text-slate-500">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Stat({ label, value, hint, icon }: { label: string; value: string; hint?: string; icon?: ReactNode }) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-500">{label}{icon}</div>
      <p className="mt-2 text-xl font-bold text-royal-900 md:text-2xl">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function Toast({ msg, kind = 'ok' }: { msg: string | null; kind?: 'ok' | 'error' }) {
  if (!msg) return null;
  return <div className={`fixed bottom-24 left-1/2 z-[60] -translate-x-1/2 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg md:bottom-8 ${kind === 'ok' ? 'bg-royal-900' : 'bg-coral-600'}`}>{msg}</div>;
}
