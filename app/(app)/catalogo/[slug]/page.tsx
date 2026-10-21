'use client';
import Link from 'next/link';
import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useCatalogo } from '@/components/data';
import { PageHeader, Spinner } from '@/components/ui';
import ProductCard from '@/components/ProductCard';
import ProductDetail from '@/components/ProductDetail';
import type { Producto } from '@/lib/types';

export default function CategoriaPage({ params }: { params: { slug: string } }) {
  const { categorias, productos: todos, loading } = useCatalogo();
  const productos = todos.filter((p) => p.activo);
  const [sel, setSel] = useState<Producto | null>(null);
  const cat = categorias.find((c) => c.slug === params.slug);
  const lista = productos.filter((p) => p.categoria_id === cat?.id);
  return (
    <div>
      <Link href="/catalogo" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-royal-600"><ArrowLeft size={16} /> Catálogo</Link>
      {loading ? <Spinner /> : !cat ? <p>Categoría no encontrada.</p> : (
        <>
          <PageHeader title={cat.nombre} subtitle={cat.descripcion ?? undefined} />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{lista.map((p) => <ProductCard key={p.id} p={p} onOpen={() => setSel(p)} />)}</div>
        </>
      )}
      <ProductDetail p={sel} onClose={() => setSel(null)} />
    </div>
  );
}
