'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Users, Search, Plus, Pencil, Check, Ban, Trash2, Smartphone, AlertTriangle, ChevronRight, UserPlus, X, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';
import { PageHeader, Modal, Spinner, Toast, Empty } from '@/components/ui';
import { useToast } from '@/components/useToast';
import { arbol, rama, esLider, etiquetaEquipo } from '@/lib/red';
import Objetivos, { PuestosVendedor } from '@/components/Objetivos';
import CapacitacionRed, { CapacitacionVendedor } from '@/components/CapacitacionRed';
import VentasVendedor from '@/components/VentasVendedor';
import type { Nodo, Profile, Dispositivo, Acceso } from '@/lib/types';

type Tab = 'estructura' | 'objetivos' | 'capacitacion' | 'pendientes' | 'alertas';
const fh = (iso: string) => new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

async function apiPost(path: string, body: object) {
  const { data } = await supabase.auth.getSession();
  const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token}` }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'Error');
  return j;
}

export default function Red() {
  const { profile } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('estructura');
  const [nodos, setNodos] = useState<Nodo[] | null>(null);
  const [perfiles, setPerfiles] = useState<Profile[]>([]);
  const [disps, setDisps] = useState<Dispositivo[]>([]);
  const [accesos, setAccesos] = useState<Acceso[]>([]);
  const [q, setQ] = useState('');
  const [equipoFiltro, setEquipoFiltro] = useState('');
  const [plegados, setPlegados] = useState<Set<string>>(new Set());
  const [editar, setEditar] = useState<Nodo | null>(null);
  const [alta, setAlta] = useState<{ superior: string; lineas: string } | null>(null);
  const [detalle, setDetalle] = useState<Nodo | null>(null);
  const [busy, setBusy] = useState(false);

  const cargar = useCallback(async () => {
    const [n, p, d, a] = await Promise.all([
      supabase.from('nodos').select('*'),
      supabase.from('profiles').select('*'),
      supabase.from('dispositivos').select('*'),
      supabase.from('accesos').select('*').order('created_at', { ascending: false }).limit(1000),
    ]);
    setNodos((n.data as Nodo[]) ?? []); setPerfiles((p.data as Profile[]) ?? []); setDisps((d.data as Dispositivo[]) ?? []); setAccesos((a.data as Acceso[]) ?? []);
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const mio = profile?.codigo_vendedor ?? null;
  const esAdmin = profile?.rol === 'admin';
  const perfilDe = useMemo(() => new Map(perfiles.filter((p) => p.codigo_vendedor).map((p) => [p.codigo_vendedor!, p])), [perfiles]);
  const enRed = useMemo(() => (nodos && mio ? (esAdmin ? new Set(nodos.map((n) => n.codigo)) : rama(nodos, mio)) : new Set<string>()), [nodos, mio, esAdmin]);
  const lideres = useMemo(() => (nodos ?? []).filter((n) => enRed.has(n.codigo) && esLider(nodos!, n.codigo)), [nodos, enRed]);

  const filas = useMemo(() => {
    if (!nodos) return [];
    const base = arbol(nodos.filter((n) => enRed.has(n.codigo)), esAdmin ? null : mio);
    const ramaEq = equipoFiltro ? rama(nodos, equipoFiltro) : null;
    const t = q.trim().toLowerCase();
    if (t || ramaEq) {
      return base.filter(({ n }) => (!ramaEq || ramaEq.has(n.codigo)) && (!t || [n.codigo, n.nombre, n.equipo_numero, n.equipo_nombre].some((x) => x?.toLowerCase().includes(t))));
    }
    // ocultar ramas plegadas
    const out: typeof base = []; let ocultarHasta: number | null = null;
    for (const f of base) {
      if (ocultarHasta !== null && f.nivel > ocultarHasta) continue;
      ocultarHasta = plegados.has(f.n.codigo) ? f.nivel : null;
      out.push(f);
    }
    return out;
  }, [nodos, enRed, esAdmin, mio, q, equipoFiltro, plegados]);

  const pendientes = perfiles.filter((p) => p.id !== profile?.id && p.telefono_verificado && !p.aprobado && !p.suspendido);
  const alertas = accesos.filter((a) => a.alerta && a.usuario_id !== profile?.id && Date.now() - new Date(a.created_at).getTime() < 30 * 86400_000);
  const nombreUsuario = (uid: string) => perfiles.find((p) => p.id === uid);

  const actualizarPerfil = async (p: Profile, cambios: Partial<Profile>, msg: string) => {
    const { error } = await supabase.from('profiles').update(cambios).eq('id', p.id);
    if (error) return toast.show(error.message, 'error');
    setPerfiles(perfiles.map((x) => (x.id === p.id ? { ...x, ...cambios } : x))); toast.show(msg);
  };
  const borrarCuenta = async (p: Profile) => {
    if (!confirm(`¿Borrar la cuenta de ${p.nombre}? Se eliminan sus pedidos y agenda. El código queda libre para registrarse de nuevo.`)) return;
    try { await apiPost('/api/cuentas/borrar', { user_id: p.id }); toast.show('Cuenta eliminada'); setDetalle(null); cargar(); } catch (e) { toast.show((e as Error).message, 'error'); }
  };
  const liberar = async (d: Dispositivo) => {
    if (!confirm(`¿Liberar "${d.nombre ?? 'dispositivo'}"?`)) return;
    const { error } = await supabase.from('dispositivos').delete().eq('id', d.id);
    if (error) return toast.show(error.message, 'error');
    setDisps(disps.filter((x) => x.id !== d.id)); toast.show('Dispositivo liberado');
  };
  const guardarNodo = async (e: React.FormEvent) => {
    e.preventDefault(); if (!editar) return; setBusy(true);
    const orig = nodos!.find((n) => n.codigo === editar.codigo)!;
    const cambios: Partial<Nodo> = { nombre: editar.nombre, equipo_numero: editar.equipo_numero || null, equipo_nombre: editar.equipo_nombre || null, activo: editar.activo };
    if (editar.superior !== orig.superior) cambios.superior = editar.superior;
    const { error } = await supabase.from('nodos').update(cambios).eq('codigo', editar.codigo);
    setBusy(false);
    if (error) return toast.show(error.message, 'error');
    toast.show('Guardado'); setEditar(null); cargar();
  };
  const borrarNodo = async (n: Nodo) => {
    if (esLider(nodos!, n.codigo)) return toast.show('Primero mové sus dependientes a otro superior', 'error');
    if (perfilDe.has(n.codigo)) return toast.show('Ese código tiene una cuenta. Borrá la cuenta primero.', 'error');
    if (!confirm(`¿Eliminar el código ${n.codigo}?`)) return;
    const { error } = await supabase.from('nodos').delete().eq('codigo', n.codigo);
    if (error) return toast.show(error.message, 'error');
    toast.show('Código eliminado'); setEditar(null); cargar();
  };
  const cargarCodigos = async (e: React.FormEvent) => {
    e.preventDefault(); if (!alta) return; setBusy(true);
    const { data, error } = await supabase.rpc('cargar_codigos', { p_superior: alta.superior, p_lineas: alta.lineas });
    setBusy(false);
    if (error) return toast.show(error.message, 'error');
    const ex = (data.existentes as string[]) ?? [];
    toast.show(`${data.cargados} código(s) cargado(s)${ex.length ? ` · ya existían: ${ex.join(', ')}` : ''}`, ex.length ? 'error' : 'ok');
    setAlta(null); cargar();
  };

  if (!nodos) return <Spinner />;
  if (!mio && !esAdmin) return <Empty icon={<Users size={30} />} title="Sin red asignada" text="Tu cuenta no tiene un código de vendedor asociado." />;

  const estadoCuenta = (n: Nodo) => {
    const p = perfilDe.get(n.codigo);
    if (!n.activo) return <span className="chip bg-slate-200 text-slate-600">Código deshabilitado</span>;
    if (!p) return <span className="chip bg-slate-100 text-slate-500">Sin registrar</span>;
    if (p.suspendido) return <span className="chip bg-red-100 text-red-700">Suspendido</span>;
    if (!p.telefono_verificado) return <span className="chip bg-amber-50 text-amber-600">Verificando celular</span>;
    if (!p.aprobado) return <span className="chip bg-amber-100 text-amber-700">Pendiente</span>;
    return <span className="chip bg-emerald-100 text-emerald-700">Activo</span>;
  };
  const supOpciones = (n: Nodo) => { const excl = rama(nodos, n.codigo); return nodos.filter((x) => enRed.has(x.codigo) && !excl.has(x.codigo)); };
  const pDet = detalle ? perfilDe.get(detalle.codigo) : undefined;

  return (
    <div>
      <PageHeader title="Mi red" subtitle={`${enRed.size - (esAdmin ? 0 : 1)} códigos en tu estructura · ${lideres.length} líderes`}
        action={<button className="btn-primary" onClick={() => setAlta({ superior: mio ?? lideres[0]?.codigo ?? '', lineas: '' })}><UserPlus size={18} /> Cargar códigos</button>} />

      <div className="mb-5 flex max-w-3xl gap-1 overflow-x-auto rounded-xl bg-slate-200/60 p-1">
        {([['estructura', 'Estructura'], ['objetivos', 'Objetivos'], ['capacitacion', 'Capacitación'], ['pendientes', 'Por aprobar'], ['alertas', 'Alertas']] as [Tab, string][]).map(([k, l]) => (
          <button key={k} className={`seg whitespace-nowrap ${tab === k ? 'seg-on' : 'seg-off'}`} onClick={() => setTab(k)}>{l}
            {k === 'pendientes' && pendientes.length > 0 && <span className="ml-1.5 rounded-full bg-coral-500 px-1.5 text-[10px] font-bold text-white">{pendientes.length}</span>}
            {k === 'alertas' && alertas.length > 0 && <span className="ml-1.5 rounded-full bg-red-600 px-1.5 text-[10px] font-bold text-white">{alertas.length}</span>}
          </button>
        ))}
      </div>

      {tab === 'estructura' && (<>
        <div className="mb-4 flex flex-col gap-3 md:flex-row">
          <div className="relative flex-1"><Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input pl-10" placeholder="Buscar por código, nombre, nro o nombre de equipo…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <select className="input md:w-72" value={equipoFiltro} onChange={(e) => setEquipoFiltro(e.target.value)}>
            <option value="">Todos los equipos</option>
            {lideres.map((l) => <option key={l.codigo} value={l.codigo}>{etiquetaEquipo(l) ?? `Equipo de ${l.nombre}`} · {l.codigo}</option>)}
          </select>
        </div>
        <div className="card divide-y divide-slate-100 overflow-hidden">
          {filas.length === 0 && <p className="p-6 text-center text-sm text-slate-500">Sin resultados.</p>}
          {filas.map(({ n, nivel }) => {
            const lider = esLider(nodos, n.codigo); const p = perfilDe.get(n.codigo);
            const al = p ? alertas.filter((a) => a.usuario_id === p.id).length : 0;
            const plano = !!q.trim() || !!equipoFiltro;
            return (
              <div key={n.codigo} className="flex items-center gap-2 px-3 py-2.5 hover:bg-slate-50" style={{ paddingLeft: plano ? 12 : 12 + Math.min(nivel, 8) * 20 }}>
                {lider && !plano ? (
                  <button className="rounded p-0.5 text-slate-400 hover:bg-slate-200" onClick={() => { const s = new Set(plegados); s.has(n.codigo) ? s.delete(n.codigo) : s.add(n.codigo); setPlegados(s); }}>
                    <ChevronRight size={16} className={plegados.has(n.codigo) ? '' : 'rotate-90'} /></button>
                ) : <span className="w-5" />}
                <button className="min-w-0 flex-1 text-left" onClick={() => setDetalle(n)}>
                  <p className="flex flex-wrap items-center gap-x-2 text-sm font-medium text-slate-900">
                    <span className="font-mono text-xs text-royal-600">{n.codigo}</span>{n.nombre}
                    {lider && <span className="chip bg-royal-50 text-royal-700">{etiquetaEquipo(n) ?? 'Líder'}</span>}
                    {al > 0 && <span className="chip gap-1 bg-red-100 text-red-700"><AlertTriangle size={11} />{al}</span>}
                  </p>
                  {plano && n.superior && <p className="text-xs text-slate-500">Superior: {nodos.find((x) => x.codigo === n.superior)?.nombre ?? n.superior}</p>}
                </button>
                <span className="hidden sm:inline">{estadoCuenta(n)}</span>
                <button className="rounded-full p-1.5 text-slate-500 hover:bg-slate-200" title="Agregar dependientes" onClick={() => setAlta({ superior: n.codigo, lineas: '' })}><Plus size={16} /></button>
                <button className="rounded-full p-1.5 text-slate-500 hover:bg-slate-200" title="Editar" onClick={() => setEditar({ ...n })}><Pencil size={15} /></button>
              </div>
            );
          })}
        </div>
      </>)}

      {tab === 'objetivos' && <Objetivos />}

      {tab === 'capacitacion' && nodos && <CapacitacionRed nodos={nodos} perfiles={perfiles} enRed={enRed} esAdmin={esAdmin} mio={mio} onVer={setDetalle} />}

      {tab === 'pendientes' && (pendientes.length === 0 ? <Empty icon={<Check size={30} />} title="No hay cuentas por aprobar" text="Acá aparecen los vendedores de tu red que ya verificaron su celular." /> : (
        <div className="space-y-5">
          {[{ t: 'Te corresponde aprobar', d: 'Dependen directamente de vos.', l: pendientes.filter((p) => nodos.find((x) => x.codigo === p.codigo_vendedor)?.superior === mio) },
            { t: 'Resto de tu red', d: 'Las aprueba su líder directo, pero podés aprobarlas vos si hace falta.', l: pendientes.filter((p) => nodos.find((x) => x.codigo === p.codigo_vendedor)?.superior !== mio) }]
            .filter((g) => g.l.length > 0).map((g) => (
            <div key={g.t}>
              <p className="font-bold text-royal-900">{g.t} <span className="text-slate-400">({g.l.length})</span></p>
              <p className="mb-2 text-xs text-slate-500">{g.d}</p>
              <div className="card divide-y divide-slate-100">
                {g.l.map((p) => {
                  const n = nodos.find((x) => x.codigo === p.codigo_vendedor);
                  const resp = nodos.find((x) => x.codigo === n?.superior);
                  return (
                    <div key={p.id} className="flex flex-wrap items-center gap-3 p-4">
                      <div className="min-w-0 flex-1"><p className="font-medium">{p.nombre} <span className="font-mono text-xs text-royal-600">{p.codigo_vendedor}</span></p>
                        <p className="text-xs text-slate-500">{p.email} · {p.celular} ✓ · Responsable: {resp ? `${resp.nombre} (${resp.codigo})` : '—'}</p></div>
                      <button className="btn-primary px-3 py-1.5" onClick={() => actualizarPerfil(p, { aprobado: true }, 'Cuenta aprobada')}><Check size={15} /> Aprobar</button>
                      <button className="btn-ghost px-3 py-1.5 text-coral-600" onClick={() => borrarCuenta(p)}><X size={15} /> Rechazar</button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ))}

      {tab === 'alertas' && (alertas.length === 0 ? <Empty icon={<AlertTriangle size={30} />} title="Sin alertas" text="Te avisamos acá si una cuenta de tu red ingresa desde lugares distintos en poco tiempo o desde un dispositivo dado de baja." /> : (
        <div className="card divide-y divide-slate-100">
          {alertas.map((a) => { const p = nombreUsuario(a.usuario_id); return (
            <div key={a.id} className="flex items-start gap-3 p-4 text-sm">
              <AlertTriangle size={18} className="mt-0.5 shrink-0 text-red-600" />
              <div className="min-w-0 flex-1"><p className="font-medium">{p?.nombre ?? 'Usuario'} <span className="font-mono text-xs text-royal-600">{p?.codigo_vendedor}</span></p>
                <p className="text-red-700">{a.alerta}</p><p className="text-xs text-slate-500">{fh(a.created_at)} · {a.dispositivo ?? '—'} · {[a.ciudad, a.pais].filter(Boolean).join(', ')}</p></div>
              {p && <button className="btn-secondary px-3 py-1.5" onClick={() => { const n = nodos.find((x) => x.codigo === p.codigo_vendedor); if (n) setDetalle(n); }}>Ver</button>}
            </div>); })}
        </div>
      ))}

      {/* Detalle de un código / cuenta */}
      <Modal open={!!detalle} onClose={() => setDetalle(null)} title={detalle ? `${detalle.nombre} · ${detalle.codigo}` : ''} wide>
        {detalle && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">{estadoCuenta(detalle)}{etiquetaEquipo(detalle) && <span className="chip bg-royal-50 text-royal-700">{etiquetaEquipo(detalle)}</span>}
              <span className="text-sm text-slate-500">Superior: {nodos.find((x) => x.codigo === detalle.superior)?.nombre ?? '—'}</span></div>
            {!pDet ? <p className="text-sm text-slate-500">Este código todavía no tiene cuenta. El vendedor se registra con <b>{detalle.codigo}</b>.</p> : (<>
              <div className="grid gap-1 text-sm text-slate-600"><p>{pDet.email}</p><p>{pDet.celular} {pDet.telefono_verificado ? '✓ verificado' : '(sin verificar)'}</p></div>
              {pDet.id !== profile?.id && (
                <div className="flex flex-wrap gap-2">
                  {!pDet.aprobado && pDet.telefono_verificado && <button className="btn-primary" onClick={() => actualizarPerfil(pDet, { aprobado: true }, 'Cuenta aprobada')}><Check size={16} /> Aprobar</button>}
                  <button className="btn-secondary" onClick={() => actualizarPerfil(pDet, { suspendido: !pDet.suspendido }, pDet.suspendido ? 'Cuenta reactivada' : 'Cuenta deshabilitada')}><Ban size={16} />{pDet.suspendido ? 'Reactivar' : 'Deshabilitar'}</button>
                  <button className="btn-ghost text-coral-600" onClick={() => borrarCuenta(pDet)}><Trash2 size={16} /> Borrar cuenta</button>
                </div>
              )}
              <div className="rounded-2xl bg-slate-50 p-4"><p className="label">Ventas</p><VentasVendedor uid={pDet.id} /></div>
              <div className="rounded-2xl bg-slate-50 p-4"><p className="label">Puesto en desafíos vigentes</p><PuestosVendedor uid={pDet.id} /></div>
              <div className="rounded-2xl bg-slate-50 p-4"><p className="label">Avance en capacitación</p><CapacitacionVendedor uid={pDet.id} /></div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="label">Dispositivos ({disps.filter((d) => d.usuario_id === pDet.id && d.verificado_at && !d.revocado).length}/{pDet.max_dispositivos})</p>
                  {disps.filter((d) => d.usuario_id === pDet.id).map((d) => (
                    <div key={d.id} className="mb-2 flex items-center gap-2 rounded-xl bg-white p-2.5 text-sm"><Smartphone size={16} className="text-royal-600" />
                      <div className="min-w-0 flex-1"><p className="truncate font-medium">{d.nombre ?? 'Dispositivo'}</p><p className="text-xs text-slate-500">Último uso {fh(d.ultimo_acceso)}</p></div>
                      {pDet.id !== profile?.id && <button className="rounded-full p-1.5 text-coral-600 hover:bg-red-50" onClick={() => liberar(d)}><Trash2 size={15} /></button>}
                    </div>))}
                  {pDet.id !== profile?.id && <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <label className="text-xs text-slate-500">Máx. dispositivos<select className="input mt-1 py-1.5" value={pDet.max_dispositivos} onChange={(e) => actualizarPerfil(pDet, { max_dispositivos: Number(e.target.value) }, 'Límite actualizado')}>{[1, 2, 3, 4].map((x) => <option key={x}>{x}</option>)}</select></label>
                    <label className="text-xs text-slate-500">Celular<input className="input mt-1 py-1.5" defaultValue={pDet.celular ?? ''} onBlur={(e) => e.target.value !== (pDet.celular ?? '') && actualizarPerfil(pDet, { celular: e.target.value }, 'Celular actualizado: deberá verificarlo')} /></label>
                  </div>}
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="label">Últimos ingresos</p>
                  <ul className="space-y-1.5 text-xs">{accesos.filter((a) => a.usuario_id === pDet.id).slice(0, 8).map((a) => (
                    <li key={a.id} className={`rounded-lg p-2 ${a.alerta ? 'bg-red-50 text-red-700' : 'bg-white text-slate-600'}`}><b>{fh(a.created_at)}</b> · {a.dispositivo ?? '—'} · {[a.ciudad, a.pais].filter(Boolean).join(', ') || 'ubicación desconocida'}{a.alerta && <p className="font-semibold">{a.alerta}</p>}</li>))}
                    {!accesos.some((a) => a.usuario_id === pDet.id) && <li className="text-slate-500">Sin ingresos registrados.</li>}</ul>
                </div>
              </div>
            </>)}
          </div>
        )}
      </Modal>

      {/* Editar código */}
      <Modal open={!!editar} onClose={() => setEditar(null)} title={editar ? `Editar ${editar.codigo}` : ''}>
        {editar && (
          <form onSubmit={guardarNodo} className="space-y-3.5">
            <div><label className="label">Nombre</label><input className="input" value={editar.nombre} onChange={(e) => setEditar({ ...editar, nombre: e.target.value })} required /></div>
            <div className="grid grid-cols-[110px_1fr] gap-3">
              <div><label className="label">Nro. equipo</label><input className="input" value={editar.equipo_numero ?? ''} onChange={(e) => setEditar({ ...editar, equipo_numero: e.target.value })} /></div>
              <div><label className="label">Nombre del equipo</label><input className="input" value={editar.equipo_nombre ?? ''} onChange={(e) => setEditar({ ...editar, equipo_nombre: e.target.value })} /></div>
            </div>
            {(editar.codigo !== mio || esAdmin) && (
              <div><label className="label">Depende de</label>
                <select className="input" value={editar.superior ?? ''} onChange={(e) => setEditar({ ...editar, superior: e.target.value || null })}>
                  {esAdmin && <option value="">— Sin superior (raíz) —</option>}
                  {supOpciones(editar).map((x) => <option key={x.codigo} value={x.codigo}>{x.nombre} · {x.codigo}{etiquetaEquipo(x) ? ` (${etiquetaEquipo(x)})` : ''}</option>)}
                </select>
                <p className="mt-1 text-xs text-slate-500">Al cambiarlo se mueve también toda su rama.</p></div>
            )}
            {editar.codigo !== mio && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editar.activo} onChange={(e) => setEditar({ ...editar, activo: e.target.checked })} /> Código habilitado para registrarse</label>}
            <button className="btn-primary w-full" disabled={busy}>{busy && <Loader2 className="animate-spin" size={18} />}Guardar</button>
            {editar.codigo !== mio && <button type="button" className="btn-ghost w-full text-coral-600" onClick={() => borrarNodo(editar)}><Trash2 size={16} /> Eliminar código</button>}
          </form>
        )}
      </Modal>

      {/* Alta de códigos */}
      <Modal open={!!alta} onClose={() => setAlta(null)} title="Cargar códigos">
        {alta && (
          <form onSubmit={cargarCodigos} className="space-y-3.5">
            <div><label className="label">Dependen de</label>
              <select className="input" value={alta.superior} onChange={(e) => setAlta({ ...alta, superior: e.target.value })}>
                {nodos.filter((x) => enRed.has(x.codigo)).sort((a, b) => a.nombre.localeCompare(b.nombre)).map((x) => <option key={x.codigo} value={x.codigo}>{x.nombre} · {x.codigo}</option>)}
              </select></div>
            <div><label className="label">Un código por línea: código; nombre y apellido</label>
              <textarea className="input min-h-[180px] font-mono text-xs" placeholder={'10234; Juan Pérez\n10235; María Gómez'} value={alta.lineas} onChange={(e) => setAlta({ ...alta, lineas: e.target.value })} required />
              <p className="mt-1 text-xs text-slate-500">Podés pegar desde Excel (código y nombre en dos columnas).</p></div>
            <button className="btn-primary w-full" disabled={busy}>{busy && <Loader2 className="animate-spin" size={18} />}Cargar</button>
          </form>
        )}
      </Modal>
      <Toast msg={toast.msg} kind={toast.kind} />
    </div>
  );
}
