'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { TrendingUp, Trophy, Receipt, Wallet, Search, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';
import { PageHeader, Spinner, Stat } from '@/components/ui';
import { pesos, MESES } from '@/lib/format';
import { rama, esLider, etiquetaEquipo } from '@/lib/red';
import type { Nodo, VentaRed } from '@/lib/types';

type Rango = 'mes' | 'anio' | 'total';
type Alcance = 'mias' | 'red';

export default function Estadisticas() {
  const { profile } = useAuth();
  const [ventas, setVentas] = useState<VentaRed[] | null>(null);
  const [nodos, setNodos] = useState<Nodo[]>([]);
  const [rango, setRango] = useState<Rango>('mes');
  const [alcance, setAlcance] = useState<Alcance>('mias');
  const [equipo, setEquipo] = useState('');
  const [qVend, setQVend] = useState('');

  useEffect(() => {
    supabase.from('ventas_red').select('*').then(({ data }) => setVentas((data as VentaRed[]) ?? []));
    supabase.from('nodos').select('*').then(({ data }) => setNodos((data as Nodo[]) ?? []));
  }, []);

  const mio = profile?.codigo_vendedor ?? '';
  const esAdmin = profile?.rol === 'admin';
  const tieneRed = esAdmin || (mio && esLider(nodos, mio));
  const lideres = useMemo(() => nodos.filter((n) => esLider(nodos, n.codigo)).sort((a, b) => a.nombre.localeCompare(b.nombre)), [nodos]);

  const now = new Date();
  const datos = useMemo(() => {
    let ps = ventas ?? [];
    if (alcance === 'mias' || !tieneRed) ps = ps.filter((p) => p.usuario_id === profile?.id);
    else {
      if (equipo) { const r = rama(nodos, equipo); ps = ps.filter((p) => p.vendedor_codigo && r.has(p.vendedor_codigo)); }
      const t = qVend.trim().toLowerCase();
      if (t) ps = ps.filter((p) => p.vendedor_nombre.toLowerCase().includes(t) || (p.vendedor_codigo ?? '').toLowerCase().includes(t));
    }
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
    // rankings
    const porVend = new Map<string, { nombre: string; codigo: string; total: number; cant: number }>();
    const porEq = new Map<string, { nombre: string; total: number; cant: number }>();
    filtrados.forEach((p) => {
      const v = porVend.get(p.usuario_id) ?? { nombre: p.vendedor_nombre, codigo: p.vendedor_codigo ?? '', total: 0, cant: 0 };
      v.total += Number(p.total); v.cant++; porVend.set(p.usuario_id, v);
      const k = p.lider_codigo ?? '—';
      const eq = porEq.get(k) ?? { nombre: [p.equipo_numero ? `#${p.equipo_numero}` : null, p.equipo_nombre].filter(Boolean).join(' ') || `Equipo de ${p.lider_nombre ?? '—'}`, total: 0, cant: 0 };
      eq.total += Number(p.total); eq.cant++; porEq.set(k, eq);
    });
    return { cant: filtrados.length, total, mejor, prom: filtrados.length ? total / filtrados.length : 0, chart, contado,
      vendedores: [...porVend.values()].sort((a, b) => b.total - a.total), equipos: [...porEq.values()].sort((a, b) => b.total - a.total) };
  }, [ventas, rango, alcance, equipo, qVend, nodos, tieneRed, profile]); // eslint-disable-line react-hooks/exhaustive-deps

  const etiqueta = rango === 'mes' ? `${MESES[now.getMonth()]} ${now.getFullYear()}` : rango === 'anio' ? String(now.getFullYear()) : 'Histórico';
  const enRed = alcance === 'red' && tieneRed;

  return (
    <div>
      <PageHeader title="Estadísticas" subtitle={etiqueta} action={<Link href="/ventas" className="btn-secondary"><Receipt size={16} /> Ver pedidos</Link>} />
      <div className="mb-4 flex flex-wrap gap-3">
        {tieneRed && (
          <div className="flex gap-1 rounded-xl bg-slate-200/60 p-1">
            {([['mias', 'Mis ventas'], ['red', 'Mi red']] as [Alcance, string][]).map(([k, l]) => <button key={k} className={`seg ${alcance === k ? 'seg-on' : 'seg-off'}`} onClick={() => setAlcance(k)}>{l}</button>)}
          </div>
        )}
        <div className="flex gap-1 rounded-xl bg-slate-200/60 p-1">
          {([['mes', 'Mensual'], ['anio', 'Anual'], ['total', 'Total']] as [Rango, string][]).map(([k, l]) => <button key={k} className={`seg ${rango === k ? 'seg-on' : 'seg-off'}`} onClick={() => setRango(k)}>{l}</button>)}
        </div>
      </div>
      {enRed && (
        <div className="mb-5 flex flex-col gap-3 md:flex-row">
          <select className="input md:w-80" value={equipo} onChange={(e) => setEquipo(e.target.value)}>
            <option value="">Toda mi red</option>
            {lideres.map((l) => <option key={l.codigo} value={l.codigo}>{etiquetaEquipo(l) ?? `Equipo de ${l.nombre}`} · {l.codigo}</option>)}
          </select>
          <div className="relative flex-1"><Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input pl-10" placeholder="Filtrar por nro o nombre de vendedor…" value={qVend} onChange={(e) => setQVend(e.target.value)} /></div>
        </div>
      )}
      {ventas === null ? <Spinner /> : (<>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Ventas" value={datos.total ? pesos(datos.total) : 'Sin ventas'} icon={<Wallet size={15} />} />
          <Stat label="Cantidad" value={String(datos.cant)} hint={datos.cant ? `${datos.contado} contado · ${datos.cant - datos.contado} financiado` : undefined} icon={<Receipt size={15} />} />
          <Stat label="Mejor venta" value={datos.mejor ? pesos(datos.mejor) : '—'} icon={<Trophy size={15} />} />
          <Stat label={enRed ? 'Vendedores activos' : 'Promedio'} value={enRed ? String(datos.vendedores.length) : datos.prom ? pesos(datos.prom) : '—'} icon={enRed ? <Users size={15} /> : <TrendingUp size={15} />} />
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
        {enRed && (
          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            {[{ t: 'Ranking de vendedores', rows: datos.vendedores.map((v) => ({ k: v.codigo + v.nombre, a: v.nombre, b: v.codigo, total: v.total, cant: v.cant })) },
              { t: 'Ranking de equipos', rows: datos.equipos.map((e) => ({ k: e.nombre, a: e.nombre, b: '', total: e.total, cant: e.cant })) }].map((tb) => (
              <div key={tb.t} className="card overflow-hidden">
                <p className="border-b border-slate-100 p-4 font-bold text-royal-900">{tb.t}</p>
                {tb.rows.length === 0 ? <p className="p-6 text-center text-sm text-slate-500">Sin ventas en el período.</p> : (
                  <table className="w-full text-sm"><tbody className="divide-y divide-slate-100">
                    {tb.rows.slice(0, 20).map((r, i) => (
                      <tr key={r.k}><td className="w-10 p-3 text-center font-bold text-slate-400">{i + 1}</td>
                        <td className="p-3"><p className="font-medium">{r.a}</p>{r.b && <p className="font-mono text-xs text-royal-600">{r.b}</p>}</td>
                        <td className="p-3 text-right"><p className="font-semibold">{pesos(r.total)}</p><p className="text-xs text-slate-500">{r.cant} pedidos</p></td></tr>
                    ))}
                  </tbody></table>
                )}
              </div>
            ))}
          </div>
        )}
      </>)}
    </div>
  );
}
