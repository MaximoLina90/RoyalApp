'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { PageHeader, Spinner } from '@/components/ui';
import { pesos, fechaCorta } from '@/lib/format';
import type { Pedido } from '@/lib/types';

export default function DetallePedido({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [p, setP] = useState<Pedido | null | undefined>(undefined);
  useEffect(() => { supabase.from('pedidos').select('*').eq('id', params.id).maybeSingle().then(({ data }) => setP(data as Pedido | null)); }, [params.id]);
  const eliminar = async () => {
    if (!confirm('¿Deseás eliminar la venta? Se perderán todos los datos.')) return;
    await supabase.from('pedidos').delete().eq('id', params.id);
    router.replace('/ventas');
  };
  if (p === undefined) return <Spinner />;
  if (!p) return <p>Pedido no encontrado.</p>;
  const filas: [string, string][] = [
    ['Fecha', fechaCorta(p.created_at)], ['Forma de pago', p.pago],
    ['Entrega', p.pago === 'Contado' ? 'Contado' : `${pesos(p.entrega)} (${p.porcentaje_entrega}%)`],
    ['Cuotas', p.pago === 'Contado' ? '—' : String(p.cuotas)], ['Valor cuota', p.pago === 'Contado' ? '—' : pesos(p.cuota)],
  ];
  return (
    <div className="max-w-3xl">
      <Link href="/ventas" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-royal-600"><ArrowLeft size={16} /> Mis pedidos</Link>
      <PageHeader title={`Pedido #${p.numero}`} subtitle={p.cliente ?? undefined} action={<button className="btn-danger" onClick={eliminar}><Trash2 size={16} /> Eliminar</button>} />
      <div className="grid gap-4 md:grid-cols-[1fr_280px]">
        <div className="card divide-y divide-slate-100">
          {p.items.map((i) => (
            <div key={i.id} className="flex justify-between gap-3 p-4 text-sm"><span><span className="font-semibold text-royal-700">{i.cantidad}×</span> {i.nombre}</span><span className="font-medium">{pesos(i.precio * i.cantidad)}</span></div>
          ))}
          <div className="flex justify-between p-4 font-bold"><span>Total</span><span className="text-royal-700">{pesos(p.total)}</span></div>
        </div>
        <div className="card p-4"><dl className="space-y-3 text-sm">{filas.map(([k, v]) => <div key={k} className="flex justify-between"><dt className="text-slate-500">{k}</dt><dd className="font-semibold">{v}</dd></div>)}</dl></div>
      </div>
    </div>
  );
}
