'use client';
import { useEffect, useMemo, useState } from 'react';
import { Search, ChevronDown, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Spinner } from '@/components/ui';
import { rama, esLider, etiquetaEquipo } from '@/lib/red';
import type { Nodo, Profile, Video, CategoriaCap } from '@/lib/types';

type Visto = { usuario_id: string; video_id: string; visto_at: string };
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
const color = (p: number) => (p >= 70 ? 'bg-emerald-500' : p >= 30 ? 'bg-amber-400' : 'bg-coral-500');
const fecha = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) : '—');

function Barra({ p }: { p: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-full min-w-[60px] overflow-hidden rounded-full bg-slate-200"><div className={`h-full rounded-full ${color(p)}`} style={{ width: `${p}%` }} /></div>
      <span className="w-10 text-right text-sm font-bold text-royal-900">{p}%</span>
    </div>
  );
}

let cache: { videos: Video[]; cats: CategoriaCap[]; vistos: Visto[] } | null = null;
function useDatos() {
  const [d, setD] = useState(cache);
  useEffect(() => {
    Promise.all([
      supabase.from('capacitacion_videos').select('*').eq('activo', true),
      supabase.from('capacitacion_categorias').select('*').order('orden'),
      supabase.from('videos_vistos').select('usuario_id, video_id, visto_at').limit(50000),
    ]).then(([v, c, vv]) => { cache = { videos: (v.data as Video[]) ?? [], cats: (c.data as CategoriaCap[]) ?? [], vistos: (vv.data as Visto[]) ?? [] }; setD(cache); });
  }, []);
  return d;
}

function calcular(uid: string, d: NonNullable<typeof cache>) {
  const ids = new Set(d.videos.map((v) => v.id));
  const mios = d.vistos.filter((x) => x.usuario_id === uid && ids.has(x.video_id));
  const set = new Set(mios.map((x) => x.video_id));
  const porCat = new Map<string, { ok: number; total: number }>();
  d.videos.forEach((v) => { const k = v.categoria ?? ''; const s = porCat.get(k) ?? { ok: 0, total: 0 }; s.total++; if (set.has(v.id)) s.ok++; porCat.set(k, s); });
  const ultimo = mios.map((x) => x.visto_at).sort().pop();
  return { ok: set.size, total: d.videos.length, porCat, ultimo };
}

/** Avance por categoría de un vendedor (para el detalle en Mi red). */
export function CapacitacionVendedor({ uid }: { uid: string }) {
  const d = useDatos();
  if (!d) return <Spinner />;
  const r = calcular(uid, d);
  return (
    <div className="space-y-2">
      <Barra p={pct(r.ok, r.total)} />
      <p className="text-xs text-slate-500">{r.ok} de {r.total} completados · última actividad {fecha(r.ultimo)}</p>
      <div className="grid gap-1.5 pt-1 sm:grid-cols-2">
        {d.cats.filter((c) => r.porCat.get(c.slug)?.total).map((c) => { const s = r.porCat.get(c.slug)!; return (
          <div key={c.slug} className="text-xs"><p className="truncate text-slate-600">{c.emoji} {c.nombre} <span className="text-slate-400">{s.ok}/{s.total}</span></p><Barra p={pct(s.ok, s.total)} /></div>
        ); })}
      </div>
    </div>
  );
}

