'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Receipt, ChevronRight, Search } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';
import { PageHeader, Spinner, Empty } from '@/components/ui';
import { pesos, fechaCorta } from '@/lib/format';
import type { Pedido } from '@/lib/types';

export default function Ventas() {
  const { profile } = useAuth();
  const [pedidos, setPedidos] = useState<Pedido[] | null>(null);
  const [q, setQ] = useState('');
  useEffect(() => {
    supabase.from('pedidos').select('*').eq('usuario_id', profile!.id).order('created_at', { ascending: false }).then(({ data }) => setPedidos((data as Pedido[]) ?? []));
  }, [profile]);
  const lista = useMemo(() => (pedidos ?? []).filter((p) => !q || (p.cliente ?? '').toLowerCase().includes(q.toLowerCase()) || String(p.numero) === q), [pedidos, q]);

  return (
    <div>
      <PageHeader title="Mis pedidos" subtitle="Historial de ventas confirmadas." action={<Link href="/estadisticas" className="btn-secondary">Ver estadísticas</Link>} />
      {pedidos === null ? <Spinner /> : pedidos.length === 0 ? (
        <Empty icon={<Receipt size={28} />} title="Todavía no tenés ventas" text="Cuando confirmes un pedido en el cotizador, aparece acá." action={<Link href="/cotizador" className="btn-primary">Ir al cotizador</Link>} />
      ) : (<>
        <div className="relative mb-4"><Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} /><input className="input pl-10" placeholder="Buscar por cliente o N°…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="card divide-y divide-slate-100">
          {lista.map((p) => (
            <Link key={p.id} href={`/ventas/${p.id}`} className="flex items-center gap-4 p-4 transition hover:bg-slate-50">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-royal-50 text-sm font-bold text-royal-700">#{p.numero}</div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{p.cliente || `Pedido ${p.numero}`}</p>
                <p className="text-xs text-slate-500">{fechaCorta(p.created_at)} · {p.items.length} productos · {p.pago === 'Contado' ? 'Contado' : `${p.cuotas} cuotas`}</p>
              </div>
              <p className="font-bold text-royal-700">{pesos(p.total)}</p>
              <ChevronRight size={18} className="text-slate-300" />
            </Link>
          ))}
        </div>
      </>)}
    </div>
  );
}
