'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Award, Lock, GraduationCap, Plus, Pencil, Trash2, CheckCircle2, PlayCircle, LayoutDashboard, ListVideo, Headphones, BookOpen, ClipboardList, Subtitles, Circle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';
import { PageHeader, Empty, Modal, Spinner, Toast } from '@/components/ui';
import { useToast } from '@/components/useToast';
import TestLectura from '@/components/TestLectura';
import type { Video, CategoriaCap, PendienteCap } from '@/lib/types';

type Tipo = Video['tipo'];
const TIPO_TXT: Record<Tipo, { plural: string; vacio: string; hecho: string; accion: string }> = {
  video: { plural: 'videos', vacio: 'Todavía no hay videos.', hecho: 'Ya completaste este video.', accion: 'Miralo hasta el final para que cuente en tus objetivos.' },
  podcast: { plural: 'podcasts', vacio: 'Todavía no hay podcasts.', hecho: 'Ya escuchaste este episodio.', accion: 'Escuchalo hasta el final para que cuente en tus objetivos.' },
  lectura: { plural: 'lecturas', vacio: 'Pronto vas a encontrar acá libros traducidos y material para leer.', hecho: 'Ya leíste este material.', accion: 'Cuando lo termines, marcalo como leído (si tiene test, aprobalo para que cuente).' },
};
const spotifyEmbed = (url: string) => { const m = url.match(/open\.spotify\.com\/(?:embed\/)?(episode|show)\/([\w]+)/); return m ? `https://open.spotify.com/embed/${m[1]}/${m[2]}` : null; };
const ytId = (url: string) => url.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/)?.[1] ?? null;
const vacio = { titulo: '', descripcion: '', url: '', categoria: '', idioma: 'es' as 'es' | 'sub', tipo: 'video' as Video['tipo'], orden: 0, activo: true };
const ACCIONES: Record<PendienteCap['accion'], { l: string; c: string }> = {
  subtitular: { l: 'Subtitular', c: 'bg-sky-100 text-sky-700' }, traducir: { l: 'Traducir', c: 'bg-violet-100 text-violet-700' },
  grabar: { l: 'Grabar', c: 'bg-rose-100 text-rose-700' }, resumir: { l: 'Resumir', c: 'bg-amber-100 text-amber-700' }, enlazar: { l: 'Enlazar curso', c: 'bg-emerald-100 text-emerald-700' },
};
const pendVacio = { categoria: '', titulo: '', accion: 'grabar' as PendienteCap['accion'], fuente: '', url: '', nota: '' };

declare global { interface Window { YT?: { Player: new (el: HTMLElement, o: object) => { destroy: () => void } }; onYouTubeIframeAPIReady?: () => void } }
function cargarYT(): Promise<void> {
  return new Promise((res) => {
    if (window.YT?.Player) return res();
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { prev?.(); res(); };
    if (!document.getElementById('yt-api')) { const s = document.createElement('script'); s.id = 'yt-api'; s.src = 'https://www.youtube.com/iframe_api'; document.body.appendChild(s); }
  });
}

