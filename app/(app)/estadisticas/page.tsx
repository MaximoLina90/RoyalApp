'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { TrendingUp, Trophy, Receipt, Wallet } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';
import { PageHeader, Spinner, Stat } from '@/components/ui';
import { pesos, MESES } from '@/lib/format';
import type { Pedido } from '@/lib/types';

type Rango = 'mes' | 'anio' | 'total';

export default function Estadisticas() {
  const { profile } = useAuth();
  const [pedidos, setPedidos] = useState<Pedido[] | null>(null);
  const [rango, setRango] = useState<Rango>('mes');
  useEffect(() => { supabase.from('pedidos').select('*').eq('usuario_id', profile!.id).then(({ data }) => setPedidos((data as Pedido[]) ?? [])); }, [profile]);

  const now = new Date();
  const datos = useMemo(() => {
    const ps = pedidos ?? [];
    const filtrados = ps.filter((p) => { const d = new Date(p.created_at); return rango === 'total' || (d.getFullYear() === now.getFullYear() && (rango === 'anio' || d.getMonth() === now.getMonth())); });
    const total = filtrados.reduce((s, p) => s + Number(p.total), 0);
    const mejor = filtrados.reduce((s, p) => Math.max(s, Number(p.total)), 0);
    let chart: { n: string; v: number }[];
    if (rango === 'mes') {
      const dias = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      chart = Array.from({ length: dias }, (_, i) => ({ n: String(i + 1), v: 0 }));
      filtrados.forEach((p) => { chart[new Date(p.created_at).getDate() - 1].v += Number(p.total); });
    } else if (rango === 'anio') {
      chart = MESES.map((m) => ({ n: m.slice(0, 3), v: 0 }));
      filtrados.forEach((p) => { chart[new Date(p.created_at).getMonth()].v += Number(p.total); });
    } else {
      const map = new Map<number, number>();
      filtrados.forEach((p) => { const y = new Date(p.created_at).getFullYear(); map.set(y, (map.get(y) ?? 0) + Number(p.total)); });
      chart = [...map.entries()].sort((a, b) => a[0] - b[0]).map(([y, v]) => ({ n: String(y), v }));
    }
    const contado = filtrados.filter((p) => p.pago === 'Contado').length;
    return { cant: filtrados.length, total, mejor, prom: filtrados.length ? total / filtrados.length : 0, chart, contado };
  }, [pedidos, rango]); // eslint-disable-line react-hooks/exhaustive-deps

  const etiqueta = rango === 'mes' ? `${MESES[now.getMonth()]} ${now.getFullYear()}` : rango === 'anio' ? String(now.getFullYear()) : 'Histórico';

  return (
    <div>
      <PageHeader title="Estadísticas" subtitle={etiqueta} action={<Link href="/ventas" className="btn-secondary"><Receipt size={16} /> Ver pedidos</Link>} />
      <div className="mb-5 flex max-w-sm gap-1 rounded-xl bg-slate-200/60 p-1">
        {([['mes', 'Mensual'], ['anio', 'Anual'], ['total', 'Total']] as [Rango, string][]).map(([k, l]) => <button key={k} className={`seg ${rango === k ? 'seg-on' : 'seg-off'}`} onClick={() => setRango(k)}>{l}</button>)}
      </div>
      {pedidos === null ? <Spinner /> : (<>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Ventas" value={datos.total ? pesos(datos.total) : 'Sin ventas'} icon={<Wallet size={15} />} />
          <Stat label="Cantidad" value={String(datos.cant)} hint={datos.cant ? `${datos.contado} contado · ${datos.cant - datos.contado} financiado` : undefined} icon={<Receipt size={15} />} />
          <Stat label="Mejor venta" value={datos.mejor ? pesos(datos.mejor) : '—'} icon={<Trophy size={15} />} />
          <Stat label="Promedio" value={datos.prom ? pesos(datos.prom) : '—'} icon={<TrendingUp size={15} />} />
        </div>
        <div className="card mt-5 p-4 md:p-6">
          <p className="mb-4 font-bold text-royal-900">Ventas {rango === 'mes' ? 'por día' : rango === 'anio' ? 'por mes' : 'por año'}</p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={datos.chart} margin={{ left: -10, right: 4 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="n" tick={{ fontSize: 11, fill: '#64748b' }} interval={rango === 'mes' ? 2 : 0} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(v) => (v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${Math.round(v / 1e3)}k` : String(v))} />
                <Tooltip formatter={(v: number) => [pesos(v), 'Ventas']} cursor={{ fill: '#eef5fc' }} contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0' }} />
                <Bar dataKey="v" fill="#004a90" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </>)}
    </div>
  );
}
