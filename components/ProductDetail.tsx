'use client';
import { useEffect, useState } from 'react';
import { Package, Plus, PlayCircle } from 'lucide-react';
import type { Producto, ProductoMedio } from '@/lib/types';
import { pesos } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { Modal } from './ui';
import { useCart } from './CartProvider';

const visible = (m: ProductoMedio) => m.estado === 'verificada' || m.estado === 'aprobada';

export default function ProductDetail({ p, onClose }: { p: Producto | null; onClose: () => void }) {
  const { add } = useCart();
  const [medios, setMedios] = useState<ProductoMedio[]>([]);
  const [sel, setSel] = useState(0);

  useEffect(() => {
    setMedios([]); setSel(0);
    if (!p) return;
    let vivo = true;
    supabase.from('producto_medios').select('*').eq('producto_id', p.id).in('estado', ['verificada', 'aprobada'])
      .order('principal', { ascending: false }).order('orden')
      .then(({ data }) => { if (vivo) setMedios(((data as ProductoMedio[]) ?? []).filter(visible)); });
    return () => { vivo = false; };
  }, [p]);

  if (!p) return null;
  const fotos = medios.filter((m) => m.tipo === 'foto');
  const videos = medios.filter((m) => m.tipo !== 'foto');
  const actual = fotos[sel]?.url ?? p.imagen_url;

  return (
    <Modal open={!!p} onClose={onClose} title={p.nombre} wide>
      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <div className="aspect-square overflow-hidden rounded-2xl bg-white ring-1 ring-slate-100">
            {actual ? <img src={actual} alt={p.nombre} className="h-full w-full object-contain" /> : <div className="flex h-full items-center justify-center bg-gradient-to-br from-royal-50 to-slate-100 text-royal-200"><Package size={80} /></div>}
          </div>
          {fotos.length > 1 && (
            <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
              {fotos.map((f, i) => (
                <button key={f.id} onClick={() => setSel(i)} className={`h-16 w-16 shrink-0 overflow-hidden rounded-lg ring-2 ${i === sel ? 'ring-royal-600' : 'ring-transparent'}`} aria-label={`Foto ${i + 1}`}>
                  <img src={f.url} alt="" className="h-full w-full object-cover" loading="lazy" />
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-col">
          {p.codigo && <p className="text-xs font-semibold text-slate-500">Código {p.codigo}</p>}
          <p className="mt-1 text-3xl font-bold text-royal-700">{p.precio > 0 ? pesos(p.precio) : 'Sin precio'}</p>
          <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-slate-600">{p.descripcion || 'Sin descripción.'}</p>
          <button className="btn-primary mt-6 md:mt-auto" onClick={() => { add(p); onClose(); }}><Plus size={18} /> Agregar al cotizador</button>
        </div>
      </div>
      {videos.length > 0 && (
        <div className="mt-6">
          <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-700"><PlayCircle size={17} /> Videos</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {videos.map((v) => (
              <div key={v.id} className="aspect-video overflow-hidden rounded-xl bg-black">
                {v.tipo === 'video'
                  ? <video src={v.url} controls playsInline preload="metadata" className="h-full w-full object-contain" />
                  : <iframe src={`https://www.youtube-nocookie.com/embed/${v.url}?rel=0`} title="Video del producto" className="h-full w-full" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowFullScreen loading="lazy" />}
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}
