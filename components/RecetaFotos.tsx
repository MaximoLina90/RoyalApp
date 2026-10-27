'use client';
import { useState } from 'react';
import { Expand } from 'lucide-react';
import { Visor, type Item } from '@/components/ProductDetail';

export default function RecetaFotos({ fotos, titulo }: { fotos: string[]; titulo: string }) {
  const [sel, setSel] = useState(0);
  const [visor, setVisor] = useState<number | null>(null);
  const items: Item[] = fotos.map((u, i) => ({ id: `f${i}`, tipo: 'foto', url: u }));
  if (!items.length) return null;
  return (
    <section>
      <button onClick={() => setVisor(sel)} className="group relative block aspect-[16/10] w-full cursor-zoom-in overflow-hidden rounded-2xl bg-slate-100">
        <img src={items[sel].url} alt={titulo} className="h-full w-full object-cover" />
        <span className="absolute bottom-2 right-2 rounded-full bg-black/50 p-1.5 text-white opacity-80 group-hover:opacity-100"><Expand size={16} /></span>
      </button>
      {items.length > 1 && (
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {items.map((f, i) => (
            <button key={f.id} onClick={() => setSel(i)} className={`h-14 w-14 shrink-0 overflow-hidden rounded-lg ring-2 ${i === sel ? 'ring-royal-600' : 'ring-transparent'}`}>
              <img src={f.url} alt="" className="h-full w-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      )}
      {visor !== null && <Visor items={items} inicio={visor} onClose={() => setVisor(null)} />}
    </section>
  );
}
