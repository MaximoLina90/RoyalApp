'use client';
import { Plus, Check, Package } from 'lucide-react';
import { useState } from 'react';
import type { Producto } from '@/lib/types';
import { pesos } from '@/lib/format';
import { useCart } from './CartProvider';

export default function ProductCard({ p, onOpen }: { p: Producto; onOpen?: () => void }) {
  const { add } = useCart();
  const [ok, setOk] = useState(false);
  const agregar = (e: React.MouseEvent) => { e.stopPropagation(); add(p); setOk(true); setTimeout(() => setOk(false), 1200); };
  return (
    <div onClick={onOpen} className="card group flex cursor-pointer flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="relative aspect-[4/3] bg-gradient-to-br from-royal-50 to-slate-100">
        {p.imagen_url ? <img src={p.imagen_url} alt={p.nombre} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-royal-200"><Package size={48} /></div>}
        {p.codigo && <span className="absolute left-2 top-2 rounded-md bg-white/90 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">{p.codigo}</span>}
      </div>
      <div className="flex flex-1 flex-col p-3">
        <p className="line-clamp-2 text-sm font-semibold leading-snug text-slate-900">{p.nombre}</p>
        <div className="mt-auto flex items-center justify-between pt-3">
          <span className="font-bold text-royal-700">{p.precio > 0 ? pesos(p.precio) : <span className="text-xs font-medium text-slate-400">Sin precio</span>}</span>
          <button onClick={agregar} className={`rounded-full p-2 text-white transition ${ok ? 'bg-emerald-600' : 'bg-royal-600 hover:bg-royal-700'}`} aria-label="Agregar al cotizador">{ok ? <Check size={16} /> : <Plus size={16} />}</button>
        </div>
      </div>
    </div>
  );
}
