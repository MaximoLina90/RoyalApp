'use client';
import { useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { supabase } from '@/lib/supabase';
import { pesos, MESES } from '@/lib/format';
import { Spinner } from '@/components/ui';

type V = { total: number; pago: string; created_at: string };
type Rango = 'mes' | 'seis' | 'total';
const DIA = 86400_000;
const corto = (v: number) => (v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${Math.round(v / 1e3)}k` : String(v));

/** Ventas de un vendedor para su ficha en Mi red. */
export default function VentasVendedor({ uid }: { uid: string }) {
  const [ventas, setVentas] = useState<V[] | null>(null);
  const [rango, setRango] = useState<Rango>('seis');
  useEffect(() => {
    setVentas(null);
    supabase.from('ventas_red').select('total, pago, created_at').eq('usuario_id', uid).then(({ data }) => setVentas((data as V[]) ?? []));
  }, [uid]);

  const d = useMemo(() => {
    if (!ventas) return null;
    const now = new Date(); const t = now.getTime();
    const ini6 = new Date(now.getFullYear(), now.getMonth() - 5, 1).getTime();
    const sum = (xs: V[]) => ({ cant: xs.length, monto: xs.reduce((s, v) => s + Number(v.total), 0) });
    const mes = ventas.filter((v) => t - new Date(v.created_at).getTime() <= 30 * DIA);
    const seis = ventas.filter((v) => new Date(v.created_at).getTime() >= ini6);
    let chart: { n: string; v: number; k?: string }[];
    if (rango === 'mes') {
      chart = Array.from({ length: 30 }, (_, i) => { const f = new Date(t - (29 - i) * DIA); return { n: `${f.getDate()}/${f.getMonth() + 1}`, v: 0, k: f.toDateString() }; });
      mes.forEach((v) => { const c = chart.find((x) => x.k === new Date(v.created_at).toDateString()); if (c) c.v += Number(v.total); });
    } else if (rango === 'seis') {
      chart = Array.from({ length: 6 }, (_, i) => { const f = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1); return { n: MESES[f.getMonth()].slice(0, 3), v: 0 }; });
      seis.forEach((v) => { const f = new Date(v.created_at); const i = (f.getFullYear() - now.getFullYear()) * 12 + f.getMonth() - now.getMonth() + 5; if (i >= 0 && i < 6) chart[i].v += Number(v.total); });
    } else {
      const m = new Map<string, number>();
      [...ventas].sort((a, b) => a.created_at.localeCompare(b.created_at)).forEach((v) => { const f = new Date(v.created_at); const k = `${MESES[f.getMonth()].slice(0, 3)} ${String(f.getFullYear()).slice(2)}`; m.set(k, (m.get(k) ?? 0) + Number(v.total)); });
      chart = [...m.entries()].map(([n, v]) => ({ n, v }));
    }
    return { mes: sum(mes), seis: sum(seis), total: sum(ventas), chart };
  }, [ventas, rango]);

  if (!d) return <Spinner />;
  const tarjetas: [string, { cant: number; monto: number }][] = [['Último mes', d.mes], ['Últimos 6 meses', d.seis], ['Total', d.total]];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        {tarjetas.map(([l, s]) => (
          <div key={l} className="rounded-xl bg-white p-3">
            <p className="text-[11px] font-semibold uppercase text-slate-500">{l}</p>
            <p className="mt-0.5 text-base font-extrabold text-royal-900 md:text-lg">{s.monto ? pesos(s.monto) : '—'}</p>
            <p className="text-xs text-slate-500">{s.cant} {s.cant === 1 ? 'venta' : 'ventas'}</p>
          </div>
        ))}
      </div>
      <div className="rounded-xl bg-white p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-sm font-bold text-royal-900">Ventas {rango === 'mes' ? 'por día' : 'por mes'}</p>
          <div className="flex gap-1 rounded-lg bg-slate-100 p-0.5 text-xs">
            {([['mes', '30 días'], ['seis', '6 meses'], ['total', 'Total']] as [Rango, string][]).map(([k, l]) => <button key={k} className={`rounded-md px-2 py-1 font-semibold ${rango === k ? 'bg-white text-royal-700 shadow-sm' : 'text-slate-500'}`} onClick={() => setRango(k)}>{l}</button>)}
          </div>
        </div>
        {d.total.cant === 0 ? <p className="py-8 text-center text-sm text-slate-500">Todavía no registró ventas.</p> : (
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={d.chart} margin={{ left: -14, right: 4 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="n" tick={{ fontSize: 10, fill: '#64748b' }} interval={rango === 'mes' ? 4 : 0} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={corto} />
                <Tooltip formatter={(v: number) => [pesos(v), 'Ventas']} cursor={{ fill: '#eef5fc' }} contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0' }} />
                <Bar dataKey="v" fill="#004a90" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
