'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChefHat, Clock, Users, Search, Heart, PlayCircle, ExternalLink, Share2, Star, EyeOff, Eye, Trash2, X, Expand, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';
import { PageHeader, Empty, Modal, Spinner } from '@/components/ui';
import { Visor, type Item } from '@/components/ProductDetail';

interface Receta {
  id: string; slug: string; titulo: string; descripcion: string | null; porciones: string | null; tiempo_min: number | null;
  dificultad: 'facil' | 'media' | 'dificil' | null; ingredientes: string[]; pasos: string[]; tips: string | null;
  categorias: string[]; utensilios: string[]; fotos: string[]; video_tipo: 'mp4' | 'youtube' | null; video_url: string | null;
  fuente_nombre: string | null; fuente_url: string | null; fuente_tipo: 'oficial' | 'extraoficial'; pais: string | null;
  traducida: boolean; destacado: boolean; activo: boolean; productos_royal: string[]; solo_otro_royal: boolean;
}

const UTENSILIOS: Record<string, string> = {
  olla_presion: 'Olla de presión', ollas_novel: 'Ollas', sarten: 'Sartenes', sarten_gourmet: 'Sartén Gourmet',
  deluxe_easy_release: 'Deluxe Easy Release', paellera: 'Paellera', plancha_parrilla: 'Planchas y parrilla', pavera: 'Pavera',
  casserole: 'Casserole', olla_grande: 'Ollas grandes', maxtractor: 'Maxtractor (jugos)', smart_temp: 'Smart Temp',
  chocolatera: 'Chocolatera', expertea: 'ExperTea', espresso: 'Espresso', barista: 'Barista', cuchillos: 'Cuchillos',
  tazones: 'Tazones', otro_royal: 'Otros Royal',
};
const CATEGORIAS: Record<string, string> = {
  desayuno: 'Desayuno', entradas_snacks: 'Entradas y snacks', carnes: 'Carnes', pollo: 'Pollo', pescados_mariscos: 'Pescados y mariscos',
  pastas_arroces: 'Pastas y arroces', sopas_guisos: 'Sopas y guisos', vegetariano: 'Vegetariano', ensaladas: 'Ensaladas',
  postres: 'Postres', panes_masas: 'Panes y masas', bebidas: 'Bebidas', salsas_aderezos: 'Salsas y aderezos',
};
const DIF: Record<string, string> = { facil: 'Fácil', media: 'Media', dificil: 'Difícil' };
const ytThumb = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
const portada = (r: Receta) => r.fotos[0] ?? (r.video_tipo === 'youtube' && r.video_url ? ytThumb(r.video_url) : null);
const esTitulo = (l: string) => { const t = l.trim(); return t.length < 70 && !/^\d/.test(t) && (t.endsWith(':') || /^(decoraci[oó]n|para (el|la|los|las|decorar|servir|montar))\b/i.test(t) && !/\d/.test(t)); };
const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

