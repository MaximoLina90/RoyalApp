'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Target, Trophy, Trash2, Loader2, CalendarDays } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './AuthProvider';
import { Modal, Spinner, Toast, Empty } from './ui';
import { useToast } from './useToast';
import { pesos } from '@/lib/format';
import { esLider, etiquetaEquipo, rama } from '@/lib/red';
import { TIPOS, PREMIOS, CANTIDADES, PRESETS, tabla, puesto, medalla, emojiDe, pluralDe } from '@/lib/objetivos';
import type { Nodo, Objetivo, Posicion } from '@/lib/types';

const hoy = () => new Date().toISOString().slice(0, 10);
const finMes = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10); };
const inicioMes = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10); };
const fd = (s: string) => new Date(s + 'T12:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
const valorTxt = (o: Objetivo, v: number) => (o.metrica === 'mayor' ? (v ? pesos(v) : '—') : String(v));

export default function Objetivos() {
  const { profile } = useAuth();
  const toast = useToast();
  const [objs, setObjs] = useState<Objetivo[] | null>(null);
  const [tablas, setTablas] = useState<Record<string, Posicion[]>>({});
  const [nodos, setNodos] = useState<Nodo[]>([]);
  const [ver, setVer] = useState<Objetivo | null>(null);
  const [form, setForm] = useState<null | { modo: 'meta' | 'competencia'; preset: number; cantidad: number; tipo: string; premio: number; alcance: string; desde: string; hasta: string; titulo: string }>(null);
  const [busy, setBusy] = useState(false);
  const [verPasados, setVerPasados] = useState(false);

  const cargar = useCallback(async () => {
    const [{ data: o }, { data: n }] = await Promise.all([supabase.from('objetivos').select('*').order('hasta'), supabase.from('nodos').select('*')]);
    const lista = (o as Objetivo[]) ?? []; setObjs(lista); setNodos((n as Nodo[]) ?? []);
    const ts = await Promise.all(lista.map((x) => tabla(x.id)));
    setTablas(Object.fromEntries(lista.map((x, i) => [x.id, ts[i]])));
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const mio = profile?.codigo_vendedor ?? '';
  const esAdmin = profile?.rol === 'admin';
  const puedeCrear = esAdmin || (mio && esLider(nodos, mio));
  const alcances = useMemo(() => { const r = esAdmin ? null : rama(nodos, mio); return nodos.filter((n) => (!r || r.has(n.codigo)) && (n.codigo === mio || esLider(nodos, n.codigo))); }, [nodos, mio, esAdmin]);
  const visibles = (objs ?? []).filter((o) => verPasados ? o.hasta < hoy() : o.hasta >= hoy());

  const nuevo = () => setForm({ modo: 'meta', preset: 1, cantidad: 10, tipo: 'venta', premio: 5, alcance: mio || alcances[0]?.codigo || '', desde: inicioMes(), hasta: finMes(), titulo: '' });
  const crear = async (e: React.FormEvent) => {
    e.preventDefault(); if (!form) return; setBusy(true);
    const p = PRESETS[form.preset];
    const t = TIPOS.find((x) => x.k === form.tipo)!;
    const row = form.modo === 'meta'
      ? { modo: 'meta', tipos: t.tipos, metrica: 'cantidad', cantidad: form.cantidad, titulo: form.titulo.trim() || `${form.cantidad} ${t.plural}` }
      : { modo: 'competencia', tipos: p.tipos, metrica: p.metrica, cantidad: null, titulo: form.titulo.trim() || p.titulo };
    const { error } = await supabase.from('objetivos').insert({ ...row, premio: form.premio, alcance: form.alcance, desde: form.desde, hasta: form.hasta });
    setBusy(false);
    if (error) return toast.show(error.message, 'error');
    toast.show('Objetivo creado'); setForm(null); cargar();
  };
  const borrar = async (o: Objetivo) => {
    if (!confirm(`¿Eliminar "${o.titulo}"?`)) return;
    const { error } = await supabase.from('objetivos').delete().eq('id', o.id);
    if (error) return toast.show(error.message, 'error');
    setVer(null); cargar();
  };

  if (!objs) return <Spinner />;
  const nodoNombre = (c: string) => { const n = nodos.find((x) => x.codigo === c); return n ? (etiquetaEquipo(n) ?? `Equipo de ${n.nombre}`) : c; };
  const tv = ver ? tablas[ver.id] ?? [] : [];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-xl bg-slate-200/60 p-1">
          <button className={`seg ${!verPasados ? 'seg-on' : 'seg-off'}`} onClick={() => setVerPasados(false)}>En curso</button>
          <button className={`seg ${verPasados ? 'seg-on' : 'seg-off'}`} onClick={() => setVerPasados(true)}>Finalizados</button>
        </div>
        <p className="text-xs text-slate-500">Se cuentan las ventas, lo cargado en la Agenda hasta hoy y los videos de Capacitación vistos.</p>
        {puedeCrear && <button className="btn-primary ml-auto" onClick={nuevo}><Plus size={18} /> Nuevo objetivo</button>}
      </div>

      {visibles.length === 0 ? <Empty icon={<Target size={30} />} title={verPasados ? 'Sin objetivos finalizados' : 'No hay objetivos en curso'} text={puedeCrear ? 'Creá metas o competencias para tu equipo.' : 'Cuando tu líder cargue objetivos los vas a ver acá.'} /> : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visibles.map((o) => {
            const t = tablas[o.id] ?? []; const p = profile ? puesto(t, profile.id) : null;
            const yo = t.find((r) => r.usuario_id === profile?.id);
            const lider = t[0];
            const dias = Math.max(0, Math.ceil((new Date(o.hasta + 'T23:59').getTime() - Date.now()) / 86400000));
            const pct = o.modo === 'meta' && o.cantidad ? Math.min(100, ((yo?.valor ?? 0) / o.cantidad) * 100) : 0;
            const logrados = o.modo === 'meta' && o.cantidad ? t.filter((r) => r.valor >= o.cantidad!).length : 0;
            return (
              <button key={o.id} onClick={() => setVer(o)} className="card group p-5 text-left transition hover:-translate-y-0.5 hover:shadow-lg">
                <div className="flex items-start gap-3">
                  <span className="text-3xl">{emojiDe(o)}</span>
                  <div className="min-w-0 flex-1"><p className="font-bold text-royal-900">{o.titulo}</p>
                    <p className="text-xs text-slate-500">{nodoNombre(o.alcance)} · {pluralDe(o.tipos)}</p></div>
                  {o.premio > 0 && <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-700">+{o.premio}%</span>}
                </div>
                {o.modo === 'meta' ? (
                  <div className="mt-4">
                    {yo ? (<>
                      <div className="mb-1 flex justify-between text-xs"><span className="font-semibold">{yo.valor} / {o.cantidad}</span><span className="text-slate-500">{pct >= 100 ? '¡Logrado! 🎉' : `${Math.round(pct)}%`}</span></div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${pct >= 100 ? 'bg-emerald-500' : 'bg-royal-600'}`} style={{ width: `${pct}%` }} /></div>
                    </>) : <p className="text-sm text-slate-500">{logrados} de {t.length} lo lograron</p>}
                  </div>
                ) : (
                  <div className="mt-4 flex items-center gap-3 text-sm">
                    {p ? <span className="rounded-xl bg-royal-50 px-3 py-1.5 font-bold text-royal-700">{medalla(p) ?? ''} {p}° de {t.length}</span> : null}
                    {lider && lider.valor > 0 && <span className="truncate text-slate-500">Lidera {lider.nombre.split(' ')[0]} · {valorTxt(o, lider.valor)}</span>}
                  </div>
                )}
                <p className="mt-3 flex items-center gap-1 text-xs text-slate-400"><CalendarDays size={12} />{fd(o.desde)} – {fd(o.hasta)}{!verPasados && ` · quedan ${dias} días`}</p>
              </button>
            );
          })}
        </div>
      )}

      <Modal open={!!ver} onClose={() => setVer(null)} title={ver ? `${emojiDe(ver)} ${ver.titulo}` : ''} wide>
        {ver && (
          <div>
            <div className="mb-4 flex flex-wrap gap-2 text-xs">
              <span className="chip bg-royal-50 text-royal-700">{nodoNombre(ver.alcance)}</span>
              <span className="chip bg-slate-100 text-slate-600">{ver.modo === 'meta' ? `Meta: ${ver.cantidad} ${pluralDe(ver.tipos)}` : `Competencia · ${ver.metrica === 'mayor' ? 'venta más alta' : pluralDe(ver.tipos)}`}</span>
              {ver.premio > 0 && <span className="chip bg-amber-100 text-amber-700">Premio {ver.premio}%{ver.modo === 'competencia' ? ' al 1°' : ''}</span>}
              <span className="chip bg-slate-100 text-slate-600">{fd(ver.desde)} – {fd(ver.hasta)}</span>
            </div>
            {tv.length === 0 ? <p className="py-6 text-center text-sm text-slate-500">Todavía no hay participantes activos.</p> : (
              <div className="max-h-[55vh] overflow-y-auto rounded-2xl border border-slate-100">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3 text-left">#</th><th className="p-3 text-left">Vendedor</th><th className="p-3 text-right">{ver.metrica === 'mayor' ? 'Venta' : 'Total'}</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {tv.map((r) => { const p = puesto(tv, r.usuario_id)!; const yo = r.usuario_id === profile?.id;
                      const pct = ver.modo === 'meta' && ver.cantidad ? Math.min(100, (r.valor / ver.cantidad) * 100) : null;
                      return (
                        <tr key={r.usuario_id} className={yo ? 'bg-royal-50/60' : ''}>
                          <td className="w-12 p-3 text-center font-bold text-slate-500">{medalla(p) ?? `${p}°`}</td>
                          <td className="p-3"><p className="font-medium">{r.nombre}{yo && ' (vos)'}</p><p className="font-mono text-xs text-royal-600">{r.codigo}</p>
                            {pct !== null && <div className="mt-1.5 h-1.5 w-full max-w-[220px] overflow-hidden rounded-full bg-slate-100"><div className={`h-full ${pct >= 100 ? 'bg-emerald-500' : 'bg-royal-600'}`} style={{ width: `${pct}%` }} /></div>}</td>
                          <td className="p-3 text-right font-semibold">{valorTxt(ver, r.valor)}{pct !== null && pct >= 100 && ' ✅'}</td>
                        </tr>); })}
                  </tbody>
                </table>
              </div>
            )}
            {puedeCrear && <button className="btn-ghost mt-4 text-coral-600" onClick={() => borrar(ver)}><Trash2 size={16} /> Eliminar objetivo</button>}
          </div>
        )}
      </Modal>

      <Modal open={!!form} onClose={() => setForm(null)} title="Nuevo objetivo">
        {form && (
          <form onSubmit={crear} className="space-y-4">
            <div className="flex gap-1 rounded-xl bg-slate-200/60 p-1">
              <button type="button" className={`seg gap-2 py-2.5 text-base ${form.modo === 'meta' ? 'seg-on' : 'seg-off'}`} onClick={() => setForm({ ...form, modo: 'meta' })}><span className="grid h-9 w-9 place-items-center rounded-full bg-red-50 ring-1 ring-red-100"><Target size={22} className="text-red-500" strokeWidth={2.4} /></span> Meta</button>
              <button type="button" className={`seg gap-2 py-2.5 text-base ${form.modo === 'competencia' ? 'seg-on' : 'seg-off'}`} onClick={() => setForm({ ...form, modo: 'competencia' })}><span className="grid h-9 w-9 place-items-center rounded-full bg-amber-50 ring-1 ring-amber-100"><Trophy size={22} className="text-amber-500" strokeWidth={2.4} /></span> Competencia</button>
            </div>
            {form.modo === 'meta' ? (<>
              <div><label className="label">Cantidad</label>
                <div className="flex flex-wrap gap-2">{CANTIDADES.map((c) => <button type="button" key={c} onClick={() => setForm({ ...form, cantidad: c })} className={`rounded-xl px-3 py-1.5 text-sm font-semibold ${form.cantidad === c ? 'bg-royal-600 text-white' : 'bg-slate-100 text-slate-700'}`}>{c}</button>)}
                  <input className="input w-24 py-1.5" type="number" min={1} value={form.cantidad} onChange={(e) => setForm({ ...form, cantidad: Math.max(1, Number(e.target.value)) })} /></div></div>
              <div><label className="label">¿De qué?</label>
                <select className="input" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>{TIPOS.map((t) => <option key={t.k} value={t.k}>{t.l}</option>)}</select></div>
            </>) : (
              <div><label className="label">Desafío</label>
                <div className="grid grid-cols-2 gap-2">{PRESETS.map((p, i) => <button type="button" key={p.titulo} onClick={() => setForm({ ...form, preset: i })} className={`rounded-xl px-3 py-2.5 text-left text-sm font-semibold ${form.preset === i ? 'bg-royal-600 text-white' : 'bg-slate-100 text-slate-700'}`}>{p.emoji} {p.titulo}</button>)}</div></div>
            )}
            <div><label className="label">Premio</label>
              <div className="flex flex-wrap gap-2">{PREMIOS.map((p) => <button type="button" key={p} onClick={() => setForm({ ...form, premio: p })} className={`rounded-xl px-3.5 py-1.5 text-sm font-bold ${form.premio === p ? 'bg-amber-500 text-white' : 'bg-amber-50 text-amber-700'}`}>{p}%</button>)}</div></div>
            <div><label className="label">Equipo</label>
              <select className="input" value={form.alcance} onChange={(e) => setForm({ ...form, alcance: e.target.value })}>
                {alcances.map((n) => <option key={n.codigo} value={n.codigo}>{n.codigo === mio ? 'Toda mi red' : (etiquetaEquipo(n) ?? `Equipo de ${n.nombre}`)} · {n.codigo}</option>)}</select></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Desde</label><input className="input" type="date" value={form.desde} onChange={(e) => setForm({ ...form, desde: e.target.value })} required /></div>
              <div><label className="label">Hasta</label><input className="input" type="date" value={form.hasta} min={form.desde} onChange={(e) => setForm({ ...form, hasta: e.target.value })} required /></div>
            </div>
            <div><label className="label">Título (opcional)</label><input className="input" placeholder={form.modo === 'meta' ? `${form.cantidad} ${TIPOS.find((t) => t.k === form.tipo)?.plural}` : PRESETS[form.preset].titulo} value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} /></div>
            <button className="btn-primary w-full" disabled={busy || !form.alcance}>{busy && <Loader2 className="animate-spin" size={18} />}Crear objetivo</button>
          </form>
        )}
      </Modal>
      <Toast msg={toast.msg} kind={toast.kind} />
    </div>
  );
}

/** Puestos de un vendedor en cada desafío vigente (para su perfil). */
export function PuestosVendedor({ uid }: { uid: string }) {
  const [filas, setFilas] = useState<{ o: Objetivo; p: number | null; total: number; v: number }[] | null>(null);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('objetivos').select('*').gte('hasta', hoy()).order('hasta');
      const os = (data as Objetivo[]) ?? [];
      const ts = await Promise.all(os.map((o) => tabla(o.id)));
      setFilas(os.map((o, i) => ({ o, p: puesto(ts[i], uid), total: ts[i].length, v: ts[i].find((r) => r.usuario_id === uid)?.valor ?? 0 })).filter((f) => f.p !== null));
    })();
  }, [uid]);
  if (!filas) return <p className="text-xs text-slate-400">Cargando desafíos…</p>;
  if (!filas.length) return <p className="text-xs text-slate-500">No participa en desafíos vigentes.</p>;
  return (
    <ul className="space-y-1.5">
      {filas.map(({ o, p, total, v }) => (
        <li key={o.id} className="flex items-center gap-2 rounded-xl bg-white p-2.5 text-sm">
          <span>{emojiDe(o)}</span><span className="min-w-0 flex-1 truncate font-medium">{o.titulo}</span>
          <span className="text-xs text-slate-500">{o.modo === 'meta' ? `${v}/${o.cantidad}` : valorTxt(o, v)}</span>
          <span className="rounded-lg bg-royal-50 px-2 py-0.5 text-xs font-bold text-royal-700">{medalla(p) ?? ''}{p}° / {total}</span>
        </li>
      ))}
    </ul>
  );
}
