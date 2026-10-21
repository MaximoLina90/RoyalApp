'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Store, Plus, Search, ImagePlus, MessageCircle, MapPin, Pencil, Trash2, Loader2, Package } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';
import { pesos, fechaCorta } from '@/lib/format';
import { CATEGORIAS_MK, ESTADOS_MK, type MarketplaceItem } from '@/lib/types';
import { PageHeader, Empty, Modal, Spinner, Toast } from '@/components/ui';
import { useToast } from '@/components/useToast';

type Form = Partial<MarketplaceItem>;
const NUEVO: Form = { titulo: '', descripcion: '', categoria: CATEGORIAS_MK[0], estado: 'Nuevo', precio: 0, contacto: '', ubicacion: '', imagen_url: null, activo: true };
const wa = (n: string) => n.replace(/\D/g, '');

export default function Marketplace() {
  const { profile } = useAuth();
  const toast = useToast();
  const [items, setItems] = useState<MarketplaceItem[] | null>(null);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('Todas');
  const esAdminLista = profile?.rol === 'admin';
  const [form, setForm] = useState<Form | null>(null);
  const [ver, setVer] = useState<MarketplaceItem | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    const { data, error } = await supabase.from('marketplace_items').select('*').order('created_at', { ascending: false });
    if (error) toast.show(error.message, 'error');
    setItems((data as MarketplaceItem[]) ?? []);
  }, [toast.show]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { cargar(); }, [cargar]);

  const lista = useMemo(() => (items ?? []).filter((i) =>
    (cat === 'Todas' || i.categoria === cat) &&
    (i.activo || esAdminLista) &&
    (i.titulo + ' ' + (i.descripcion ?? '')).toLowerCase().includes(q.toLowerCase())), [items, cat, esAdminLista, q]);

  const esAdmin = profile?.rol === 'admin';
  const puedeEditar = (_i: MarketplaceItem) => esAdmin;

  const subir = async (f: File) => {
    if (!profile) return;
    setSubiendo(true);
    const path = `${profile.id}/${Date.now()}-${f.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
    const { error } = await supabase.storage.from('marketplace').upload(path, f, { upsert: true });
    setSubiendo(false);
    if (error) return toast.show(error.message, 'error');
    const { data } = supabase.storage.from('marketplace').getPublicUrl(path);
    setForm((x) => ({ ...x!, imagen_url: data.publicUrl }));
  };

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault(); if (!form) return;
    setGuardando(true);
    const payload = { titulo: form.titulo, descripcion: form.descripcion || null, categoria: form.categoria, estado: form.estado, precio: Number(form.precio) || 0,
      contacto: form.contacto || null, ubicacion: form.ubicacion || null, imagen_url: form.imagen_url || null, activo: form.activo ?? true };
    const { error } = form.id
      ? await supabase.from('marketplace_items').update(payload).eq('id', form.id)
      : await supabase.from('marketplace_items').insert(payload);
    setGuardando(false);
    if (error) return toast.show(error.message, 'error');
    toast.show(form.id ? 'Publicación actualizada' : 'Producto publicado'); setForm(null); cargar();
  };

  const borrar = async (i: MarketplaceItem) => {
    if (!confirm(`¿Eliminar "${i.titulo}"?`)) return;
    const { error } = await supabase.from('marketplace_items').delete().eq('id', i.id);
    if (error) return toast.show(error.message, 'error');
    toast.show('Publicación eliminada'); setVer(null); cargar();
  };

  return (
    <div>
      <PageHeader title="Marketplace" subtitle="Comprá accesorios, insumos y más"
        action={esAdmin && <button className="btn-primary" onClick={() => setForm({ ...NUEVO, contacto: profile?.celular ?? '' })}><Plus size={18} /> Publicar</button>} />

      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input pl-10" placeholder="Buscar en el marketplace…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex gap-2">
          <select className="input md:w-52" value={cat} onChange={(e) => setCat(e.target.value)}>
            <option>Todas</option>{CATEGORIAS_MK.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {items === null ? <Spinner /> : lista.length === 0 ? (
        <Empty icon={<Store size={30} />} title={items.length === 0 ? 'Todavía no hay publicaciones' : 'Sin resultados'}
          text={items.length === 0 ? 'Pronto vas a encontrar accesorios, insumos y más.' : 'Probá con otra búsqueda o categoría.'}
          action={esAdmin && <button className="btn-primary" onClick={() => setForm({ ...NUEVO, contacto: profile?.celular ?? '' })}><Plus size={18} /> Publicar producto</button>} />
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4">
          {lista.map((i) => (
            <button key={i.id} onClick={() => setVer(i)} className="card group overflow-hidden text-left transition hover:-translate-y-0.5 hover:shadow-md">
              <div className="relative aspect-square bg-slate-100">
                {i.imagen_url ? <img src={i.imagen_url} alt={i.titulo} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-slate-300"><Package size={40} /></div>}
                <span className="chip absolute left-2 top-2 bg-white/90 text-royal-700">{i.estado}</span>
                {!i.activo && <span className="chip absolute right-2 top-2 bg-slate-800 text-white">Pausado</span>}
              </div>
              <div className="p-3">
                <p className="text-lg font-bold text-royal-900">{pesos(i.precio)}</p>
                <p className="line-clamp-2 text-sm font-medium text-slate-800">{i.titulo}</p>
                <p className="mt-1 truncate text-xs text-slate-500">{i.vendedor_nombre ?? 'Vendedor'}{i.ubicacion ? ` · ${i.ubicacion}` : ''}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Detalle */}
      <Modal open={!!ver} onClose={() => setVer(null)} title={ver?.titulo ?? ''} wide>
        {ver && (
          <div className="grid gap-5 md:grid-cols-2">
            <div className="aspect-square overflow-hidden rounded-2xl bg-slate-100">
              {ver.imagen_url ? <img src={ver.imagen_url} alt={ver.titulo} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-slate-300"><Package size={56} /></div>}
            </div>
            <div className="flex flex-col">
              <div className="flex flex-wrap gap-2"><span className="chip bg-royal-50 text-royal-700">{ver.categoria}</span><span className="chip bg-slate-100 text-slate-700">{ver.estado}</span></div>
              <p className="mt-3 text-3xl font-bold text-royal-900">{pesos(ver.precio)}</p>
              {ver.descripcion && <p className="mt-3 whitespace-pre-line text-sm text-slate-600">{ver.descripcion}</p>}
              <div className="mt-4 space-y-1 text-sm text-slate-500">
                <p>Publicado por <b className="text-slate-700">{ver.vendedor_nombre ?? 'Vendedor'}</b> el {fechaCorta(ver.created_at)}</p>
                {ver.ubicacion && <p className="flex items-center gap-1"><MapPin size={14} />{ver.ubicacion}</p>}
              </div>
              <div className="mt-auto flex flex-wrap gap-2 pt-5">
                {ver.contacto && ver.usuario_id !== profile?.id && (
                  <a className="btn-primary flex-1 bg-emerald-600 hover:bg-emerald-700" target="_blank" rel="noreferrer"
                    href={`https://wa.me/${wa(ver.contacto)}?text=${encodeURIComponent(`Hola! Vi tu publicación "${ver.titulo}" en Royal App.`)}`}><MessageCircle size={18} /> Contactar</a>
                )}
                {puedeEditar(ver) && <>
                  <button className="btn-secondary" onClick={() => { setForm(ver); setVer(null); }}><Pencil size={16} /> Editar</button>
                  <button className="btn-ghost text-coral-600" onClick={() => borrar(ver)}><Trash2 size={16} /> Eliminar</button>
                </>}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Alta / edición */}
      <Modal open={!!form} onClose={() => setForm(null)} title={form?.id ? 'Editar publicación' : 'Publicar producto'}>
        {form && (
          <form onSubmit={guardar} className="space-y-4">
            <label className="flex aspect-video cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 text-slate-500 hover:border-royal-400">
              {subiendo ? <Loader2 className="animate-spin" /> : form.imagen_url ? <img src={form.imagen_url} alt="" className="h-full w-full object-cover" /> :
                <span className="flex flex-col items-center gap-1 text-sm"><ImagePlus size={28} />Agregar foto</span>}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && subir(e.target.files[0])} />
            </label>
            <div><label className="label">Título</label><input className="input" required minLength={2} maxLength={120} value={form.titulo ?? ''} onChange={(e) => setForm({ ...form, titulo: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Precio ($)</label><input className="input" type="number" min={0} step="any" value={form.precio ?? 0} onChange={(e) => setForm({ ...form, precio: e.target.value as unknown as number })} /></div>
              <div><label className="label">Estado</label><select className="input" value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value as MarketplaceItem['estado'] })}>{ESTADOS_MK.map((x) => <option key={x}>{x}</option>)}</select></div>
            </div>
            <div><label className="label">Categoría</label><select className="input" value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })}>{CATEGORIAS_MK.map((x) => <option key={x}>{x}</option>)}</select></div>
            <div><label className="label">Descripción</label><textarea className="input min-h-[90px]" value={form.descripcion ?? ''} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">WhatsApp</label><input className="input" placeholder="351..." value={form.contacto ?? ''} onChange={(e) => setForm({ ...form, contacto: e.target.value })} /></div>
              <div><label className="label">Ubicación</label><input className="input" placeholder="Ciudad" value={form.ubicacion ?? ''} onChange={(e) => setForm({ ...form, ubicacion: e.target.value })} /></div>
            </div>
            {form.id && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.activo ?? true} onChange={(e) => setForm({ ...form, activo: e.target.checked })} /> Publicación activa</label>}
            <button className="btn-primary w-full" disabled={guardando || subiendo}>{guardando ? <Loader2 className="animate-spin" size={18} /> : null}{form.id ? 'Guardar cambios' : 'Publicar'}</button>
          </form>
        )}
      </Modal>
      <Toast msg={toast.msg} kind={toast.kind} />
    </div>
  );
}