function Reproductor({ v, onFin }: { v: Video; onFin: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const id = ytId(v.url);
  useEffect(() => {
    if (!id || !ref.current) return;
    let player: { destroy: () => void } | null = null; let vivo = true;
    cargarYT().then(() => {
      if (!vivo || !ref.current) return;
      player = new window.YT!.Player(ref.current, { videoId: id, width: '100%', height: '100%', playerVars: { rel: 0, modestbranding: 1, hl: 'es', cc_lang_pref: 'es', cc_load_policy: v.idioma === 'sub' ? 1 : 0 },
        events: { onStateChange: (e: { data: number }) => { if (e.data === 0) onFin(); } } });
    });
    return () => { vivo = false; player?.destroy(); };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  const sp = !id ? spotifyEmbed(v.url) : null;
  if (v.tipo === 'lectura' && !id) return <iframe src={v.url} className="h-[70vh] w-full rounded-2xl border" title={v.titulo} />;
  if (sp) return <iframe src={sp} className="h-[232px] w-full rounded-2xl" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" title={v.titulo} />;
  return (
    <div className="aspect-video w-full overflow-hidden rounded-2xl bg-black">
      {id ? <div ref={ref} className="h-full w-full" /> : v.tipo === 'podcast' ? <audio src={v.url} controls autoPlay className="mt-[25%] w-full" onEnded={onFin} /> : <video src={v.url} controls autoPlay className="h-full w-full" onEnded={onFin} />}
    </div>
  );
}

function Anillo({ pct, size = 120 }: { pct: number; size?: number }) {
  const r = (size - 14) / 2, c = 2 * Math.PI * r;
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={12} className="fill-none stroke-slate-200" />
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={12} strokeLinecap="round" className="fill-none stroke-emerald-500 transition-all" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} />
      </svg>
      <span className="absolute text-2xl font-extrabold text-royal-900">{pct}%</span>
    </div>
  );
}

export default function Capacitacion() {
  const { profile } = useAuth();
  const toast = useToast();
  const esAdmin = profile?.rol === 'admin';
  const [videos, setVideos] = useState<Video[] | null>(null);
  const [cats, setCats] = useState<CategoriaCap[]>([]);
  const [pend, setPend] = useState<PendienteCap[]>([]);
  const [vistos, setVistos] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<'tablero' | Tipo | 'contenido'>('tablero');
  const [filtro, setFiltro] = useState<string>('');
  const [ver, setVer] = useState<Video | null>(null);
  const [form, setForm] = useState<(typeof vacio & { id?: string }) | null>(null);
  const [conTest, setConTest] = useState<Set<string>>(new Set());
  const [test, setTest] = useState<Video | null>(null);
  const [pform, setPform] = useState<(typeof pendVacio & { id?: string }) | null>(null);

  const cargar = useCallback(async () => {
    const [{ data: v }, { data: vv }, { data: c }, { data: pe }, { data: ct }] = await Promise.all([
      supabase.from('capacitacion_videos').select('*').order('orden').order('created_at'),
      supabase.from('videos_vistos').select('video_id').eq('usuario_id', profile!.id),
      supabase.from('capacitacion_categorias').select('*').order('orden'),
      esAdmin ? supabase.from('capacitacion_pendientes').select('*').order('created_at') : Promise.resolve({ data: [] }),
      supabase.rpc('materiales_con_test'),
    ]);
    setConTest(new Set(((ct as unknown as (string | { materiales_con_test: string })[]) ?? []).map((x) => (typeof x === 'string' ? x : x.materiales_con_test))));
    setVideos((v as Video[]) ?? []); setCats((c as CategoriaCap[]) ?? []); setPend((pe as PendienteCap[]) ?? []);
    setVistos(new Set(((vv as { video_id: string }[]) ?? []).map((x) => x.video_id)));
  }, [profile, esAdmin]);
  useEffect(() => { cargar(); }, [cargar]);

  const terminar = async (v: Video) => {
    if (vistos.has(v.id)) return;
    const { error } = await supabase.from('videos_vistos').insert({ video_id: v.id, usuario_id: profile!.id });
    if (error) return;
    const nuevos = new Set([...vistos, v.id]); setVistos(nuevos);
    const cat = cats.find((c) => c.slug === v.categoria);
    const completa = cat?.especial && cat.insignia && videos!.filter((x) => x.activo && x.categoria === cat.slug).every((x) => nuevos.has(x.id));
    toast.show(completa ? `🏅 ¡Desbloqueaste la insignia "${cat!.insignia}"!` : '¡Video completado! Suma a tus objetivos 🎓');
  };
  const guardar = async (e: React.FormEvent) => {
    e.preventDefault(); if (!form) return;
    const { id, ...row } = form;
    const payload = { ...row, descripcion: row.descripcion || null, categoria: row.categoria || null };
    const { error } = id ? await supabase.from('capacitacion_videos').update(payload).eq('id', id) : await supabase.from('capacitacion_videos').insert(payload);
    if (error) return toast.show(error.message, 'error');
    setForm(null); cargar();
  };
  const borrar = async (v: Video) => { if (!confirm(`¿Eliminar "${v.titulo}"?`)) return; await supabase.from('capacitacion_videos').delete().eq('id', v.id); cargar(); };
  const guardarPend = async (e: React.FormEvent) => {
    e.preventDefault(); if (!pform) return;
    const { id, ...row } = pform;
    const payload = { ...row, categoria: row.categoria || null, fuente: row.fuente || null, url: row.url || null, nota: row.nota || null };
    const { error } = id ? await supabase.from('capacitacion_pendientes').update(payload).eq('id', id) : await supabase.from('capacitacion_pendientes').insert(payload);
    if (error) return toast.show(error.message, 'error');
    setPform(null); cargar();
  };
  const toggleHecho = async (p: PendienteCap) => { await supabase.from('capacitacion_pendientes').update({ hecho: !p.hecho }).eq('id', p.id); cargar(); };
  const borrarPend = async (p: PendienteCap) => { if (!confirm(`¿Eliminar "${p.titulo}"?`)) return; await supabase.from('capacitacion_pendientes').delete().eq('id', p.id); cargar(); };

  if (!videos) return <Spinner />;
  const activos = videos.filter((v) => v.activo);
  const nombreCat = (slug: string | null) => cats.find((c) => c.slug === slug)?.nombre ?? 'General';
  const listaCats: CategoriaCap[] = [...cats, ...(videos.some((v) => !v.categoria || !cats.find((c) => c.slug === v.categoria)) ? [{ slug: '', nombre: 'General', emoji: '📚', orden: 999 }] : [])];
  const deCat = (slug: string, lista = videos) => lista.filter((v) => (cats.find((c) => c.slug === v.categoria) ? v.categoria : '') === slug);
  const statsCat = listaCats.map((c) => { const vs = deCat(c.slug, activos); const ok = vs.filter((v) => vistos.has(v.id)).length; return { c, total: vs.length, ok, pct: vs.length ? Math.round((ok / vs.length) * 100) : 0 }; });
  const totalOk = activos.filter((v) => vistos.has(v.id)).length;
  const pct = activos.length ? Math.round((totalOk / activos.length) * 100) : 0;
  const completas = statsCat.filter((s) => s.total > 0 && s.ok === s.total).length;
  const conVideos = statsCat.filter((s) => s.total > 0).length;
  const abrirCat = (slug: string) => { setFiltro(slug); setTab(deCat(slug, activos).some((v) => v.tipo === 'video') ? 'video' : deCat(slug, activos)[0]?.tipo ?? 'video'); };

  type Tab = 'tablero' | Tipo | 'contenido';
  const tabs: { k: Tab; l: string; i: JSX.Element }[] = [
    { k: 'tablero', l: 'Mi avance', i: <LayoutDashboard size={16} /> },
    { k: 'video', l: 'Videos', i: <ListVideo size={16} /> },
    { k: 'podcast', l: 'Podcasts', i: <Headphones size={16} /> },
    { k: 'lectura', l: 'Lecturas', i: <BookOpen size={16} /> },
    ...(esAdmin ? [{ k: 'contenido' as Tab, l: 'Contenido', i: <ClipboardList size={16} /> }] : []),
  ];

  return (
    <div>
      <PageHeader title="Capacitación" subtitle={activos.length ? `Completaste ${pct}% del material` : 'Material de formación para el equipo'}
        action={esAdmin ? <button className="btn-primary" onClick={() => setForm({ ...vacio, categoria: filtro, tipo: tab === 'podcast' || tab === 'lectura' ? tab : 'video' })}><Plus size={18} /> Agregar material</button> : undefined} />
      <div className="mb-5 flex max-w-3xl gap-1 overflow-x-auto rounded-xl bg-slate-200/60 p-1">
        {tabs.map((t) => <button key={t.k} className={`seg whitespace-nowrap ${tab === t.k ? 'seg-on' : 'seg-off'}`} onClick={() => setTab(t.k)}>{t.i} {t.l}</button>)}
      </div>

      {tab === 'tablero' && (activos.length === 0 ? <Empty icon={<GraduationCap size={30} />} title="Próximamente" text="Acá vas a encontrar el material de capacitación." /> : (
        <div className="space-y-5">
          <div className="card flex flex-col items-center gap-5 p-6 sm:flex-row">
            <Anillo pct={pct} />
            <div className="flex-1 text-center sm:text-left">
              <p className="text-lg font-bold text-royal-900">{pct === 100 ? '¡Completaste toda la capacitación! 🏆' : pct >= 50 ? '¡Vas muy bien, seguí así! 🚀' : pct > 0 ? 'Buen comienzo, cada video suma 💪' : 'Empezá por la categoría que más te sirva hoy 👇'}</p>
              <div className="mt-3 grid grid-cols-3 gap-3 text-center">
                <div className="rounded-xl bg-slate-50 p-3"><p className="text-xl font-extrabold text-royal-900">{totalOk}/{activos.length}</p><p className="text-xs text-slate-500">contenidos completados</p></div>
                <div className="rounded-xl bg-slate-50 p-3"><p className="text-xl font-extrabold text-royal-900">{completas}/{conVideos}</p><p className="text-xs text-slate-500">categorías completas</p></div>
                <div className="rounded-xl bg-slate-50 p-3"><p className="text-xl font-extrabold text-royal-900">{activos.length - totalOk}</p><p className="text-xs text-slate-500">por ver</p></div>
              </div>
            </div>
          </div>
          {statsCat.filter((s) => s.c.especial && s.total > 0).map(({ c, total, ok, pct: p }) => { const logrado = ok === total; const sig = deCat(c.slug, activos).find((v) => !vistos.has(v.id)); return (
            <div key={c.slug} className={`card overflow-hidden p-0 ${logrado ? 'ring-2 ring-amber-400' : ''}`}>
              <div className="flex flex-col gap-4 bg-gradient-to-r from-royal-900 to-royal-600 p-5 text-white sm:flex-row sm:items-center">
                <div className={`grid h-20 w-20 shrink-0 place-items-center self-center rounded-full ${logrado ? 'bg-gradient-to-br from-amber-300 to-amber-500 shadow-lg shadow-amber-500/40' : 'bg-white/10'}`}>
                  {logrado ? <Award size={42} className="text-white" /> : <span className="relative text-4xl grayscale-[60%]">{c.emoji}<Lock size={16} className="absolute -bottom-1 -right-2 rounded-full bg-royal-900 p-0.5" /></span>}
                </div>
                <div className="min-w-0 flex-1 text-center sm:text-left">
                  <p className="text-xs font-semibold uppercase tracking-wide text-royal-100">Sección especial · Insignia</p>
                  <p className="text-xl font-extrabold">{c.nombre}</p>
                  {c.descripcion && <p className="text-sm text-royal-100">{c.descripcion}</p>}
                  <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/20"><div className={`h-full rounded-full ${logrado ? 'bg-amber-400' : 'bg-emerald-400'}`} style={{ width: `${p}%` }} /></div>
                  <p className="mt-1.5 text-sm">{logrado ? `🏅 Insignia "${c.insignia}" desbloqueada` : `${ok} de ${total} módulos · ${p}% · Completalo para ganar "${c.insignia}"`}</p>
                </div>
                <button className="rounded-xl bg-white px-4 py-2.5 font-bold text-royal-900 hover:bg-royal-50" onClick={() => (sig ? setVer(sig) : abrirCat(c.slug))}>{logrado ? 'Repasar' : ok ? 'Continuar' : 'Empezar'}</button>
              </div>
            </div>); })}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {statsCat.filter((s) => !s.c.especial && (s.total > 0 || esAdmin)).map(({ c, total, ok, pct: p }) => (
              <button key={c.slug} onClick={() => abrirCat(c.slug)} disabled={!total} className="card p-4 text-left transition hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-60 disabled:hover:translate-y-0">
                <div className="flex items-center gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-royal-50 text-2xl">{c.emoji ?? '📚'}</span>
                  <div className="min-w-0 flex-1"><p className="truncate font-bold text-royal-900">{c.nombre}</p>
                    <p className="text-xs text-slate-500">{total ? `${ok} de ${total} completados` : 'Próximamente'}</p></div>
                  <span className={`text-lg font-extrabold ${p === 100 ? 'text-emerald-600' : 'text-royal-900'}`}>{total ? `${p}%` : '—'}</span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200"><div className={`h-full rounded-full ${p === 100 ? 'bg-emerald-500' : 'bg-royal-500'}`} style={{ width: `${p}%` }} /></div>
              </button>
            ))}
          </div>
        </div>
      ))}

      {(tab === 'video' || tab === 'podcast' || tab === 'lectura') && (() => { const tipo = tab; const delTipo = videos.filter((v) => (v.tipo ?? 'video') === tipo); const statsT = listaCats.map((c) => { const vs = deCat(c.slug, delTipo.filter((v) => v.activo)); return { c, total: vs.length, pct: vs.length ? Math.round((vs.filter((v) => vistos.has(v.id)).length / vs.length) * 100) : 0 }; }); return delTipo.length === 0 ? <Empty icon={tipo === 'lectura' ? <BookOpen size={30} /> : tipo === 'podcast' ? <Headphones size={30} /> : <GraduationCap size={30} />} title="Próximamente" text={TIPO_TXT[tipo].vacio} /> : (
        <div className="space-y-6">
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            <button className={`chip whitespace-nowrap ${filtro === '' ? 'bg-royal-600 text-white' : 'bg-slate-100 text-slate-600'}`} onClick={() => setFiltro('')}>Todas</button>
            {statsT.filter((s) => s.total > 0).map(({ c, pct: p }) => <button key={c.slug} className={`chip whitespace-nowrap ${filtro === c.slug ? 'bg-royal-600 text-white' : 'bg-slate-100 text-slate-600'}`} onClick={() => setFiltro(c.slug)}>{c.emoji} {c.nombre} · {p}%</button>)}
          </div>
          {listaCats.filter((c) => (!filtro || c.slug === filtro) && deCat(c.slug, delTipo).length).map((c) => (
            <section key={c.slug}>
              <h2 className="mb-3 font-bold text-royal-900">{c.emoji} {c.nombre}</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {deCat(c.slug, delTipo).map((v) => { const id = ytId(v.url); const ok = vistos.has(v.id); return (
                  <div key={v.id} className={`card overflow-hidden ${!v.activo ? 'opacity-50' : ''}`}>
                    <button className="relative block aspect-video w-full bg-royal-900" onClick={() => setVer(v)}>
                      {id && <img src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt="" className="h-full w-full object-cover" />}
                      <span className="absolute inset-0 flex items-center justify-center bg-black/20"><PlayCircle size={48} className="text-white drop-shadow" /></span>
                      {ok && <span className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-emerald-500 px-2 py-0.5 text-xs font-bold text-white"><CheckCircle2 size={13} /> Visto</span>}
                      {v.tipo === 'podcast' && <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-violet-600 px-2 py-0.5 text-xs font-semibold text-white"><Headphones size={13} /> Podcast</span>}
                      {!id && v.tipo === 'lectura' && <span className="absolute inset-0 grid place-items-center text-5xl">📖</span>}
                      {v.idioma === 'sub' && <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-xs font-semibold text-white"><Subtitles size={13} /> Subtitulado</span>}
                    </button>
                    <div className="flex items-start gap-2 p-4">
                      <div className="min-w-0 flex-1"><p className="font-semibold">{v.titulo}</p>{v.descripcion && <p className="mt-1 line-clamp-2 text-sm text-slate-500">{v.descripcion}</p>}</div>
                      {esAdmin && <><button className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100" onClick={() => setForm({ id: v.id, titulo: v.titulo, descripcion: v.descripcion ?? '', url: v.url, categoria: v.categoria ?? '', idioma: v.idioma ?? 'es', tipo: v.tipo ?? 'video', orden: v.orden, activo: v.activo })}><Pencil size={15} /></button>
                        <button className="rounded-full p-1.5 text-coral-600 hover:bg-red-50" onClick={() => borrar(v)}><Trash2 size={15} /></button></>}
                    </div>
                  </div>); })}
              </div>
            </section>
          ))}
        </div>
      ); })()}

      {tab === 'contenido' && esAdmin && (() => {
        const abiertos = pend.filter((p) => !p.hecho);
        return (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="card p-4"><p className="text-2xl font-extrabold text-royal-900">{videos.length}</p><p className="text-xs text-slate-500">videos subidos</p></div>
              <div className="card p-4"><p className="text-2xl font-extrabold text-royal-900">{videos.filter((v) => v.idioma === 'sub').length}</p><p className="text-xs text-slate-500">con subtítulos al español</p></div>
              <div className="card p-4"><p className="text-2xl font-extrabold text-coral-600">{abiertos.length}</p><p className="text-xs text-slate-500">pendientes</p></div>
              <div className="card p-4"><p className="text-2xl font-extrabold text-emerald-600">{pend.length - abiertos.length}</p><p className="text-xs text-slate-500">pendientes resueltos</p></div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {Object.entries(ACCIONES).map(([k, a]) => <span key={k} className={`chip ${a.c}`}>{a.l}: {abiertos.filter((p) => p.accion === k).length}</span>)}
              <button className="btn-primary ml-auto" onClick={() => setPform({ ...pendVacio })}><Plus size={16} /> Agregar pendiente</button>
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              {listaCats.map((c) => { const vs = deCat(c.slug); const ps = pend.filter((p) => (p.categoria ?? '') === c.slug); if (!vs.length && !ps.length) return null; return (
                <div key={c.slug} className="card p-4">
                  <div className="mb-2 flex items-center gap-2"><span className="text-xl">{c.emoji}</span><p className="flex-1 font-bold text-royal-900">{c.nombre}</p>
                    <span className="chip bg-emerald-100 text-emerald-700">{vs.length} subidos</span>{ps.filter((p) => !p.hecho).length > 0 && <span className="chip bg-red-100 text-red-700">{ps.filter((p) => !p.hecho).length} pendientes</span>}</div>
                  {vs.length > 0 && <details className="mb-2 text-sm"><summary className="cursor-pointer text-slate-500">Ver subidos</summary>
                    <ul className="mt-1 space-y-1">{vs.map((v) => <li key={v.id} className="flex items-center gap-1.5 text-slate-600"><CheckCircle2 size={14} className="shrink-0 text-emerald-500" /><span className="truncate">{v.titulo}</span>{v.idioma === 'sub' && <Subtitles size={13} className="shrink-0 text-sky-500" />}</li>)}</ul></details>}
                  <ul className="space-y-1.5">{ps.map((p) => (
                    <li key={p.id} className={`flex items-start gap-2 rounded-lg bg-slate-50 p-2 text-sm ${p.hecho ? 'opacity-50' : ''}`}>
                      <button onClick={() => toggleHecho(p)} className="mt-0.5 shrink-0" title="Marcar como resuelto">{p.hecho ? <CheckCircle2 size={17} className="text-emerald-500" /> : <Circle size={17} className="text-slate-400" />}</button>
                      <div className="min-w-0 flex-1"><p className={`font-medium ${p.hecho ? 'line-through' : ''}`}>{p.titulo}</p>
                        <p className="text-xs text-slate-500">{[p.fuente, p.nota].filter(Boolean).join(' · ')}</p></div>
                      <span className={`chip shrink-0 ${ACCIONES[p.accion].c}`}>{ACCIONES[p.accion].l}</span>
                      <button className="shrink-0 p-0.5 text-slate-400 hover:text-slate-600" onClick={() => setPform({ id: p.id, categoria: p.categoria ?? '', titulo: p.titulo, accion: p.accion, fuente: p.fuente ?? '', url: p.url ?? '', nota: p.nota ?? '' })}><Pencil size={14} /></button>
                      <button className="shrink-0 p-0.5 text-coral-600" onClick={() => borrarPend(p)}><Trash2 size={14} /></button>
                    </li>))}</ul>
                </div>); })}
            </div>
          </div>
        );
      })()}

      <Modal open={!!ver} onClose={() => setVer(null)} title={ver?.titulo ?? ''} wide>
        {ver && (<div><Reproductor v={ver} onFin={() => terminar(ver)} />
          <p className="mt-3 text-sm text-slate-500">{vistos.has(ver.id) ? `✅ ${TIPO_TXT[ver.tipo ?? 'video'].hecho}` : TIPO_TXT[ver.tipo ?? 'video'].accion}{ver.idioma === 'sub' ? ' Si no ves los subtítulos, tocá CC en el reproductor.' : ''}</p>
          {!vistos.has(ver.id) && conTest.has(ver.id) && <button className="btn-primary mt-3" onClick={() => setTest(ver)}><ClipboardList size={16} /> Ya lo leí: hacer el test</button>}
          {!vistos.has(ver.id) && !conTest.has(ver.id) && (ver.tipo === 'lectura' || spotifyEmbed(ver.url)) && <button className="btn-primary mt-3" onClick={() => terminar(ver)}><CheckCircle2 size={16} /> {ver.tipo === 'lectura' ? 'Marcar como leído' : 'Marcar como escuchado'}</button>}</div>)}
      </Modal>
      <Modal open={!!test} onClose={() => setTest(null)} title={test ? `Test: ${test.titulo}` : ''} wide>
        {test && <TestLectura videoId={test.id} titulo={test.titulo} onAprobado={() => { const nuevos = new Set([...vistos, test.id]); setVistos(nuevos); toast.show('📚 ¡Test aprobado! Lectura completada'); }} />}
      </Modal>
      <Modal open={!!form} onClose={() => setForm(null)} title={form?.id ? 'Editar material' : 'Agregar material'}>
        {form && (
          <form onSubmit={guardar} className="space-y-3.5">
            <div><label className="label">Título</label><input className="input" value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} required /></div>
            <div><label className="label">Tipo</label><select className="input" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as Tipo })}><option value="video">Video</option><option value="podcast">Podcast</option><option value="lectura">Lectura (PDF)</option></select></div>
            <div><label className="label">{form.tipo === 'lectura' ? 'Link del PDF' : form.tipo === 'podcast' ? 'Link de YouTube, Spotify o archivo de audio' : 'Link de YouTube (puede ser no listado) o de un archivo de video'}</label><input className="input" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} required /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Categoría</label><select className="input" value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })}><option value="">General</option>{cats.map((c) => <option key={c.slug} value={c.slug}>{c.emoji} {c.nombre}</option>)}</select></div>
              <div><label className="label">Idioma</label><select className="input" value={form.idioma} onChange={(e) => setForm({ ...form, idioma: e.target.value as 'es' | 'sub' })}><option value="es">Español</option><option value="sub">Otro idioma, subtitulado</option></select></div>
            </div>
            <div><label className="label">Orden</label><input className="input w-28" type="number" value={form.orden} onChange={(e) => setForm({ ...form, orden: Number(e.target.value) })} /></div>
            <div><label className="label">Descripción</label><textarea className="input min-h-[80px]" value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} /></div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.activo} onChange={(e) => setForm({ ...form, activo: e.target.checked })} /> Visible para el equipo</label>
            <button className="btn-primary w-full">Guardar</button>
          </form>
        )}
      </Modal>
      <Modal open={!!pform} onClose={() => setPform(null)} title={pform?.id ? 'Editar pendiente' : 'Agregar pendiente'}>
        {pform && (
          <form onSubmit={guardarPend} className="space-y-3.5">
            <div><label className="label">Qué falta</label><input className="input" value={pform.titulo} onChange={(e) => setPform({ ...pform, titulo: e.target.value })} required /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Categoría</label><select className="input" value={pform.categoria} onChange={(e) => setPform({ ...pform, categoria: e.target.value })}><option value="">General</option>{cats.map((c) => <option key={c.slug} value={c.slug}>{c.emoji} {c.nombre}</option>)}</select></div>
              <div><label className="label">Acción</label><select className="input" value={pform.accion} onChange={(e) => setPform({ ...pform, accion: e.target.value as PendienteCap['accion'] })}>{Object.entries(ACCIONES).map(([k, a]) => <option key={k} value={k}>{a.l}</option>)}</select></div>
            </div>
            <div><label className="label">Fuente</label><input className="input" value={pform.fuente} onChange={(e) => setPform({ ...pform, fuente: e.target.value })} /></div>
            <div><label className="label">Link (opcional)</label><input className="input" value={pform.url} onChange={(e) => setPform({ ...pform, url: e.target.value })} /></div>
            <div><label className="label">Nota</label><textarea className="input min-h-[70px]" value={pform.nota} onChange={(e) => setPform({ ...pform, nota: e.target.value })} /></div>
            <button className="btn-primary w-full">Guardar</button>
          </form>
        )}
      </Modal>
      <Toast msg={toast.msg} kind={toast.kind} />
    </div>
  );
}
