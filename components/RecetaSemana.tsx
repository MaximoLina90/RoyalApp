'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ChefHat, Share2, Clock, PlayCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './AuthProvider';

interface RS { slug: string; titulo: string; descripcion: string | null; fotos: string[]; video_url: string | null; tiempo_min: number | null }

/** Receta de la semana: tarjeta lista para compartir con el link del vendedor. */
export default function RecetaSemana() {
  const { profile } = useAuth();
  const [r, setR] = useState<RS | null>(null);
  useEffect(() => { supabase.rpc('receta_semana').then(({ data }) => setR((data as RS) ?? null)); }, []);
  if (!r) return null;
  const compartir = async () => {
    const url = `${window.location.origin}/r/${r.slug}${profile?.id ? `?v=${profile.id}` : ''}`;
    const t = `👨‍🍳 Receta de la semana: *${r.titulo}*${r.descripcion ? `\n${r.descripcion}` : ''}\n\nMirá la receta completa${r.video_url ? ' con video' : ''}:`;
    if (navigator.share) { try { await navigator.share({ title: r.titulo, text: t, url }); return; } catch (e) { if ((e as Error)?.name === 'AbortError') return; } }
    window.open(`https://wa.me/?text=${encodeURIComponent(`${t}\n${url}`)}`, '_blank');
  };
  return (
    <div className="card overflow-hidden md:flex">
      {r.fotos[0] && <img src={r.fotos[0]} alt="" className="aspect-[16/9] w-full object-cover md:aspect-auto md:w-2/5" />}
      <div className="flex flex-1 flex-col p-5">
        <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-rose-600"><ChefHat size={14} /> Receta de la semana</p>
        <h2 className="mt-1 text-xl font-bold text-royal-900">{r.titulo}</h2>
        {r.descripcion && <p className="mt-1 line-clamp-3 text-sm text-slate-600">{r.descripcion}</p>}
        <div className="mt-2 flex gap-3 text-xs text-slate-500">
          {r.tiempo_min ? <span className="flex items-center gap-1"><Clock size={12} />{r.tiempo_min} min</span> : null}
          {r.video_url && <span className="flex items-center gap-1"><PlayCircle size={12} />Con video</span>}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 md:mt-auto md:pt-4">
          <button onClick={compartir} className="btn-primary"><Share2 size={16} /> Compartir</button>
          <Link href={`/recetas?receta=${r.slug}`} className="btn-secondary">Ver receta</Link>
        </div>
      </div>
    </div>
  );
}
