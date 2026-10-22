'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Expand, Image as ImageIcon, Package, Play, PlayCircle, Plus, X } from 'lucide-react';
import type { Producto, ProductoMedio } from '@/lib/types';
import { pesos } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { Modal } from './ui';
import { useCart } from './CartProvider';

const visible = (m: ProductoMedio) => m.estado === 'verificada' || m.estado === 'aprobada';

type Item = { id: string; tipo: 'foto' | 'video' | 'youtube'; url: string };

// vq=large pide 480p como calidad inicial (YouTube puede subirla según la conexión).
const ytEmbed = (id: string, auto = false) =>
  `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&playsinline=1&vq=large${auto ? '&autoplay=1' : ''}`;
const ytThumb = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

function Media({ it, grande, onAbrir }: { it: Item; grande?: boolean; onAbrir?: () => void }) {
  if (it.tipo === 'foto') {
    return (
      <button type="button" onClick={onAbrir} className={`group relative h-full w-full ${onAbrir ? 'cursor-zoom-in' : 'cursor-default'}`} aria-label="Ver en pantalla grande">
        <img src={it.url} alt="" className="h-full w-full object-contain" draggable={false} />
        {onAbrir && <span className="absolute bottom-2 right-2 rounded-full bg-black/50 p-1.5 text-white opacity-80 transition group-hover:opacity-100"><Expand size={16} /></span>}
      </button>
    );
  }
  if (it.tipo === 'video') {
    return <video key={it.url} src={it.url} controls playsInline autoPlay muted loop preload="metadata" className="h-full w-full object-contain" />;
  }
  return <iframe key={it.url} src={ytEmbed(it.url, grande)} title="Video del producto" className="h-full w-full" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowFullScreen />;
}

function Miniatura({ it }: { it: Item }) {
  if (it.tipo === 'foto') return <img src={it.url} alt="" className="h-full w-full object-cover" loading="lazy" />;
  return (
    <span className="relative block h-full w-full bg-slate-900">
      {it.tipo === 'youtube'
        ? <img src={ytThumb(it.url)} alt="" className="h-full w-full object-cover" loading="lazy" />
        : <video src={`${it.url}#t=0.5`} muted playsInline preload="metadata" className="h-full w-full object-cover" />}
      <span className="absolute inset-0 flex items-center justify-center"><span className="rounded-full bg-black/60 p-1.5 text-white"><Play size={14} fill="currentColor" /></span></span>
    </span>
  );
}

function Visor({ items, inicio, onClose }: { items: Item[]; inicio: number; onClose: () => void }) {
  const [i, setI] = useState(inicio);
  const toque = useRef<number | null>(null);
  const n = items.length;
  const mover = useCallback((d: number) => setI((x) => (x + d + n) % n), [n]);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
      else if (e.key === 'ArrowRight') mover(1);
      else if (e.key === 'ArrowLeft') mover(-1);
    };
    window.addEventListener('keydown', tecla, true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', tecla, true); document.body.style.overflow = prev; };
  }, [mover, onClose]);

  const it = items[i];
  return createPortal(
    <div className="fixed inset-0 z-[100] flex flex-col bg-black/95" onClick={onClose}
      onTouchStart={(e) => { toque.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        if (toque.current == null) return;
        const dx = e.changedTouches[0].clientX - toque.current;
        toque.current = null;
        if (Math.abs(dx) > 50) mover(dx < 0 ? 1 : -1);
      }}>
      <div className="flex items-center justify-between p-3 text-sm text-white/80">
        <span>{i + 1} / {n}</span>
        <button onClick={onClose} className="rounded-full p-2 hover:bg-white/10" aria-label="Cerrar"><X size={24} /></button>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 pb-2 sm:px-16" onClick={(e) => e.stopPropagation()}>
        <div className={it.tipo === 'youtube' ? 'aspect-video w-full max-w-5xl' : 'h-full w-full'}>
          {it.tipo === 'foto'
            ? <img src={it.url} alt="" className="h-full w-full select-none object-contain" draggable={false} />
            : <Media it={it} grande />}
        </div>
        {n > 1 && (
          <>
            <button onClick={() => mover(-1)} className="absolute left-1 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/25 sm:left-3 sm:p-3" aria-label="Anterior"><ChevronLeft size={28} /></button>
            <button onClick={() => mover(1)} className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/25 sm:right-3 sm:p-3" aria-label="Siguiente"><ChevronRight size={28} /></button>
          </>
        )}
      </div>
      {n > 1 && (
        <div className="flex justify-center gap-2 overflow-x-auto p-3" onClick={(e) => e.stopPropagation()}>
          {items.map((m, k) => (
            <button key={m.id} onClick={() => setI(k)} className={`h-14 w-14 shrink-0 overflow-hidden rounded-md ring-2 ${k === i ? 'ring-white' : 'ring-transparent opacity-60 hover:opacity-100'}`}>
              <Miniatura it={m} />
            </button>
          ))}
        </div>
      )}
    </div>,
    document.body,
  );
}

