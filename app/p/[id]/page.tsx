import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChefHat, MessageCircle, PlayCircle, Package } from 'lucide-react';
import RecetaFotos from '@/components/RecetaFotos';
import { Rastreo, BotonWa } from '@/components/Rastreo';
import { anonimo, uuidOk, waLink } from '@/lib/publico';
import { utensilioDeProducto } from '@/lib/recetas';

export const revalidate = 300;

type Producto = { id: number; codigo: string | null; nombre: string; descripcion: string | null; imagen_url: string | null; categoria: string };
type Medio = { tipo: 'foto' | 'video' | 'youtube'; url: string };
type Vendedor = { nombre: string | null; celular: string | null } | null;
type RecetaMini = { slug: string; titulo: string; foto: string | null; video: boolean };
type Props = { params: { id: string }; searchParams: { v?: string } };

async function cargar(id: string, v?: string) {
  const n = Number(id);
  if (!Number.isInteger(n)) return { producto: null, medios: [] as Medio[], vendedor: null as Vendedor, recetas: [] as RecetaMini[] };
  const sb = anonimo();
  const { data } = await sb.rpc('producto_publico', { p_id: n, p_vendedor: uuidOk(v) });
  const d = (data ?? {}) as { producto: Producto | null; medios: Medio[]; vendedor: Vendedor };
  let recetas: RecetaMini[] = [];
  const ut = d.producto ? utensilioDeProducto(d.producto.nombre) : null;
  if (ut) recetas = ((await sb.rpc('recetas_de_utensilio', { p_utensilio: ut, p_limite: 12 })).data as RecetaMini[]) ?? [];
  return { producto: d.producto ?? null, medios: d.medios ?? [], vendedor: d.vendedor ?? null, recetas };
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { producto, medios } = await cargar(params.id, searchParams.v);
  if (!producto) return { title: 'Royal Prestige' };
  const foto = medios.find((m) => m.tipo === 'foto')?.url ?? producto.imagen_url;
  const desc = (producto.descripcion ?? 'Productos Royal Prestige®').slice(0, 180);
  return { title: `${producto.nombre} · Royal Prestige`, description: desc, openGraph: { title: producto.nombre, description: desc, images: foto ? [{ url: foto }] : [] }, robots: { index: false } };
}

export default async function ProductoPublico({ params, searchParams }: Props) {
  const { producto: p, medios, vendedor, recetas } = await cargar(params.id, searchParams.v);
  if (!p) notFound();
  const v = vendedor ? uuidOk(searchParams.v) : null;
  const ref = String(p.id);
  const fotos = medios.filter((m) => m.tipo === 'foto').map((m) => m.url);
  if (!fotos.length && p.imagen_url) fotos.push(p.imagen_url);
  const videos = medios.filter((m) => m.tipo !== 'foto');
  const wa = waLink(vendedor?.celular, `Hola ${vendedor?.nombre ?? ''}! Vi el producto "${p.nombre}" y quiero consultarte por precio y formas de pago.`);
  const q = v ? `?v=${v}` : '';

  return (
    <div className="min-h-screen bg-slate-50 pb-28">
      <Rastreo v={v} tipo="producto" refId={ref} titulo={p.nombre} />
      <header className="bg-gradient-to-r from-royal-800 to-royal-600 px-4 py-3 text-white">
        <div className="mx-auto flex max-w-3xl items-center gap-2">
          <img src="/logo.png" alt="" className="h-8 w-8 rounded-lg bg-white object-contain p-0.5" />
          <span className="font-bold">Royal Prestige®</span>
        </div>
      </header>
      <main className="mx-auto max-w-3xl space-y-5 p-4">
        <div>
          <h1 className="text-2xl font-bold leading-tight text-royal-900 md:text-3xl">{p.nombre}</h1>
          {p.codigo && <p className="mt-1 text-xs font-semibold text-slate-500">Código {p.codigo}</p>}
        </div>
        {fotos.length > 0 ? <RecetaFotos fotos={fotos} titulo={p.nombre} /> : (
          <div className="flex aspect-[16/10] items-center justify-center rounded-2xl bg-gradient-to-br from-royal-50 to-slate-100 text-royal-200"><Package size={80} /></div>
        )}
        {p.descripcion && <div className="whitespace-pre-line rounded-2xl bg-white p-5 text-sm leading-relaxed text-slate-700 shadow-sm ring-1 ring-slate-100">{p.descripcion}</div>}

        {videos.length > 0 && (
          <section className="space-y-3">
            <h2 className="flex items-center gap-1.5 font-bold text-royal-900"><PlayCircle size={18} /> Videos</h2>
            {videos.slice(0, 3).map((m, i) => (
              <div key={i} className={`overflow-hidden rounded-2xl ${m.tipo === 'youtube' ? 'aspect-video bg-black' : 'bg-white ring-1 ring-slate-100'}`}>
                {m.tipo === 'video'
                  ? <video src={m.url} controls playsInline muted loop preload="metadata" className="max-h-[70vh] w-full object-contain" />
                  : <iframe src={`https://www.youtube-nocookie.com/embed/${m.url}?rel=0&modestbranding=1&playsinline=1&vq=large`} title={p.nombre} className="h-full w-full" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowFullScreen loading="lazy" />}
              </div>
            ))}
          </section>
        )}

        {recetas.length > 0 && (
          <section>
            <h2 className="mb-2 flex items-center gap-1.5 font-bold text-royal-900"><ChefHat size={18} /> Recetas para cocinar con este producto</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {recetas.map((r) => (
                <Link key={r.slug} href={`/r/${r.slug}${q}`} className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
                  <div className="relative aspect-[4/3] bg-slate-100">
                    {r.foto ? <img src={r.foto} alt="" loading="lazy" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-slate-300"><ChefHat size={36} /></div>}
                    {r.video && <span className="absolute left-2 top-2 rounded-full bg-black/60 p-1 text-white"><PlayCircle size={14} /></span>}
                  </div>
                  <p className="line-clamp-2 p-2.5 text-sm font-semibold leading-snug text-slate-800">{r.titulo}</p>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="rounded-2xl bg-gradient-to-br from-royal-800 to-royal-600 p-5 text-white">
          <p className="text-xs uppercase tracking-wide text-white/70">{vendedor ? 'Tu asesor Royal Prestige®' : 'Royal Prestige®'}</p>
          <p className="text-lg font-bold">{vendedor?.nombre ?? 'Cociná más sano, sin agua ni aceite'}</p>
          <p className="mt-2 text-sm text-white/85">Consultá precio, planes de cuotas o pedí una demostración sin compromiso.</p>
          {wa && <BotonWa href={wa} v={v} tipo="producto" refId={ref} titulo={p.nombre} className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 font-bold text-white shadow hover:bg-emerald-600"><MessageCircle size={18} /> Escribime por WhatsApp</BotonWa>}
        </section>
      </main>
      {wa && (
        <BotonWa href={wa} v={v} tipo="producto" refId={ref} titulo={p.nombre} className="fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-md items-center justify-center gap-2 rounded-full bg-emerald-500 px-5 py-3.5 font-bold text-white shadow-xl md:hidden">
          <MessageCircle size={18} /> Consultar a {vendedor?.nombre?.split(' ')[0] ?? 'tu asesor'}
        </BotonWa>
      )}
    </div>
  );
}
