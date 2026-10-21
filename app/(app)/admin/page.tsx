'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Pencil, Search, Upload, Package, Shield, AlertTriangle, Smartphone, Check, Ban, Trash2, ChevronDown } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';
import { useCatalogo } from '@/components/data';
import { PageHeader, Modal, Toast, Spinner } from '@/components/ui';
import { useToast } from '@/components/useToast';
import { pesos } from '@/lib/format';
import { PLANES, DEFAULT_FACTORES } from '@/lib/cotizador';
import type { Producto, Profile, Dispositivo, Acceso } from '@/lib/types';

type Tab = 'productos' | 'cuotas' | 'equipo';
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
  const [kw, setKw] = useState('');
  const [equipo, setEquipo] = useState<Profile[]>([]);
  const [subiendo, setSubiendo] = useState(false);
  const [dispositivos, setDispositivos] = useState<Dispositivo[]>([]);
  const [accesos, setAccesos] = useState<Acceso[]>([]);
  const [abierto, setAbierto] = useState<string | null>(null);

  useEffect(() => { if (profile && profile.rol !== 'admin') router.replace('/'); }, [profile, router]);
  useEffect(() => {
    supabase.from('config').select('factores,dias_mes').maybeSingle().then(({ data }) => { if (data) { setFactores(data.factores); setDias(data.dias_mes); } });
    supabase.from('profiles').select('*').order('created_at').then(({ data }) => setEquipo((data as Profile[]) ?? []));
    supabase.from('dispositivos').select('*').order('created_at').then(({ data }) => setDispositivos((data as Dispositivo[]) ?? []));
    supabase.from('accesos').select('*').order('created_at', { ascending: false }).limit(500).then(({ data }) => setAccesos((data as Acceso[]) ?? []));
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
  const cambiarKw = async () => {
    if (kw.length < 4) return toast.show('Mínimo 4 caracteres', 'error');
    const { error } = await supabase.rpc('cambiar_keyword', { p_nueva: kw });
    toast.show(error ? error.message : 'Palabra clave actualizada', error ? 'error' : 'ok'); setKw('');
  };
  const cambiarRol = async (u: Profile) => {
    const rol = u.rol === 'admin' ? 'vendedor' : 'admin';
    if (u.id === profile.id) return toast.show('No podés cambiar tu propio rol', 'error');
    const { error } = await supabase.from('profiles').update({ rol }).eq('id', u.id);
    if (error) return toast.show(error.message, 'error');
    setEquipo(equipo.map((x) => (x.id === u.id ? { ...x, rol } : x)));
  };

  const actualizar = async (u: Profile, cambios: Partial<Profile>, msg: string) => {
    const { error } = await supabase.from('profiles').update(cambios).eq('id', u.id);
    if (error) return toast.show(error.message, 'error');
    setEquipo(equipo.map((x) => (x.id === u.id ? { ...x, ...cambios } : x))); toast.show(msg);
  };
  const liberar = async (d: Dispositivo) => {
    if (!confirm(`¿Liberar "${d.nombre ?? 'dispositivo'}"? El vendedor podrá verificar otro dispositivo en su lugar.`)) return;
    const { error } = await supabase.from('dispositivos').delete().eq('id', d.id);
    if (error) return toast.show(error.message, 'error');
    setDispositivos(dispositivos.filter((x) => x.id !== d.id)); toast.show('Dispositivo liberado');
  };
  const pendientes = equipo.filter((u) => !u.aprobado && !u.suspendido).length;
  const alertas = (uid: string) => accesos.filter((a) => a.usuario_id === uid && a.alerta && Date.now() - new Date(a.created_at).getTime() < 30 * 86400_000);
  const fh = (iso: string) => new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

  return (
    <div>
      <PageHeader title="Administración" subtitle="Productos, precios, plan de cuotas y equipo." />
      <div className="mb-5 flex max-w-md gap-1 rounded-xl bg-slate-200/60 p-1">
        {([['productos', 'Productos'], ['cuotas', 'Cuotas'], ['equipo', 'Equipo']] as [Tab, string][]).map(([k, l]) => <button key={k} className={`seg ${tab === k ? 'seg-on' : 'seg-off'}`} onClick={() => setTab(k)}>{l}{k === 'equipo' && pendientes > 0 && <span className="ml-1.5 rounded-full bg-coral-500 px-1.5 text-[10px] font-bold text-white">{pendientes}</span>}</button>)}
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
          <div className="card h-fit p-5">
            <p className="font-bold text-royal-900">Palabra clave de registro</p>
            <p className="mb-4 text-xs text-slate-500">Los vendedores nuevos la necesitan para crear su cuenta. Se guarda encriptada.</p>
            <input className="input" placeholder="Nueva palabra clave" value={kw} onChange={(e) => setKw(e.target.value)} />
            <button className="btn-secondary mt-3 w-full" onClick={cambiarKw}>Actualizar</button>
          </div>
        </div>
      )}

      {tab === 'equipo' && (
        <div className="card divide-y divide-slate-100">
          {[...equipo].sort((x, y) => Number(x.aprobado) - Number(y.aprobado)).map((u) => {
            const devs = dispositivos.filter((d) => d.usuario_id === u.id);
            const al = alertas(u.id);
            const acc = accesos.filter((a) => a.usuario_id === u.id).slice(0, 8);
            return (
              <div key={u.id} className="p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-royal-600 font-bold text-white">{u.nombre[0]?.toUpperCase()}</div>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 truncate font-medium">{u.nombre}
                      {!u.aprobado && !u.suspendido && <span className="chip bg-amber-100 text-amber-700">Pendiente</span>}
                      {u.suspendido && <span className="chip bg-red-100 text-red-700">Suspendido</span>}
                      {al.length > 0 && <span className="chip gap-1 bg-red-100 text-red-700"><AlertTriangle size={12} />{al.length}</span>}
                    </p>
                    <p className="truncate text-xs text-slate-500">{u.email}{u.codigo_vendedor ? ` · Cód. ${u.codigo_vendedor}` : ''}{u.celular ? ` · ${u.celular}` : ''}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {!u.aprobado && <button className="btn-primary px-3 py-1.5" onClick={() => actualizar(u, { aprobado: true, suspendido: false }, 'Cuenta aprobada')}><Check size={15} /> Aprobar</button>}
                    {u.id !== profile.id && u.aprobado && <button className={`chip gap-1 px-3 py-1 ${u.suspendido ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`} onClick={() => actualizar(u, { suspendido: !u.suspendido }, u.suspendido ? 'Cuenta reactivada' : 'Cuenta suspendida')}><Ban size={12} />{u.suspendido ? 'Reactivar' : 'Suspender'}</button>}
                    <button onClick={() => cambiarRol(u)} className={`chip gap-1 px-3 py-1 ${u.rol === 'admin' ? 'bg-royal-600 text-white' : 'bg-slate-100 text-slate-600'}`}>{u.rol === 'admin' && <Shield size={12} />}{u.rol}</button>
                    <button className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100" onClick={() => setAbierto(abierto === u.id ? null : u.id)} aria-label="Ver detalle"><ChevronDown size={18} className={abierto === u.id ? 'rotate-180' : ''} /></button>
                  </div>
                </div>
                {abierto === u.id && (
                  <div className="mt-4 grid gap-4 rounded-2xl bg-slate-50 p-4 md:grid-cols-2">
                    <div>
                      <p className="label">Dispositivos ({devs.filter((d) => d.verificado_at && !d.revocado).length}/{u.max_dispositivos})</p>
                      {devs.length === 0 ? <p className="text-sm text-slate-500">Ninguno verificado todavía.</p> : devs.map((d) => (
                        <div key={d.id} className="mb-2 flex items-center gap-2 rounded-xl bg-white p-2.5 text-sm">
                          <Smartphone size={16} className="text-royal-600" />
                          <div className="min-w-0 flex-1"><p className="truncate font-medium">{d.nombre ?? 'Dispositivo'}</p><p className="text-xs text-slate-500">Último uso {fh(d.ultimo_acceso)}</p></div>
                          <button className="rounded-full p-1.5 text-coral-600 hover:bg-red-50" onClick={() => liberar(d)} aria-label="Liberar"><Trash2 size={15} /></button>
                        </div>
                      ))}
                      <div className="mt-3 flex items-center gap-2 text-sm"><span className="text-slate-500">Máximo</span>
                        <select className="input w-20 py-1.5" value={u.max_dispositivos} onChange={(e) => actualizar(u, { max_dispositivos: Number(e.target.value) }, 'Límite actualizado')}>{[1, 2, 3, 4].map((n) => <option key={n}>{n}</option>)}</select>
                      </div>
                      <div className="mt-3 flex items-center gap-2 text-sm"><span className="text-slate-500">Celular</span>
                        <input className="input py-1.5" defaultValue={u.celular ?? ''} onBlur={(e) => e.target.value !== (u.celular ?? '') && actualizar(u, { celular: e.target.value }, 'Celular actualizado')} />
                      </div>
                    </div>
                    <div>
                      <p className="label">Últimos ingresos</p>
                      {acc.length === 0 ? <p className="text-sm text-slate-500">Sin ingresos registrados.</p> : (
                        <ul className="space-y-1.5 text-xs">
                          {acc.map((a) => (
                            <li key={a.id} className={`rounded-lg p-2 ${a.alerta ? 'bg-red-50 text-red-700' : 'bg-white text-slate-600'}`}>
                              <span className="font-semibold">{fh(a.created_at)}</span> · {a.dispositivo ?? '—'} · {[a.ciudad, a.pais].filter(Boolean).join(', ') || a.ip || 'ubicación desconocida'}
                              {a.alerta && <p className="mt-0.5 flex items-center gap-1 font-semibold"><AlertTriangle size={12} />{a.alerta}</p>}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
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
