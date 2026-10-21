'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Pencil, Search, Upload, Package } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';
import { useCatalogo } from '@/components/data';
import { PageHeader, Modal, Toast, Spinner } from '@/components/ui';
import { useToast } from '@/components/useToast';
import { pesos } from '@/lib/format';
import { PLANES, DEFAULT_FACTORES } from '@/lib/cotizador';
import type { Producto } from '@/lib/types';
import RevisarMedios from '@/components/RevisarMedios';

type Tab = 'productos' | 'fotos' | 'cuotas';
const nuevo = (cat: number): Partial<Producto> => ({ nombre: '', codigo: '', descripcion: '', precio: 0, categoria_id: cat, activo: true, orden: 99, imagen_url: null });

export default function Admin() {
  const { profile } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const { categorias, productos, loading, reload } = useCatalogo();
  const [tab, setTab] = useState<Tab>('productos');
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<Partial<Producto> | null>(null);
  const [factores, setFactores] = useState<Record<string, number>>(DEFAULT_FACTORES);
  const [dias, setDias] = useState(31);
  const [subiendo, setSubiendo] = useState(false);

  useEffect(() => { if (profile && profile.rol !== 'admin') router.replace('/'); }, [profile, router]);
  useEffect(() => {
    supabase.from('config').select('factores,dias_mes').maybeSingle().then(({ data }) => { if (data) { setFactores(data.factores); setDias(data.dias_mes); } });
  }, []);
  const lista = useMemo(() => productos.filter((p) => (p.nombre + (p.codigo ?? '')).toLowerCase().includes(q.toLowerCase())), [productos, q]);
  if (profile?.rol !== 'admin') return <Spinner />;

  const guardarProducto = async (e: React.FormEvent) => {
    e.preventDefault(); if (!edit) return;
    const { id, ...rest } = edit as Producto;
    const payload = { ...rest, precio: Number(rest.precio) || 0 };
    const { error } = id ? await supabase.from('productos').update(payload).eq('id', id) : await supabase.from('productos').insert(payload);
    if (error) return toast.show(error.message, 'error');
    toast.show('Producto guardado'); setEdit(null); reload();
  };
  const subir = async (f: File) => {
    setSubiendo(true);
    const path = `${Date.now()}-${f.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
    const { error } = await supabase.storage.from('productos').upload(path, f, { upsert: true });
    setSubiendo(false);
    if (error) return toast.show(error.message, 'error');
    const { data } = supabase.storage.from('productos').getPublicUrl(path);
    setEdit((e) => ({ ...e!, imagen_url: data.publicUrl }));
  };
  const guardarCuotas = async () => {
    const { error } = await supabase.from('config').update({ factores, dias_mes: dias, updated_at: new Date().toISOString() }).eq('id', 1);
    toast.show(error ? error.message : 'Cuotas actualizadas', error ? 'error' : 'ok');
  };
  return (
    <div>
      <PageHeader title="Administración" subtitle="Productos, precios y plan de cuotas. El equipo se gestiona en Mi red." />
      <div className="mb-5 flex max-w-md gap-1 rounded-xl bg-slate-200/60 p-1">
        {([['productos', 'Productos'], ['fotos', 'Fotos y videos'], ['cuotas', 'Cuotas']] as [Tab, string][]).map(([k, l]) => <button key={k} className={`seg ${tab === k ? 'seg-on' : 'seg-off'}`} onClick={() => setTab(k)}>{l}</button>)}
      </div>

      {tab === 'productos' && (loading ? <Spinner /> : (<>
        <div className="mb-4 flex gap-2">
          <div className="relative flex-1"><Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} /><input className="input pl-10" placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <button className="btn-primary" onClick={() => setEdit(nuevo(categorias[0]?.id))}><Plus size={18} /> <span className="hidden sm:inline">Nuevo</span></button>
        </div>
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="hidden bg-slate-50 text-left text-xs uppercase text-slate-500 md:table-header-group"><tr><th className="p-3">Producto</th><th className="p-3">Categoría</th><th className="p-3 text-right">Precio</th><th className="p-3" /></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {lista.map((p) => (
                <tr key={p.id} className={p.activo ? '' : 'opacity-50'}>
                  <td className="p-3"><div className="flex items-center gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100 text-slate-300">{p.imagen_url ? <img src={p.imagen_url} alt="" className="h-full w-full object-cover" /> : <Package size={18} />}</div><div className="min-w-0"><p className="font-medium leading-snug">{p.nombre}</p><p className="text-xs text-slate-500 md:hidden">{pesos(p.precio)}</p></div></div></td>
                  <td className="hidden p-3 text-slate-500 md:table-cell">{categorias.find((c) => c.id === p.categoria_id)?.nombre}</td>
                  <td className={`hidden p-3 text-right font-semibold md:table-cell ${p.precio ? '' : 'text-coral-500'}`}>{p.precio ? pesos(p.precio) : 'Sin precio'}</td>
                  <td className="p-3 text-right"><button className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-royal-600" onClick={() => setEdit(p)} aria-label="Editar"><Pencil size={16} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>))}

      {tab === 'fotos' && <RevisarMedios productos={productos} onCambio={reload} toast={toast.show} />}

      {tab === 'cuotas' && (
        <div className="grid max-w-3xl gap-5 md:grid-cols-2">
          <div className="card p-5">
            <p className="font-bold text-royal-900">Factores por plan</p>
            <p className="mb-4 text-xs text-slate-500">Cuota = (total − entrega) × factor</p>
            <div className="space-y-2.5">
              {PLANES.map((c) => (
                <div key={c} className="flex items-center gap-3"><span className="w-20 text-sm font-semibold">{c} cuotas</span>
                  <input className="input" type="number" step="0.0001" value={factores[String(c)] ?? ''} onChange={(e) => setFactores({ ...factores, [String(c)]: Number(e.target.value) })} />
                  <span className="w-20 text-right text-xs text-slate-500">{((factores[String(c)] ?? 0) * c * 100 - 100).toFixed(1)}% rec.</span>
                </div>
              ))}
              <div className="flex items-center gap-3 pt-2"><span className="w-20 text-sm font-semibold">Días/mes</span><input className="input" type="number" value={dias} onChange={(e) => setDias(Number(e.target.value))} /><span className="w-20" /></div>
            </div>
            <button className="btn-primary mt-5 w-full" onClick={guardarCuotas}>Guardar</button>
          </div>
        </div>
      )}

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Editar producto' : 'Nuevo producto'} wide>
        {edit && (
          <form onSubmit={guardarProducto} className="grid gap-4 md:grid-cols-[200px_1fr]">
            <div>
              <div className="flex aspect-square items-center justify-center overflow-hidden rounded-2xl bg-slate-100 text-slate-300">{edit.imagen_url ? <img src={edit.imagen_url} alt="" className="h-full w-full object-cover" /> : <Package size={48} />}</div>
              <label className="btn-secondary mt-2 w-full cursor-pointer"><Upload size={16} />{subiendo ? 'Subiendo…' : 'Subir foto'}<input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && subir(e.target.files[0])} /></label>
            </div>
            <div className="space-y-3">
              <div><label className="label">Nombre</label><input className="input" value={edit.nombre ?? ''} onChange={(e) => setEdit({ ...edit, nombre: e.target.value })} required /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Código</label><input className="input" value={edit.codigo ?? ''} onChange={(e) => setEdit({ ...edit, codigo: e.target.value })} /></div>
                <div><label className="label">Precio ($)</label><input className="input" type="number" min={0} value={edit.precio ?? 0} onChange={(e) => setEdit({ ...edit, precio: Number(e.target.value) })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Categoría</label><select className="input" value={edit.categoria_id} onChange={(e) => setEdit({ ...edit, categoria_id: Number(e.target.value) })}>{categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></div>
                <div><label className="label">Orden</label><input className="input" type="number" value={edit.orden ?? 0} onChange={(e) => setEdit({ ...edit, orden: Number(e.target.value) })} /></div>
              </div>
              <div><label className="label">Descripción</label><textarea className="input min-h-[110px]" value={edit.descripcion ?? ''} onChange={(e) => setEdit({ ...edit, descripcion: e.target.value })} /></div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={edit.activo ?? true} onChange={(e) => setEdit({ ...edit, activo: e.target.checked })} /> Visible en el catálogo</label>
              <button className="btn-primary w-full">Guardar</button>
            </div>
          </form>
        )}
      </Modal>
      <Toast msg={toast.msg} kind={toast.kind} />
    </div>
  );
}
