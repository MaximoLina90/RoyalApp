'use client';
import { useEffect, useMemo, useState } from 'react';
import { Check, X, Star, ExternalLink, PlayCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Spinner } from './ui';
import type { Producto, ProductoMedio, EstadoMedio } from '@/lib/types';

const ETIQ: Record<EstadoMedio, string> = { revisar: 'Para revisar', verificada: 'Verificadas', aprobada: 'Aprobadas', rechazada: 'Rechazadas' };
const COLOR: Record<EstadoMedio, string> = { revisar: 'bg-amber-100 text-amber-800', verificada: 'bg-emerald-100 text-emerald-800', aprobada: 'bg-royal-50 text-royal-700', rechazada: 'bg-slate-200 text-slate-600' };

export default function RevisarMedios({ productos, onCambio, toast }: { productos: Producto[]; onCambio: () => void; toast: (m: string, k?: 'ok' | 'error') => void }) {
  const [medios, setMedios] = useState<ProductoMedio[] | null>(null);
  const [filtro, setFiltro] = useState<EstadoMedio>('revisar');
  const cargar = async () => {
    const { data } = await supabase.from('producto_medios').select('*').order('producto_id').order('orden');
    setMedios((data as ProductoMedio[]) ?? []);
  };
  useEffect(() => { cargar(); }, []);

  const conteo = useMemo(() => {
    const c: Record<string, number> = {};
    (medios ?? []).forEach((m) => { c[m.estado] = (c[m.estado] ?? 0) + 1; });
    return c;
  }, [medios]);
  const grupos = useMemo(() => {
    const g = new Map<number, ProductoMedio[]>();
    (medios ?? []).filter((m) => m.estado === filtro).forEach((m) => g.set(m.producto_id, [...(g.get(m.producto_id) ?? []), m]));
    return [...g.entries()];
  }, [medios, filtro]);
  const sinMedios = useMemo(() => {
    const con = new Set((medios ?? []).filter((m) => m.tipo === 'foto' && m.estado !== 'rechazada').map((m) => m.producto_id));
    return productos.filter((p) => p.activo && !con.has(p.id));
  }, [medios, productos]);

  const cambiar = async (ids: string[], estado: EstadoMedio) => {
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from('producto_medios').update({ estado, revisado_por: u.user?.id ?? null, revisado_at: new Date().toISOString() }).in('id', ids);
    if (error) return toast(error.message, 'error');
    setMedios((ms) => (ms ?? []).map((m) => (ids.includes(m.id) ? { ...m, estado } : m)));
    onCambio();
  };
  const principal = async (m: ProductoMedio) => {
    await supabase.from('producto_medios').update({ principal: false }).eq('producto_id', m.producto_id);
    const { error } = await supabase.from('producto_medios').update({ principal: true }).eq('id', m.id);
    if (error) return toast(error.message, 'error');
    setMedios((ms) => (ms ?? []).map((x) => (x.producto_id === m.producto_id ? { ...x, principal: x.id === m.id } : x)));
    toast('Foto principal actualizada'); onCambio();
  };

  if (!medios) return <Spinner />;
  const nombre = (id: number) => productos.find((p) => p.id === id);

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">Fotos y videos oficiales de royalprestige.com. Solo se muestran en el catálogo los <b>verificados</b> (con pruebas del tamaño o modelo) y los que vos <b>aprobás</b>.</p>
      <div className="flex flex-wrap gap-1.5">
        {(Object.keys(ETIQ) as EstadoMedio[]).map((e) => (
          <button key={e} onClick={() => setFiltro(e)} className={`chip px-3 py-1.5 ${filtro === e ? 'bg-royal-600 text-white' : 'bg-slate-100 text-slate-600'}`}>{ETIQ[e]} ({conteo[e] ?? 0})</button>
        ))}
      </div>
      {grupos.length === 0 && <p className="card p-6 text-center text-sm text-slate-500">No hay nada en esta lista.</p>}
      {grupos.map(([pid, ms]) => {
        const p = nombre(pid);
        const pendientes = ms.filter((m) => m.estado === 'revisar' || m.estado === 'verificada').map((m) => m.id);
        return (
          <div key={pid} className="card p-4">
            <div className="mb-1 flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{p?.nombre ?? `Producto ${pid}`}</p>
                {p?.codigo && <p className="text-xs text-slate-500">Código {p.codigo}</p>}
              </div>
              {filtro === 'revisar' && pendientes.length > 1 && (
                <div className="flex gap-2">
                  <button className="btn-secondary px-3 py-1.5 text-xs" onClick={() => cambiar(pendientes, 'aprobada')}><Check size={14} /> Aprobar todo</button>
                  <button className="btn-ghost px-3 py-1.5 text-xs" onClick={() => cambiar(pendientes, 'rechazada')}><X size={14} /> Rechazar todo</button>
                </div>
              )}
            </div>
            {ms[0]?.evidencia && <p className="mb-3 rounded-lg bg-slate-50 p-2.5 text-xs text-slate-600">{ms[0].evidencia}</p>}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {ms.map((m) => (
                <div key={m.id} className="overflow-hidden rounded-xl ring-1 ring-slate-200">
                  <div className="relative aspect-square bg-white">
                    {m.tipo === 'foto' && <img src={m.url} alt="" className="h-full w-full object-contain" loading="lazy" />}
                    {m.tipo === 'video' && <video src={m.url} controls preload="metadata" className="h-full w-full bg-black object-contain" />}
                    {m.tipo === 'youtube' && (
                      <a href={`https://www.youtube.com/watch?v=${m.url}`} target="_blank" rel="noreferrer" className="block h-full w-full">
                        <img src={`https://i.ytimg.com/vi/${m.url}/hqdefault.jpg`} alt="" className="h-full w-full object-cover" />
                        <PlayCircle className="absolute inset-0 m-auto text-white drop-shadow" size={44} />
                      </a>
                    )}
                    {m.principal && m.tipo === 'foto' && <span className="chip absolute left-1.5 top-1.5 bg-royal-600 text-white">Principal</span>}
                    <span className={`chip absolute right-1.5 top-1.5 ${COLOR[m.estado]}`}>{m.tipo === 'foto' ? 'Foto' : 'Video'}</span>
                  </div>
                  {m.evidencia && m.evidencia !== ms[0].evidencia && <p className="border-t border-slate-100 p-2 text-[11px] leading-snug text-amber-700">{m.evidencia}</p>}
                  <div className="flex items-center gap-1 border-t border-slate-100 p-1.5">
                    {m.estado !== 'aprobada' && m.estado !== 'verificada' && <button className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50" title="Aprobar" onClick={() => cambiar([m.id], 'aprobada')}><Check size={17} /></button>}
                    {m.estado !== 'rechazada' && <button className="rounded-lg p-1.5 text-coral-500 hover:bg-coral-500/10" title="Rechazar" onClick={() => cambiar([m.id], 'rechazada')}><X size={17} /></button>}
                    {m.estado === 'rechazada' && <button className="rounded-lg p-1.5 text-amber-600 hover:bg-amber-50" title="Volver a revisar" onClick={() => cambiar([m.id], 'revisar')}><Check size={17} /></button>}
                    {m.tipo === 'foto' && (m.estado === 'verificada' || m.estado === 'aprobada') && !m.principal && <button className="rounded-lg p-1.5 text-royal-600 hover:bg-royal-50" title="Usar como principal" onClick={() => principal(m)}><Star size={17} /></button>}
                    {m.pagina && <a href={m.pagina} target="_blank" rel="noreferrer" className="ml-auto rounded-lg p-1.5 text-slate-400 hover:text-royal-600" title="Ver ficha oficial"><ExternalLink size={15} /></a>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
      {filtro === 'revisar' && sinMedios.length > 0 && (
        <div className="card p-4">
          <p className="mb-2 font-semibold">Sin foto oficial encontrada ({sinMedios.length})</p>
          <p className="mb-3 text-xs text-slate-500">No aparecen en las fichas oficiales de Royal Prestige. Podés subir una foto desde la pestaña Productos.</p>
          <div className="flex flex-wrap gap-1.5">{sinMedios.map((p) => <span key={p.id} className="chip bg-slate-100 text-slate-600">{p.nombre}</span>)}</div>
        </div>
      )}
    </div>
  );
}
