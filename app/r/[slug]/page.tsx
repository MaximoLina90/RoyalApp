import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { Clock, Users, ChefHat, MessageCircle, PlayCircle } from 'lucide-react';
import RecetaFotos from '@/components/RecetaFotos';
import { UTENSILIOS, esTitulo } from '@/lib/recetas';

export const revalidate = 300;

type Receta = {
  slug: string; titulo: string; descripcion: string | null; porciones: string | null; tiempo_min: number | null;
  ingredientes: string[]; pasos: string[]; tips: string | null; utensilios: string[]; fotos: string[];
  video_tipo: 'mp4' | 'youtube' | null; video_url: string | null; productos_royal: string[];
};
type Vendedor = { nombre: string | null; celular: string | null } | null;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function cargar(slug: string, v?: string): Promise<{ receta: Receta | null; vendedor: Vendedor }> {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  const { data } = await sb.rpc('receta_publica', { p_slug: slug, p_vendedor: v && UUID.test(v) ? v : null });
  return (data as { receta: Receta | null; vendedor: Vendedor }) ?? { receta: null, vendedor: null };
}

/** Celular argentino → dígitos para wa.me (549…). */
function waNumero(cel: string) {
  let d = cel.replace(/\D/g, '');
  if (d.startsWith('549')) return d;
  if (d.startsWith('54')) d = d.slice(2);
  d = d.replace(/^0/, '');
  if (d.length === 12) for (const n of [2, 3, 4]) if (d.slice(n, n + 2) === '15') { d = d.slice(0, n) + d.slice(n + 2); break; }
  return '549' + d;
}

type Props = { params: { slug: string }; searchParams: { v?: string } };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { receta } = await cargar(params.slug, searchParams.v);
  if (!receta) return { title: 'Receta Royal Prestige' };
  const desc = receta.descripcion ?? 'Receta paso a paso con productos Royal Prestige®';
  return {
    title: `${receta.titulo} · Receta Royal Prestige`,
    description: desc,
    openGraph: { title: receta.titulo, description: desc, images: receta.fotos[0] ? [{ url: receta.fotos[0] }] : [], type: 'article' },
    robots: { index: false },
  };
}

export default async function RecetaPublica({ params, searchParams }: Props) {
  const { receta: r, vendedor } = await cargar(params.slug, searchParams.v);
  if (!r) notFound();
  const wa = vendedor?.celular
    ? `https://wa.me/${waNumero(vendedor.celular)}?text=${encodeURIComponent(`Hola ${vendedor.nombre ?? ''}! Vi la receta "${r.titulo}" y quiero consultarte por los productos Royal Prestige.`)}`
    : null;
  let n = 0;

  return (
    <div className="min-h-screen bg-slate-50 pb-28">
      <header className="bg-gradient-to-r from-royal-800 to-royal-600 px-4 py-3 text-white">
        <div className="mx-auto flex max-w-3xl items-center gap-2">
          <img src="/logo.png" alt="" className="h-8 w-8 rounded-lg bg-white object-contain p-0.5" />
          <span className="font-bold">Recetas Royal Prestige®</span>
        </div>
      </header>
      <main className="mx-auto max-w-3xl space-y-5 p-4">
        <h1 className="text-2xl font-bold leading-tight text-royal-900 md:text-3xl">{r.titulo}</h1>
        <RecetaFotos fotos={r.fotos} titulo={r.titulo} />
        <div className="flex flex-wrap gap-2 text-xs">
          {r.tiempo_min ? <span className="flex items-center gap-1 rounded-full bg-white px-2.5 py-1 font-medium text-slate-700 ring-1 ring-slate-200"><Clock size={13} />{r.tiempo_min} min</span> : null}
          {r.porciones && <span className="flex items-center gap-1 rounded-full bg-white px-2.5 py-1 font-medium text-slate-700 ring-1 ring-slate-200"><Users size={13} />{r.porciones} porciones</span>}
          {r.utensilios.filter((u) => u !== 'otro_royal').map((u) => <span key={u} className="rounded-full bg-royal-50 px-2.5 py-1 font-semibold text-royal-700">{UTENSILIOS[u] ?? u}</span>)}
        </div>
        {r.descripcion && <p className="leading-relaxed text-slate-600">{r.descripcion}</p>}

        <div className="grid gap-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100 md:grid-cols-5">
          {r.ingredientes.length > 0 && (
            <section className="md:col-span-2">
              <h2 className="mb-2 font-bold text-royal-900">Ingredientes</h2>
              <ul className="space-y-1.5 text-sm text-slate-700">
                {r.ingredientes.map((i, k) => esTitulo(i)
                  ? <li key={k} className="pt-2 text-xs font-bold uppercase tracking-wide text-royal-800 first:pt-0">{i.replace(/:\s*$/, '')}</li>
                  : <li key={k} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-royal-400" />{i}</li>)}
              </ul>
            </section>
          )}
          <section className={r.ingredientes.length ? 'md:col-span-3' : 'md:col-span-5'}>
            <h2 className="mb-2 font-bold text-royal-900">Preparación</h2>
            <ol className="space-y-2.5">
              {r.pasos.map((p, k) => esTitulo(p)
                ? <li key={k} className="pt-2 text-xs font-bold uppercase tracking-wide text-royal-800">{p.replace(/:\s*$/, '')}</li>
                : <li key={k} className="flex gap-3 text-sm"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-royal-100 text-xs font-bold text-royal-700">{++n}</span><span className="leading-relaxed text-slate-700">{p}</span></li>)}
            </ol>
          </section>
        </div>
        {r.tips && <div className="whitespace-pre-line rounded-xl bg-amber-50 p-3 text-sm text-amber-900"><b>Tip:</b> {r.tips}</div>}

        {r.video_url && (
          <section>
            <h2 className="mb-2 flex items-center gap-1.5 font-bold text-royal-900"><PlayCircle size={18} /> Video</h2>
            <div className="aspect-video overflow-hidden rounded-2xl bg-black">
              {r.video_tipo === 'mp4'
                ? <video src={r.video_url} controls playsInline preload="metadata" className="h-full w-full object-contain" />
                : <iframe src={`https://www.youtube-nocookie.com/embed/${r.video_url}?rel=0&modestbranding=1&playsinline=1&vq=large`} title={r.titulo} className="h-full w-full" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowFullScreen loading="lazy" />}
            </div>
          </section>
        )}

        <section className="rounded-2xl bg-gradient-to-br from-royal-800 to-royal-600 p-5 text-white">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15"><ChefHat size={22} /></span>
            <div>
              <p className="text-xs uppercase tracking-wide text-white/70">{vendedor ? 'Tu asesor Royal Prestige®' : 'Royal Prestige®'}</p>
              <p className="text-lg font-bold">{vendedor?.nombre ?? 'Cociná más sano, sin agua ni aceite'}</p>
            </div>
          </div>
          <p className="mt-3 text-sm text-white/85">¿Querés cocinar esta receta con los productos Royal Prestige®? Pedí una demostración sin compromiso.</p>
          {wa && <a href={wa} target="_blank" rel="noreferrer" className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 font-bold text-white shadow hover:bg-emerald-600"><MessageCircle size={18} /> Escribime por WhatsApp</a>}
        </section>
      </main>
      {wa && (
        <a href={wa} target="_blank" rel="noreferrer" className="fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-md items-center justify-center gap-2 rounded-full bg-emerald-500 px-5 py-3.5 font-bold text-white shadow-xl md:hidden">
          <MessageCircle size={18} /> Consultar a {vendedor?.nombre?.split(' ')[0] ?? 'tu asesor'}
        </a>
      )}
    </div>
  );
}