export default function CapacitacionRed({ nodos, perfiles, enRed, esAdmin, mio, onVer }: { nodos: Nodo[]; perfiles: Profile[]; enRed: Set<string>; esAdmin: boolean; mio: string | null; onVer: (n: Nodo) => void }) {
  const d = useDatos();
  const [equipo, setEquipo] = useState('');
  const [cat, setCat] = useState('');
  const [q, setQ] = useState('');
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set());

  const porCodigo = useMemo(() => new Map(nodos.map((n) => [n.codigo, n])), [nodos]);
  const perfilDe = useMemo(() => new Map(perfiles.filter((p) => p.codigo_vendedor).map((p) => [p.codigo_vendedor!, p])), [perfiles]);
  const lideres = useMemo(() => nodos.filter((n) => enRed.has(n.codigo) && esLider(nodos, n.codigo)), [nodos, enRed]);
  const fenix = d?.cats.find((c) => c.especial);

  // Filas: cada vendedor registrado de mi red (sin mí)
  const filas = useMemo(() => {
    if (!d) return [];
    return nodos.filter((n) => enRed.has(n.codigo) && n.codigo !== mio && perfilDe.has(n.codigo)).map((n) => {
      const p = perfilDe.get(n.codigo)!; const r = calcular(p.id, d);
      const lider = n.superior ? porCodigo.get(n.superior) : undefined;
      const fx = fenix ? r.porCat.get(fenix.slug) : undefined;
      return { n, p, r, total: pct(r.ok, r.total), enCat: cat ? pct(r.porCat.get(cat)?.ok ?? 0, r.porCat.get(cat)?.total ?? 0) : null, lider, graduado: !!fx && fx.total > 0 && fx.ok === fx.total };
    });
  }, [d, nodos, enRed, mio, perfilDe, porCodigo, fenix, cat]);

  if (!d) return <Spinner />;

  const ramaEq = equipo ? rama(nodos, equipo) : null;
  const t = q.trim().toLowerCase();
  const vis = filas.filter((f) => (!ramaEq || ramaEq.has(f.n.codigo)) && (!t || [f.n.codigo, f.n.nombre].some((x) => x.toLowerCase().includes(t))))
    .sort((a, b) => (b.enCat ?? b.total) - (a.enCat ?? a.total));
  const prom = vis.length ? Math.round(vis.reduce((s, f) => s + (f.enCat ?? f.total), 0) / vis.length) : 0;
  const sinEmpezar = vis.filter((f) => f.r.ok === 0).length;
  const graduados = vis.filter((f) => f.graduado).length;

  const equipos = lideres.map((l) => {
    const r = rama(nodos, l.codigo); const fs = filas.filter((f) => r.has(f.n.codigo) && f.n.codigo !== l.codigo);
    return { l, n: fs.length, p: fs.length ? Math.round(fs.reduce((s, f) => s + (f.enCat ?? f.total), 0) / fs.length) : 0 };
  }).filter((e) => e.n > 0 && e.l.codigo !== mio).sort((a, b) => b.p - a.p);

  // Por categoría para el grupo filtrado
  const catsGrupo = d.cats.map((c) => {
    const vals = vis.map((f) => f.r.porCat.get(c.slug)).filter((s): s is { ok: number; total: number } => !!s && s.total > 0);
    return { c, p: vals.length ? Math.round(vals.reduce((s, x) => s + pct(x.ok, x.total), 0) / vals.length) : 0, hay: vals.length > 0 };
  }).filter((x) => x.hay);

  const toggle = (c: string) => { const s = new Set(abiertos); s.has(c) ? s.delete(c) : s.add(c); setAbiertos(s); };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row">
        <div className="relative flex-1"><Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input pl-10" placeholder="Buscar vendedor por nombre o código…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <select className="input md:w-64" value={equipo} onChange={(e) => setEquipo(e.target.value)}>
          <option value="">Toda mi red</option>
          {lideres.map((l) => <option key={l.codigo} value={l.codigo}>{etiquetaEquipo(l) ?? `Equipo de ${l.nombre}`} · {l.codigo}</option>)}
        </select>
        <select className="input md:w-64" value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">Todas las categorías</option>
          {d.cats.map((c) => <option key={c.slug} value={c.slug}>{c.emoji} {c.nombre}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="card p-4"><p className="text-2xl font-extrabold text-royal-900">{prom}%</p><p className="text-xs text-slate-500">avance promedio{cat ? ' en la categoría' : ''}</p></div>
        <div className="card p-4"><p className="text-2xl font-extrabold text-royal-900">{vis.length}</p><p className="text-xs text-slate-500">vendedores</p></div>
        <div className="card p-4"><p className="text-2xl font-extrabold text-coral-600">{sinEmpezar}</p><p className="text-xs text-slate-500">sin empezar</p></div>
        <div className="card p-4"><p className="text-2xl font-extrabold text-amber-500">🏅 {graduados}</p><p className="text-xs text-slate-500">{fenix?.insignia ? `${fenix.insignia}s` : 'graduados'}</p></div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {equipos.length > 0 && (
          <div className="card p-4">
            <h3 className="mb-3 font-bold text-royal-900">Ranking de equipos</h3>
            <div className="space-y-2.5">
              {equipos.map((e, i) => (
                <button key={e.l.codigo} className="block w-full text-left" onClick={() => setEquipo(e.l.codigo)}>
                  <p className="text-sm text-slate-700"><span className="font-bold">{i + 1}.</span> {etiquetaEquipo(e.l) ?? `Equipo de ${e.l.nombre}`} <span className="text-xs text-slate-400">· {e.n} vend.</span></p>
                  <Barra p={e.p} />
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="card p-4">
          <h3 className="mb-3 font-bold text-royal-900">Avance por categoría{equipo ? ' del equipo' : ''}</h3>
          <div className="space-y-2">
            {catsGrupo.length === 0 && <p className="text-sm text-slate-500">Sin datos todavía.</p>}
            {catsGrupo.map(({ c, p }) => (
              <button key={c.slug} className="block w-full text-left" onClick={() => setCat(cat === c.slug ? '' : c.slug)}>
                <p className={`truncate text-sm ${cat === c.slug ? 'font-bold text-royal-700' : 'text-slate-700'}`}>{c.emoji} {c.nombre}</p><Barra p={p} />
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="card divide-y divide-slate-100 overflow-hidden">
        <div className="hidden grid-cols-[1.6fr_1fr_1.3fr_70px] gap-3 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase text-slate-500 md:grid">
          <span>Vendedor</span><span>Equipo</span><span>{cat ? 'Avance en categoría' : 'Avance total'}</span><span>Última</span>
        </div>
        {vis.length === 0 && <p className="p-6 text-center text-sm text-slate-500">No hay vendedores registrados en esta selección.</p>}
        {vis.map((f) => { const ab = abiertos.has(f.n.codigo); return (
          <div key={f.n.codigo}>
            <div className="grid cursor-pointer grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 hover:bg-slate-50 md:grid-cols-[1.6fr_1fr_1.3fr_70px]" onClick={() => toggle(f.n.codigo)}>
              <div className="flex min-w-0 items-center gap-2">
                {ab ? <ChevronDown size={16} className="shrink-0 text-slate-400" /> : <ChevronRight size={16} className="shrink-0 text-slate-400" />}
                <div className="min-w-0"><p className="truncate font-semibold text-royal-900">{f.n.nombre} {f.graduado && <span title={fenix?.insignia ?? ''}>🏅</span>}</p><p className="text-xs text-slate-500">{f.n.codigo} · {f.r.ok}/{f.r.total}</p></div>
              </div>
              <p className="hidden truncate text-sm text-slate-600 md:block">{f.lider ? (etiquetaEquipo(f.lider) ?? f.lider.nombre) : '—'}</p>
              <div className="col-span-2 md:col-span-1"><Barra p={f.enCat ?? f.total} /></div>
              <p className="hidden text-sm text-slate-500 md:block">{fecha(f.r.ultimo)}</p>
            </div>
            {ab && (
              <div className="bg-slate-50/70 px-4 pb-4 pt-1">
                <div className="grid gap-x-5 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-3">
                  {d.cats.filter((c) => f.r.porCat.get(c.slug)?.total).map((c) => { const s = f.r.porCat.get(c.slug)!; return (
                    <div key={c.slug} className="text-xs"><p className="truncate text-slate-600">{c.emoji} {c.nombre} <span className="text-slate-400">{s.ok}/{s.total}</span></p><Barra p={pct(s.ok, s.total)} /></div>
                  ); })}
                </div>
                <button className="btn-ghost mt-2 text-sm" onClick={() => onVer(f.n)}>Ver ficha del vendedor</button>
              </div>
            )}
          </div>
        ); })}
      </div>
    </div>
  );
}
