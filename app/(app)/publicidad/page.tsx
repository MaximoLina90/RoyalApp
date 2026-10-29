'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Megaphone, Plus, Download, Share2, Copy, MessageCircle, Pencil, Trash2, Loader2, Upload, FileText, Film, Image as ImageIcon, Type, Star } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';
import { PageHeader, Empty, Modal, Spinner, Toast } from '@/components/ui';
import { useToast } from '@/components/useToast';
import RecetaSemana from '@/components/RecetaSemana';

type Tipo = 'imagen' | 'video' | 'pdf' | 'texto';
interface Pieza { id: string; titulo: string; descripcion: string | null; categoria: string; tipo: Tipo; archivo_url: string | null; texto: string | null; destacado: boolean; activo: boolean; vence: string | null; created_at: string }

const CATEGORIAS = ['Promociones', 'Productos', 'Recetas', 'Fechas especiales', 'Testimonios', 'Reclutamiento', 'Institucional'];
const TIPOS: { k: Tipo; l: string; i: JSX.Element }[] = [
  { k: 'imagen', l: 'Imagen', i: <ImageIcon size={15} /> },
  { k: 'video', l: 'Video', i: <Film size={15} /> },
  { k: 'pdf', l: 'PDF', i: <FileText size={15} /> },
  { k: 'texto', l: 'Solo texto', i: <Type size={15} /> },
];
const vacio = { titulo: '', descripcion: '', categoria: CATEGORIAS[0], tipo: 'imagen' as Tipo, archivo_url: '', texto: '', destacado: false, activo: true, vence: '' };
const hoyISO = () => new Date().toISOString().slice(0, 10);
const tipoDeArchivo = (f: File): Tipo => (f.type.startsWith('video') ? 'video' : f.type === 'application/pdf' ? 'pdf' : 'imagen');

