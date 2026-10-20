'use client';
import { Package, Plus } from 'lucide-react';
import type { Producto } from '@/lib/types';
import { pesos } from '@/lib/format';
import { Modal } from './ui';
import { useCart } from './CartProvider';

export default function ProductDetail({ p, onClose }: { p: Producto | null; onClose: () => void }) {
  const { add } = useCart();
  if (!p) return null;
  return (
    <Modal open={!!p} onClose={onClose} title={p.nombre} wide>
      <div className="grid gap-5 md:grid-cols-2">
        <div className="aspect-square overflow-hidden rounded-2xl bg-gradient-to-br from-royal-50 to-slate-100">
          {p.imagen_url ? <img src={p.imagen_url} alt={p.nombre} className="h-full w-full object-contain" /> : <div className="flex h-full items-center justify-center text-royal-200"><Package size={80} /></div>}
        </div>
        <div className="flex flex-col">
          {p.codigo && <p className="text-xs font-semibold text-slate-500">Código {p.codigo}</p>}
          <p className="mt-1 text-3xl font-bold text-royal-700">{p.precio > 0 ? pesos(p.precio) : 'Sin precio'}</p>
          <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-slate-600">{p.descripcion || 'Sin descripción.'}</p>
          <button className="btn-primary mt-6 md:mt-auto" onClick={() => { add(p); onClose(); }}><Plus size={18} /> Agregar al cotizador</button>
        </div>
      </div>
    </Modal>
  );
}
