'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Search, ChevronRight, Package } from 'lucide-react';
import { useCatalogo } from '@/components/data';
import { PageHeader, Spinner } from '@/components/ui';
import ProductCard from '@/components/ProductCard';
import ProductDetail from '@/components/ProductDetail';
import type { Producto } from '@/lib/types';

export default function Catalogo() {
  const { categorias, productos: todos, loading } = useCatalogo();
  const productos = todos.filter((p) => p.activo);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<Producto | null>(null);
  const res = useMemo(() => q.trim().length < 2 ? [] : productos.filter((p) => (p.nombre + ' ' + (p.codigo ?? '')).toLowerCase().includes(q.toLowerCase())), [q, productos]);

  return (
    <div>
      <PageHeader title="Catálogo" subtitle={`${productos.length} productos en ${categorias.length} categorías`} />
      <div className="relative mb-6">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <input className="input pl-10" placeholder="Buscar producto o código…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {loading ? <Spinner /> : q.trim().length >= 2 ? (
        res.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{res.map((p) => <ProductCard key={p.id} p={p} onOpen={() => setSel(p)} />)}</div>
          : <p className="py-10 text-center text-slate-500">No hay resultados para “{q}”.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {categorias.map((c, i) => {
            const n = productos.filter((p) => p.categoria_id === c.id).length;
            const img = productos.find((p) => p.categoria_id === c.id && p.imagen_url)?.imagen_url;
            return (
              <Link key={c.id} href={`/catalogo/${c.slug}`} className="card group flex items-center gap-4 p-4 transition hover:-translate-y-0.5 hover:shadow-md">
                <div className={`flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl ${i % 2 ? 'bg-royal-50 text-royal-600' : 'bg-royal-600 text-white'}`}>
                  {img ? <img src={img} alt="" className="h-full w-full object-cover" /> : <Package size={28} />}
                </div>
                <div className="min-w-0 flex-1"><p className="font-semibold">{c.nombre}</p><p className="truncate text-xs text-slate-500">{c.descripcion}</p><p className="mt-1 text-xs font-semibold text-royal-600">{n} productos</p></div>
                <ChevronRight className="text-slate-300 transition group-hover:translate-x-1 group-hover:text-royal-600" />
              </Link>
            );
          })}
        </div>
      )}
      <ProductDetail p={sel} onClose={() => setSel(null)} />
    </div>
  );
}