export default function Publicidad() {
  const { profile } = useAuth();
  const toast = useToast();
  const esAdmin = profile?.rol === 'admin';
  const [items, setItems] = useState<Pieza[] | null>(null);
  const [cat, setCat] = useState('Todas');
  const [form, setForm] = useState<(typeof vacio & { id?: string }) | null>(null);
  const [ver, setVer] = useState<Pieza | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const { data } = await supabase.from('publicidad').select('*').order('destacado', { ascending: false }).order('created_at', { ascending: false });
    setItems((data as Pieza[]) ?? []);
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const visibles = useMemo(() => (items ?? []).filter((p) => (esAdmin || (p.activo && (!p.vence || p.vence >= hoyISO()))) && (cat === 'Todas' || p.categoria === cat)), [items, cat, esAdmin]);
  const cats = useMemo(() => CATEGORIAS.filter((c) => (items ?? []).some((p) => p.categoria === c)), [items]);

  // Texto personalizado con los datos del vendedor
  const personalizar = (p: Pieza) => {
    const nombre = profile?.nombre ?? ''; const cel = profile?.celular ?? ''; const cod = profile?.codigo_vendedor ?? '';
    let t = (p.texto || p.titulo).replaceAll('{nombre}', nombre).replaceAll('{celular}', cel).replaceAll('{codigo}', cod);
    if (!(p.texto ?? '').includes('{celular}') && cel) t += `\n\n📲 Consultas: ${nombre} · WhatsApp ${cel}`;
    return t;
  };
  const archivoDe = async (p: Pieza) => {
    const r = await fetch(p.archivo_url!); const b = await r.blob();
    const ext = p.archivo_url!.split('?')[0].split('.').pop() || 'bin';
    return new File([b], `${p.titulo.replace(/[^\wáéíóúñ ]/gi, '').trim() || 'royal'}.${ext}`, { type: b.type });
  };
  const descargar = async (p: Pieza) => {
    setOcupado(p.id);
    try { const f = await archivoDe(p); const u = URL.createObjectURL(f); const a = document.createElement('a'); a.href = u; a.download = f.name; a.click(); setTimeout(() => URL.revokeObjectURL(u), 2000); }
    catch { window.open(p.archivo_url!, '_blank'); }
    setOcupado(null);
  };
  const copiar = async (p: Pieza) => { await navigator.clipboard.writeText(personalizar(p)); toast.show('Texto copiado con tus datos'); };
  const compartir = async (p: Pieza) => {
    const text = personalizar(p);
    setOcupado(p.id);
    try {
      if (p.archivo_url && navigator.canShare) {
        const f = await archivoDe(p);
        if (navigator.canShare({ files: [f] })) { await navigator.clipboard.writeText(text).catch(() => {}); await navigator.share({ files: [f], text, title: p.titulo }); setOcupado(null); return; }
      }
      if (navigator.share) { await navigator.share({ text: p.archivo_url ? `${text}\n\n${p.archivo_url}` : text, title: p.titulo }); setOcupado(null); return; }
      whatsapp(p);
    } catch { /* cancelado */ }
    setOcupado(null);
  };
  const whatsapp = (p: Pieza) => window.open(`https://wa.me/?text=${encodeURIComponent(p.archivo_url ? `${personalizar(p)}\n\n${p.archivo_url}` : personalizar(p))}`, '_blank');

  const subir = async (f: File) => {
    if (f.size > 50 * 1024 * 1024) return toast.show('El archivo supera 50 MB', 'error');
    setSubiendo(true);
    const path = `${Date.now()}-${f.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
    const { error } = await supabase.storage.from('publicidad').upload(path, f, { upsert: true, contentType: f.type });
    setSubiendo(false);
    if (error) return toast.show(error.message, 'error');
    const { data } = supabase.storage.from('publicidad').getPublicUrl(path);
    setForm((x) => ({ ...x!, archivo_url: data.publicUrl, tipo: tipoDeArchivo(f), titulo: x!.titulo || f.name.replace(/\.[^.]+$/, '') }));
  };
  const guardar = async (e: React.FormEvent) => {
    e.preventDefault(); if (!form) return;
    if (form.tipo !== 'texto' && !form.archivo_url) return toast.show('Subí el archivo primero', 'error');
    if (form.tipo === 'texto' && !form.texto.trim()) return toast.show('Escribí el texto', 'error');
    const { id, ...rest } = form;
    const payload = { ...rest, descripcion: rest.descripcion || null, archivo_url: rest.tipo === 'texto' ? null : rest.archivo_url, texto: rest.texto || null, vence: rest.vence || null };
    const { error } = id ? await supabase.from('publicidad').update(payload).eq('id', id) : await supabase.from('publicidad').insert(payload);
    if (error) return toast.show(error.message, 'error');
    toast.show(id ? 'Material actualizado' : 'Material publicado'); setForm(null); cargar();
  };
  const borrar = async (p: Pieza) => {
    if (!confirm(`¿Eliminar "${p.titulo}"?`)) return;
    const { error } = await supabase.from('publicidad').delete().eq('id', p.id);
    if (error) return toast.show(error.message, 'error');
    if (p.archivo_url?.includes('/publicidad/')) await supabase.storage.from('publicidad').remove([p.archivo_url.split('/publicidad/').pop()!]);
    toast.show('Eliminado'); cargar();
  };

  const Preview = ({ p, grande }: { p: Pieza; grande?: boolean }) => {
    if (p.tipo === 'imagen' && p.archivo_url) return <img src={p.archivo_url} alt={p.titulo} className={grande ? 'max-h-[60vh] w-full rounded-2xl object-contain' : 'h-full w-full object-cover'} />;
    if (p.tipo === 'video' && p.archivo_url) return <video src={p.archivo_url} className={grande ? 'max-h-[60vh] w-full rounded-2xl bg-black' : 'h-full w-full object-cover'} controls={grande} muted={!grande} playsInline preload="metadata" />;
    if (p.tipo === 'pdf' && p.archivo_url) return grande ? <iframe src={p.archivo_url} className="h-[60vh] w-full rounded-2xl border" title={p.titulo} /> : <div className="grid h-full place-items-center bg-gradient-to-br from-rose-50 to-rose-100 text-rose-600"><FileText size={42} /></div>;
    return <div className={`${grande ? 'rounded-2xl p-5' : 'h-full p-4'} overflow-hidden whitespace-pre-line bg-gradient-to-br from-royal-50 to-sky-50 text-sm text-royal-900`}>{grande ? personalizar(p) : (p.texto ?? '').slice(0, 180)}</div>;
  };

  return (
    <div>
      <PageHeader title="Publicidad" subtitle="Material listo para compartir con tus clientes"
        action={esAdmin ? <button className="btn-primary" onClick={() => setForm({ ...vacio, categoria: cat !== 'Todas' ? cat : CATEGORIAS[0] })}><Plus size={18} /> Subir material</button> : undefined} />
      <div className="mb-5"><RecetaSemana /></div>

      {items === null ? <Spinner /> : items.length === 0 ? (
        <Empty icon={<Megaphone size={30} />} title="Todavía no hay material" text={esAdmin ? 'Subí flyers, videos, PDFs o textos. Tu red los va a poder descargar y compartir con su nombre y celular.' : 'Pronto vas a encontrar acá flyers, videos y textos para compartir.'} />
      ) : (<>
        {cats.length > 1 && (
          <div className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1">
            {['Todas', ...cats].map((c) => <button key={c} className={`chip whitespace-nowrap ${cat === c ? 'bg-royal-600 text-white' : 'bg-slate-100 text-slate-600'}`} onClick={() => setCat(c)}>{c}</button>)}
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visibles.map((p) => (
            <div key={p.id} className={`card flex flex-col overflow-hidden ${!p.activo || (p.vence && p.vence < hoyISO()) ? 'opacity-50' : ''}`}>
              <button className="relative aspect-square w-full overflow-hidden bg-slate-100" onClick={() => setVer(p)}>
                <Preview p={p} />
                {p.destacado && <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-amber-400 px-2 py-0.5 text-xs font-bold text-amber-950"><Star size={12} /> Destacado</span>}
                <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white">{TIPOS.find((t) => t.k === p.tipo)?.l}</span>
              </button>
              <div className="flex flex-1 flex-col p-3">
                <p className="font-semibold text-royal-900">{p.titulo}</p>
                <p className="text-xs text-slate-500">{p.categoria}{p.vence ? ` · hasta ${new Date(p.vence + 'T12:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}` : ''}</p>
                <div className="mt-auto flex flex-wrap gap-1.5 pt-3">
                  <button className="btn-primary flex-1 px-3 py-1.5 text-sm" onClick={() => compartir(p)} disabled={ocupado === p.id}>{ocupado === p.id ? <Loader2 size={15} className="animate-spin" /> : <Share2 size={15} />} Compartir</button>
                  {p.archivo_url && <button className="btn-secondary px-2.5 py-1.5" title="Descargar" onClick={() => descargar(p)}><Download size={15} /></button>}
                  <button className="btn-secondary px-2.5 py-1.5" title="Copiar texto" onClick={() => copiar(p)}><Copy size={15} /></button>
                  {esAdmin && <><button className="btn-ghost px-2" title="Editar" onClick={() => setForm({ id: p.id, titulo: p.titulo, descripcion: p.descripcion ?? '', categoria: p.categoria, tipo: p.tipo, archivo_url: p.archivo_url ?? '', texto: p.texto ?? '', destacado: p.destacado, activo: p.activo, vence: p.vence ?? '' })}><Pencil size={15} /></button>
                    <button className="btn-ghost px-2 text-coral-600" title="Eliminar" onClick={() => borrar(p)}><Trash2 size={15} /></button></>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </>)}

      <Modal open={!!ver} onClose={() => setVer(null)} title={ver?.titulo ?? ''} wide>
        {ver && (<div className="space-y-4">
          <Preview p={ver} grande />
          {ver.descripcion && <p className="text-sm text-slate-600">{ver.descripcion}</p>}
          {ver.tipo !== 'texto' && <div><p className="label">Texto para acompañar (con tus datos)</p><p className="whitespace-pre-line rounded-xl bg-slate-50 p-3 text-sm text-slate-700">{personalizar(ver)}</p></div>}
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary" onClick={() => compartir(ver)}><Share2 size={16} /> Compartir</button>
            <button className="btn-secondary" onClick={() => whatsapp(ver)}><MessageCircle size={16} /> WhatsApp</button>
            {ver.archivo_url && <button className="btn-secondary" onClick={() => descargar(ver)}><Download size={16} /> Descargar</button>}
            <button className="btn-secondary" onClick={() => copiar(ver)}><Copy size={16} /> Copiar texto</button>
          </div>
          <p className="text-xs text-slate-400">En el celular, Compartir manda el archivo con el texto (Instagram y algunas apps solo toman el archivo: el texto queda copiado para pegarlo).</p>
        </div>)}
      </Modal>

      <Modal open={!!form} onClose={() => setForm(null)} title={form?.id ? 'Editar material' : 'Subir material'} wide>
        {form && (<form onSubmit={guardar} className="space-y-3">
          <div className="flex flex-wrap gap-1">{TIPOS.map((t) => <button type="button" key={t.k} className={`chip flex items-center gap-1 ${form.tipo === t.k ? 'bg-royal-600 text-white' : 'bg-slate-100 text-slate-600'}`} onClick={() => setForm({ ...form, tipo: t.k })}>{t.i} {t.l}</button>)}</div>
          {form.tipo !== 'texto' && (
            <div className="rounded-2xl border-2 border-dashed border-slate-200 p-4 text-center">
              {form.archivo_url ? <div className="mx-auto mb-3 aspect-square max-w-[220px] overflow-hidden rounded-xl bg-slate-100"><Preview p={{ ...(form as unknown as Pieza), archivo_url: form.archivo_url }} /></div> : null}
              <label className="btn-secondary cursor-pointer">{subiendo ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />} {form.archivo_url ? 'Reemplazar archivo' : 'Elegir archivo'}
                <input type="file" hidden accept="image/*,video/*,application/pdf" onChange={(e) => e.target.files?.[0] && subir(e.target.files[0])} /></label>
              <p className="mt-2 text-xs text-slate-400">Imagen, video o PDF · hasta 50 MB</p>
            </div>
          )}
          <div><label className="label">Título</label><input className="input" required value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} /></div>
          <div className="grid gap-3 md:grid-cols-2">
            <div><label className="label">Categoría</label><select className="input" value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })}>{CATEGORIAS.map((c) => <option key={c}>{c}</option>)}</select></div>
            <div><label className="label">Visible hasta (opcional)</label><input type="date" className="input" value={form.vence} onChange={(e) => setForm({ ...form, vence: e.target.value })} /></div>
          </div>
          <div><label className="label">{form.tipo === 'texto' ? 'Texto' : 'Texto para acompañar'} <span className="font-normal text-slate-400">— usá {'{nombre}'}, {'{celular}'} y {'{codigo}'}; si no ponés {'{celular}'}, se agrega la firma del vendedor al final</span></label>
            <textarea className="input min-h-[120px]" value={form.texto} onChange={(e) => setForm({ ...form, texto: e.target.value })} placeholder={'¡Cociná sano y sin aceite! 🍳 Pedime tu demo gratis.\nSoy {nombre}, escribime al {celular}.'} /></div>
          <div><label className="label">Nota interna para el vendedor (opcional)</label><input className="input" value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} placeholder="Ej: ideal para estados de WhatsApp" /></div>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.destacado} onChange={(e) => setForm({ ...form, destacado: e.target.checked })} /> Destacado</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.activo} onChange={(e) => setForm({ ...form, activo: e.target.checked })} /> Visible para la red</label>
          </div>
          <div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={() => setForm(null)}>Cancelar</button><button className="btn-primary" disabled={subiendo}>Guardar</button></div>
        </form>)}
      </Modal>
      <Toast msg={toast.msg} kind={toast.kind} />
    </div>
  );
}
