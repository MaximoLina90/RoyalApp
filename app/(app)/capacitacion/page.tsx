'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { GraduationCap, Plus, Pencil, Trash2, CheckCircle2, PlayCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';
import { PageHeader, Empty, Modal, Spinner, Toast } from '@/components/ui';
import { useToast } from '@/components/useToast';
import type { Video } from '@/lib/types';

const ytId = (url: string) => url.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/)?.[1] ?? null;
const vacio = { titulo: '', descripcion: '', url: '', categoria: '', orden: 0, activo: true };

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
      player = new window.YT!.Player(ref.current, { videoId: id, width: '100%', height: '100%', playerVars: { rel: 0, modestbranding: 1 },
        events: { onStateChange: (e: { data: number }) => { if (e.data === 0) onFin(); } } });
    });
    return () => { vivo = false; player?.destroy(); };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="aspect-video w-full overflow-hidden rounded-2xl bg-black">
      {id ? <div ref={ref} className="h-full w-full" /> : <video src={v.url} controls autoPlay className="h-full w-full" onEnded={onFin} />}
    </div>
  );
}

export default function Capacitacion() {
  const { profile } = useAuth();
  const toast = useToast();
  const esAdmin = profile?.rol === 'admin';
  const [videos, setVideos] = useState<Video[] | null>(null);
  const [vistos, setVistos] = useState<Set<string>>(new Set());
  const [ver, setVer] = useState<Video | null>(null);
  const [form, setForm] = useState<(typeof vacio & { id?: string }) | null>(null);

  const cargar = useCallback(async () => {
    const [{ data: v }, { data: vv }] = await Promise.all([
      supabase.from('capacitacion_videos').select('*').order('categoria', { nullsFirst: true }).order('orden').order('created_at'),
      supabase.from('videos_vistos').select('video_id').eq('usuario_id', profile!.id),
    ]);
    setVideos((v as Video[]) ?? []); setVistos(new Set(((vv as { video_id: string }[]) ?? []).map((x) => x.video_id)));
  }, [profile]);
  useEffect(() => { cargar(); }, [cargar]);

  const terminar = async (v: Video) => {
    if (vistos.has(v.id)) return;
    const { error } = await supabase.from('videos_vistos').insert({ video_id: v.id, usuario_id: profile!.id });
    if (!error) { setVistos(new Set([...vistos, v.id])); toast.show('¡Video completado! Suma a tus objetivos 🎓'); }
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

  if (!videos) return <Spinner />;
  const cats = [...new Set(videos.map((v) => v.categoria ?? 'General'))];
  const pct = videos.length ? Math.round((videos.filter((v) => vistos.has(v.id)).length / videos.length) * 100) : 0;

  return (
    <div>
      <PageHeader title="Capacitación" subtitle={videos.length ? `Completaste ${pct}% del material` : 'Material de formación para el equipo'}
        action={esAdmin ? <button className="btn-primary" onClick={() => setForm({ ...vacio })}><Plus size={18} /> Agregar video</button> : undefined} />
      {videos.length === 0 ? <Empty icon={<GraduationCap size={30} />} title="Próximamente" text="Acá vas a encontrar los videos de capacitación. Cada video que termines suma a tus objetivos." /> : (
        <div className="space-y-6">
          {videos.length > 0 && <div className="h-2 max-w-md overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} /></div>}
          {cats.map((c) => (
            <section key={c}>
              <h2 className="mb-3 font-bold text-royal-900">{c}</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {videos.filter((v) => (v.categoria ?? 'General') === c).map((v) => { const id = ytId(v.url); const ok = vistos.has(v.id); return (
                  <div key={v.id} className={`card overflow-hidden ${!v.activo ? 'opacity-50' : ''}`}>
                    <button className="relative block aspect-video w-full bg-royal-900" onClick={() => setVer(v)}>
                      {id && <img src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt="" className="h-full w-full object-cover" />}
                      <span className="absolute inset-0 flex items-center justify-center bg-black/20"><PlayCircle size={48} className="text-white drop-shadow" /></span>
                      {ok && <span className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-emerald-500 px-2 py-0.5 text-xs font-bold text-white"><CheckCircle2 size={13} /> Visto</span>}
                    </button>
                    <div className="flex items-start gap-2 p-4">
                      <div className="min-w-0 flex-1"><p className="font-semibold">{v.titulo}</p>{v.descripcion && <p className="mt-1 line-clamp-2 text-sm text-slate-500">{v.descripcion}</p>}</div>
                      {esAdmin && <><button className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100" onClick={() => setForm({ id: v.id, titulo: v.titulo, descripcion: v.descripcion ?? '', url: v.url, categoria: v.categoria ?? '', orden: v.orden, activo: v.activo })}><Pencil size={15} /></button>
                        <button className="rounded-full p-1.5 text-coral-600 hover:bg-red-50" onClick={() => borrar(v)}><Trash2 size={15} /></button></>}
                    </div>
                  </div>); })}
              </div>
            </section>
          ))}
        </div>
      )}
      <Modal open={!!ver} onClose={() => setVer(null)} title={ver?.titulo ?? ''} wide>
        {ver && (<div><Reproductor v={ver} onFin={() => terminar(ver)} />
          <p className="mt-3 text-sm text-slate-500">{vistos.has(ver.id) ? '✅ Ya completaste este video.' : 'Miralo hasta el final para que cuente en tus objetivos.'}</p></div>)}
      </Modal>
      <Modal open={!!form} onClose={() => setForm(null)} title={form?.id ? 'Editar video' : 'Agregar video'}>
        {form && (
          <form onSubmit={guardar} className="space-y-3.5">
            <div><label className="label">Título</label><input className="input" value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} required /></div>
            <div><label className="label">Link de YouTube (puede ser no listado) o de un archivo de video</label><input className="input" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} required /></div>
            <div className="grid grid-cols-[1fr_90px] gap-3">
              <div><label className="label">Categoría</label><input className="input" placeholder="Ej. Producto, Ventas, Reclutamiento" value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} /></div>
              <div><label className="label">Orden</label><input className="input" type="number" value={form.orden} onChange={(e) => setForm({ ...form, orden: Number(e.target.value) })} /></div>
            </div>
            <div><label className="label">Descripción</label><textarea className="input min-h-[80px]" value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} /></div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.activo} onChange={(e) => setForm({ ...form, activo: e.target.checked })} /> Visible para el equipo</label>
            <button className="btn-primary w-full">Guardar</button>
          </form>
        )}
      </Modal>
      <Toast msg={toast.msg} kind={toast.kind} />
    </div>
  );
}