function Chip({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${activo ? 'bg-royal-600 text-white shadow' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'}`}>
      {children}
    </button>
  );
}

export default function Recetas() {
  const { profile } = useAuth();
  const esAdmin = profile?.rol === 'admin';
  const [items, setItems] = useState<Receta[] | null>(null);
  const [favs, setFavs] = useState<Set<string>>(new Set());
  const [txt, setTxt] = useState('');
  const [ut, setUt] = useState<string | null>(null);
  const [cat, setCat] = useState<string | null>(null);
  const [soloFav, setSoloFav] = useState(false);
  const [soloVideo, setSoloVideo] = useState(false);
  const [fuente, setFuente] = useState<'todas' | 'oficial' | 'extraoficial'>('todas');
  const [ver, setVer] = useState<Receta | null>(null);

  const cargar = useCallback(async () => {
    const [{ data }, { data: f }] = await Promise.all([
      supabase.from('recetas').select('*').order('destacado', { ascending: false }).order('titulo'),
      supabase.from('recetas_favoritas').select('receta_id'),
    ]);
    setItems((data as Receta[]) ?? []);
    setFavs(new Set(((f as { receta_id: string }[]) ?? []).map((x) => x.receta_id)));
  }, []);
  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => {
    const u = new URLSearchParams(window.location.search).get('utensilio');
    if (u && UTENSILIOS[u]) setUt(u);
  }, []);

  const base = useMemo(() => (items ?? []).filter((r) => esAdmin || r.activo), [items, esAdmin]);
  const filtradas = useMemo(() => {
    const t = norm(txt.trim());
    return base.filter((r) =>
      (!ut || r.utensilios.includes(ut)) && (!cat || r.categorias.includes(cat)) &&
      (!soloFav || favs.has(r.id)) && (!soloVideo || !!r.video_url) && (fuente === 'todas' || r.fuente_tipo === fuente) &&
      (!t || norm(r.titulo).includes(t) || r.ingredientes.some((i) => norm(i).includes(t))));
  }, [base, txt, ut, cat, soloFav, soloVideo, fuente, favs]);
  const cuenta = (campo: 'utensilios' | 'categorias', k: string) => base.filter((r) => r[campo].includes(k)).length;
  const uts = Object.keys(UTENSILIOS).filter((k) => cuenta('utensilios', k) > 0);
  const cats = Object.keys(CATEGORIAS).filter((k) => cuenta('categorias', k) > 0);

  const toggleFav = async (r: Receta) => {
    const n = new Set(favs);
    if (n.has(r.id)) { n.delete(r.id); setFavs(n); await supabase.from('recetas_favoritas').delete().eq('receta_id', r.id); }
    else { n.add(r.id); setFavs(n); await supabase.from('recetas_favoritas').insert({ receta_id: r.id }); }
  };
  const actualizar = async (r: Receta, cambios: Partial<Receta>) => {
    await supabase.from('recetas').update(cambios).eq('id', r.id);
    setItems((xs) => (xs ?? []).map((x) => (x.id === r.id ? { ...x, ...cambios } : x)));
    setVer((v) => (v && v.id === r.id ? { ...v, ...cambios } : v));
  };
  const borrar = async (r: Receta) => {
    if (!confirm(`¿Borrar "${r.titulo}"?`)) return;
    await supabase.from('recetas').delete().eq('id', r.id);
    setItems((xs) => (xs ?? []).filter((x) => x.id !== r.id)); setVer(null);
  };
  const hayFiltros = ut || cat || soloFav || soloVideo || fuente !== 'todas' || txt;

  return (
    <div>
      <PageHeader title="Recetas Royal" subtitle="Recetas para tus demostraciones y clientes" />
      {items === null ? <Spinner /> : base.length === 0 ? (
        <Empty icon={<ChefHat size={30} />} title="Todavía no hay recetas" text="Pronto vas a encontrar recetas paso a paso para cocinar con los productos Royal Prestige®." />
      ) : (
        <>
          <div className="space-y-3">
            <div className="relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={txt} onChange={(e) => setTxt(e.target.value)} placeholder="Buscar por nombre o ingrediente…" className="input pl-10" />
            </div>
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Utensilio</p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                <Chip activo={!ut} onClick={() => setUt(null)}>Todos</Chip>
                {uts.map((k) => <Chip key={k} activo={ut === k} onClick={() => setUt(ut === k ? null : k)}>{UTENSILIOS[k]} <span className="opacity-60">{cuenta('utensilios', k)}</span></Chip>)}
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Tipo de comida</p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                <Chip activo={!cat} onClick={() => setCat(null)}>Todas</Chip>
                {cats.map((k) => <Chip key={k} activo={cat === k} onClick={() => setCat(cat === k ? null : k)}>{CATEGORIAS[k]} <span className="opacity-60">{cuenta('categorias', k)}</span></Chip>)}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Chip activo={soloFav} onClick={() => setSoloFav(!soloFav)}><Heart size={12} className="-mt-0.5 mr-1 inline" />Favoritas</Chip>
              <Chip activo={soloVideo} onClick={() => setSoloVideo(!soloVideo)}><PlayCircle size={12} className="-mt-0.5 mr-1 inline" />Con video</Chip>
              <Chip activo={fuente === 'oficial'} onClick={() => setFuente(fuente === 'oficial' ? 'todas' : 'oficial')}>Oficiales</Chip>
              <Chip activo={fuente === 'extraoficial'} onClick={() => setFuente(fuente === 'extraoficial' ? 'todas' : 'extraoficial')}>De la comunidad</Chip>
              {hayFiltros && <button onClick={() => { setUt(null); setCat(null); setSoloFav(false); setSoloVideo(false); setFuente('todas'); setTxt(''); }} className="ml-auto flex items-center gap-1 text-xs font-semibold text-royal-700"><X size={13} /> Limpiar</button>}
            </div>
          </div>
          <p className="mb-3 mt-4 text-sm text-slate-500">{filtradas.length} {filtradas.length === 1 ? 'receta' : 'recetas'}</p>
          {filtradas.length === 0 ? <Empty icon={<ChefHat size={30} />} title="Sin resultados" text="Probá con otro filtro." /> : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {filtradas.map((r) => {
                const img = portada(r);
                return (
                  <button key={r.id} onClick={() => setVer(r)} className={`group overflow-hidden rounded-2xl bg-white text-left shadow-sm ring-1 ring-slate-100 transition hover:shadow-md ${!r.activo ? 'opacity-50' : ''}`}>
                    <div className="relative aspect-[4/3] bg-slate-100">
                      {img ? <img src={img} alt="" loading="lazy" className="h-full w-full object-cover transition group-hover:scale-105" /> : <div className="flex h-full items-center justify-center text-slate-300"><ChefHat size={40} /></div>}
                      {r.video_url && <span className="absolute left-2 top-2 rounded-full bg-black/60 p-1 text-white"><PlayCircle size={16} /></span>}
                      {favs.has(r.id) && <span className="absolute right-2 top-2 rounded-full bg-white/90 p-1 text-rose-500"><Heart size={14} fill="currentColor" /></span>}
                      {r.destacado && <span className="absolute bottom-2 left-2 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-amber-950">Destacada</span>}
                    </div>
                    <div className="p-3">
                      <p className="line-clamp-2 text-sm font-semibold leading-snug text-slate-800">{r.titulo}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500">
                        {r.tiempo_min ? <span className="flex items-center gap-0.5"><Clock size={11} />{r.tiempo_min} min</span> : null}
                        {r.utensilios[0] && <span className="truncate">{UTENSILIOS[r.utensilios[0]] ?? r.utensilios[0]}</span>}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}
      {ver && <DetalleReceta r={ver} fav={favs.has(ver.id)} onFav={() => toggleFav(ver)} onClose={() => setVer(null)} esAdmin={esAdmin} onActualizar={(c) => actualizar(ver, c)} onBorrar={() => borrar(ver)} />}
    </div>
  );
}

function DetalleReceta({ r, fav, onFav, onClose, esAdmin, onActualizar, onBorrar }: {
  r: Receta; fav: boolean; onFav: () => void; onClose: () => void; esAdmin: boolean; onActualizar: (c: Partial<Receta>) => void; onBorrar: () => void;
}) {
  const [sel, setSel] = useState(0);
  const [visor, setVisor] = useState<number | null>(null);
  const [hechos, setHechos] = useState<Set<number>>(new Set());
  const fotos: Item[] = r.fotos.map((u, i) => ({ id: `f${i}`, tipo: 'foto', url: u }));

  const compartir = async () => {
    const t = `*${r.titulo}*\n\n${r.descripcion ? r.descripcion + '\n\n' : ''}Ingredientes:\n${r.ingredientes.map((i) => '• ' + i).join('\n')}\n\nPreparación:\n${r.pasos.map((p, i) => `${i + 1}. ${p}`).join('\n')}${r.video_tipo === 'youtube' && r.video_url ? `\n\nVideo: https://youtu.be/${r.video_url}` : ''}`;
    if (navigator.share) { try { await navigator.share({ title: r.titulo, text: t }); return; } catch { /* cancelado */ } }
    window.open(`https://wa.me/?text=${encodeURIComponent(t)}`, '_blank');
  };

  return (
    <Modal open onClose={() => { if (visor === null) onClose(); }} title={r.titulo} wide>
      <div className="space-y-5">
        {fotos.length > 0 && (
          <section>
            <button onClick={() => setVisor(sel)} className="group relative block aspect-[16/10] w-full cursor-zoom-in overflow-hidden rounded-2xl bg-slate-100">
              <img src={fotos[sel].url} alt={r.titulo} className="h-full w-full object-cover" />
              <span className="absolute bottom-2 right-2 rounded-full bg-black/50 p-1.5 text-white opacity-80 group-hover:opacity-100"><Expand size={16} /></span>
            </button>
            {fotos.length > 1 && (
              <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                {fotos.map((f, i) => (
                  <button key={f.id} onClick={() => setSel(i)} className={`h-14 w-14 shrink-0 overflow-hidden rounded-lg ring-2 ${i === sel ? 'ring-royal-600' : 'ring-transparent'}`}>
                    <img src={f.url} alt="" className="h-full w-full object-cover" loading="lazy" />
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        <div className="flex flex-wrap items-center gap-2 text-xs">
          {r.tiempo_min ? <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700"><Clock size={13} />{r.tiempo_min} min</span> : null}
          {r.porciones && <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700"><Users size={13} />{r.porciones}</span>}
          {r.dificultad && <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700">{DIF[r.dificultad]}</span>}
          {r.utensilios.map((u) => <span key={u} className="rounded-full bg-royal-50 px-2.5 py-1 font-semibold text-royal-700">{UTENSILIOS[u] ?? u}</span>)}
          {r.categorias.map((c) => <span key={c} className="rounded-full bg-amber-50 px-2.5 py-1 font-semibold text-amber-700">{CATEGORIAS[c] ?? c}</span>)}
        </div>
        {r.descripcion && <p className="text-sm leading-relaxed text-slate-600">{r.descripcion}</p>}

        <div className="flex flex-wrap gap-2">
          <button onClick={onFav} className={`btn-secondary ${fav ? 'text-rose-600' : ''}`}><Heart size={16} fill={fav ? 'currentColor' : 'none'} /> {fav ? 'En favoritas' : 'Guardar'}</button>
          <button onClick={compartir} className="btn-secondary"><Share2 size={16} /> Compartir</button>
        </div>

        <div className="grid gap-6 md:grid-cols-5">
          {r.ingredientes.length > 0 && (
            <section className="md:col-span-2">
              <h3 className="mb-2 font-bold text-royal-900">Ingredientes</h3>
              <ul className="space-y-1.5 text-sm text-slate-700">
                {r.ingredientes.map((i, k) => esTitulo(i)
                  ? <li key={k} className="pt-2 text-xs font-bold uppercase tracking-wide text-royal-800 first:pt-0">{i.replace(/:\s*$/, '')}</li>
                  : <li key={k} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-royal-400" />{i}</li>)}
              </ul>
            </section>
          )}
          {r.pasos.length > 0 && (
            <section className={r.ingredientes.length ? 'md:col-span-3' : 'md:col-span-5'}>
              <h3 className="mb-2 font-bold text-royal-900">Preparación</h3>
              <ol className="space-y-2">
                {r.pasos.map((p, k) => {
                  if (esTitulo(p)) return <li key={k} className="pt-2 text-xs font-bold uppercase tracking-wide text-royal-800">{p.replace(/:\s*$/, '')}</li>;
                  const n = r.pasos.slice(0, k + 1).filter((x) => !esTitulo(x)).length;
                  const ok = hechos.has(k);
                  return (
                    <li key={k}>
                      <button onClick={() => { const n = new Set(hechos); ok ? n.delete(k) : n.add(k); setHechos(n); }} className="flex w-full gap-3 text-left text-sm">
                        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${ok ? 'bg-emerald-500 text-white' : 'bg-royal-100 text-royal-700'}`}>{ok ? <Check size={14} /> : n}</span>
                        <span className={`leading-relaxed ${ok ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{p}</span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </section>
          )}
        </div>
        {esAdmin && r.solo_otro_royal && <div className="rounded-xl bg-slate-100 p-3 text-xs text-slate-600">Oculta por defecto: usa solo productos que no se venden en Argentina ({r.productos_royal.join(', ') || 'otros Royal'}).</div>}
        {r.tips && <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900"><b>Tip:</b> {r.tips}</div>}

        {r.video_url && (
          <section>
            <h3 className="mb-2 flex items-center gap-1.5 font-bold text-royal-900"><PlayCircle size={18} /> Video</h3>
            <div className="aspect-video overflow-hidden rounded-2xl bg-black">
              {r.video_tipo === 'mp4'
                ? <video src={r.video_url} controls playsInline preload="metadata" className="h-full w-full object-contain" />
                : <iframe src={`https://www.youtube-nocookie.com/embed/${r.video_url}?rel=0&modestbranding=1&playsinline=1&vq=large`} title={r.titulo} className="h-full w-full" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowFullScreen loading="lazy" />}
            </div>
          </section>
        )}

        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
          <span className={`rounded-full px-2 py-0.5 font-semibold ${r.fuente_tipo === 'oficial' ? 'bg-royal-50 text-royal-700' : 'bg-slate-100 text-slate-600'}`}>{r.fuente_tipo === 'oficial' ? 'Receta oficial' : 'De la comunidad'}</span>
          {r.fuente_nombre && <span>Fuente: {r.fuente_nombre}{r.pais ? ` (${r.pais})` : ''}{r.traducida ? ' · traducida' : ''}</span>}
          {r.fuente_url && <a href={r.fuente_url} target="_blank" rel="noreferrer" className="flex items-center gap-0.5 font-semibold text-royal-700">Ver original <ExternalLink size={12} /></a>}
        </div>

        {esAdmin && (
          <div className="flex flex-wrap gap-2 rounded-xl bg-slate-50 p-3">
            <span className="w-full text-xs font-semibold text-slate-500">Administración</span>
            <button onClick={() => onActualizar({ destacado: !r.destacado })} className="btn-secondary text-xs"><Star size={14} fill={r.destacado ? 'currentColor' : 'none'} /> {r.destacado ? 'Quitar destacada' : 'Destacar'}</button>
            <button onClick={() => onActualizar({ activo: !r.activo })} className="btn-secondary text-xs">{r.activo ? <><EyeOff size={14} /> Ocultar</> : <><Eye size={14} /> Mostrar</>}</button>
            <button onClick={onBorrar} className="btn-secondary text-xs text-red-600"><Trash2 size={14} /> Borrar</button>
          </div>
        )}
      </div>
      {visor !== null && <Visor items={fotos} inicio={visor} onClose={() => setVisor(null)} />}
    </Modal>
  );
}