export default function ProductDetail({ p, onClose }: { p: Producto | null; onClose: () => void }) {
  const { add } = useCart();
  const [medios, setMedios] = useState<ProductoMedio[]>([]);
  const [sel, setSel] = useState(0);
  const [selV, setSelV] = useState(0);
  const [visor, setVisor] = useState<number | null>(null);

  useEffect(() => {
    setMedios([]); setSel(0); setSelV(0); setVisor(null);
    if (!p) return;
    let vivo = true;
    supabase.from('producto_medios').select('*').eq('producto_id', p.id).in('estado', ['verificada', 'aprobada'])
      .order('principal', { ascending: false }).order('orden')
      .then(({ data }) => { if (vivo) setMedios(((data as ProductoMedio[]) ?? []).filter(visible)); });
    return () => { vivo = false; };
  }, [p]);

  if (!p) return null;
  let fotos: Item[] = medios.filter((m) => m.tipo === 'foto').map((m) => ({ id: m.id, tipo: 'foto', url: m.url }));
  if (!fotos.length && p.imagen_url) fotos = [{ id: 'img', tipo: 'foto', url: p.imagen_url }];
  const videos: Item[] = [
    ...medios.filter((m) => m.tipo === 'video'),
    ...medios.filter((m) => m.tipo === 'youtube'),
  ].map((m) => ({ id: m.id, tipo: m.tipo as Item['tipo'], url: m.url }));
  const foto = fotos[sel] ?? fotos[0];
  const video = videos[selV] ?? videos[0];

  return (
    <Modal open={!!p} onClose={() => { if (visor === null) onClose(); }} title={p.nombre} wide>
      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-5">
          <section>
            {videos.length > 0 && <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-700"><ImageIcon size={16} /> Fotos</p>}
            <div className="aspect-square overflow-hidden rounded-2xl bg-white ring-1 ring-slate-100">
              {foto
                ? <Media it={foto} onAbrir={() => setVisor(fotos.indexOf(foto))} />
                : <div className="flex h-full items-center justify-center bg-gradient-to-br from-royal-50 to-slate-100 text-royal-200"><Package size={80} /></div>}
            </div>
            {fotos.length > 1 && (
              <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                {fotos.map((m, i) => (
                  <button key={m.id} onClick={() => setSel(i)} className={`h-16 w-16 shrink-0 overflow-hidden rounded-lg ring-2 ${foto === m ? 'ring-royal-600' : 'ring-transparent'}`} aria-label={`Foto ${i + 1}`}>
                    <Miniatura it={m} />
                  </button>
                ))}
              </div>
            )}
          </section>
          {video && (
            <section>
              <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-700"><PlayCircle size={16} /> Videos</p>
              <div className={`overflow-hidden rounded-2xl ring-1 ring-slate-100 ${video.tipo === 'youtube' ? 'aspect-video bg-black' : 'aspect-square bg-white'}`}>
                <Media it={video} />
              </div>
              {videos.length > 1 && (
                <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                  {videos.map((m, i) => (
                    <button key={m.id} onClick={() => setSelV(i)} className={`h-16 w-16 shrink-0 overflow-hidden rounded-lg ring-2 ${video === m ? 'ring-royal-600' : 'ring-transparent'}`} aria-label={`Video ${i + 1}`}>
                      <Miniatura it={m} />
                    </button>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
        <div className="flex flex-col">
          {p.codigo && <p className="text-xs font-semibold text-slate-500">Código {p.codigo}</p>}
          <p className="mt-1 text-3xl font-bold text-royal-700">{p.precio > 0 ? pesos(p.precio) : 'Sin precio'}</p>
          <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-slate-600">{p.descripcion || 'Sin descripción.'}</p>
          <button className="btn-primary mt-6 md:mt-auto" onClick={() => { add(p); onClose(); }}><Plus size={18} /> Agregar al cotizador</button>
        </div>
      </div>
      {visor !== null && fotos.length > 0 && <Visor items={fotos} inicio={visor} onClose={() => setVisor(null)} />}
    </Modal>
  );
}
