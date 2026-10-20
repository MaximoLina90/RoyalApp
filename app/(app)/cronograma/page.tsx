'use client';
import { useEffect, useMemo, useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Plus, MapPin, Clock, Pencil, Trash2, CalendarDays } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';
import { PageHeader, Modal, Toast } from '@/components/ui';
import { useToast } from '@/components/useToast';
import { MESES, EVENTO_COLOR, EVENTO_DOT, hoyISO } from '@/lib/format';
import { EVENTOS, type Tarea, type Evento } from '@/lib/types';

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const iso = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const vacia = { evento: 'Demo' as Evento, titulo: '', horario: '', ubicacion: '', notas: '' };

export default function Cronograma() {
  const { profile } = useAuth();
  const toast = useToast();
  const hoy = hoyISO();
  const [y, setY] = useState(Number(hoy.slice(0, 4)));
  const [m, setM] = useState(Number(hoy.slice(5, 7)) - 1);
  const [sel, setSel] = useState(hoy);
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [form, setForm] = useState<typeof vacia & { id?: string } | null>(null);

  const cargar = useCallback(async () => {
    const desde = iso(y, m, 1), hasta = iso(y, m, new Date(y, m + 1, 0).getDate());
    const { data } = await supabase.from('tareas').select('*').gte('fecha', desde).lte('fecha', hasta).order('horario', { nullsFirst: true });
    setTareas((data as Tarea[]) ?? []);
  }, [y, m]);
  useEffect(() => { cargar(); }, [cargar]);

  const celdas = useMemo(() => {
    const offset = (new Date(y, m, 1).getDay() + 6) % 7;
    const dias = new Date(y, m + 1, 0).getDate();
    return [...Array(offset).fill(null), ...Array.from({ length: dias }, (_, i) => i + 1)];
  }, [y, m]);
  const porDia = useMemo(() => tareas.reduce<Record<string, Tarea[]>>((a, t) => { (a[t.fecha] ||= []).push(t); return a; }, {}), [tareas]);
  const delDia = porDia[sel] ?? [];

  const mover = (d: number) => { const nm = m + d; const ny = y + Math.floor(nm / 12); const mm = ((nm % 12) + 12) % 12; setY(ny); setM(mm); };

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault(); if (!form) return;
    const payload = { evento: form.evento, titulo: form.titulo, horario: form.horario || null, ubicacion: form.ubicacion || null, notas: form.notas || null };
    const { error } = form.id
      ? await supabase.from('tareas').update(payload).eq('id', form.id)
      : await supabase.from('tareas').insert({ ...payload, fecha: sel, usuario_id: profile!.id });
    if (error) return toast.show(error.message, 'error');
    toast.show(form.id ? 'La tarea se modificó correctamente' : 'La tarea se registró correctamente');
    setForm(null); cargar();
  };
  const borrar = async (id: string) => { if (!confirm('¿Eliminar la tarea?')) return; await supabase.from('tareas').delete().eq('id', id); cargar(); };
  const fechaLarga = new Date(sel + 'T12:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div>
      <PageHeader title="Agenda" subtitle="Demos, entrevistas, capacitaciones y servicios." action={<button className="btn-primary" onClick={() => setForm({ ...vacia })}><Plus size={18} /> Nueva tarea</button>} />
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="card p-4 md:p-5">
          <div className="mb-4 flex items-center justify-between">
            <button className="rounded-full p-2 hover:bg-slate-100" onClick={() => mover(-1)} aria-label="Mes anterior"><ChevronLeft /></button>
            <p className="text-lg font-bold text-royal-900">{MESES[m]} {y}</p>
            <button className="rounded-full p-2 hover:bg-slate-100" onClick={() => mover(1)} aria-label="Mes siguiente"><ChevronRight /></button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-slate-400">{DIAS.map((d) => <div key={d} className="py-1">{d}</div>)}</div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {celdas.map((d, i) => {
              if (!d) return <div key={i} />;
              const f = iso(y, m, d); const ts = porDia[f] ?? []; const isSel = f === sel; const isHoy = f === hoy; const finde = i % 7 >= 5;
              return (
                <button key={i} onClick={() => setSel(f)} className={`flex aspect-square flex-col items-center justify-start rounded-xl p-1 text-sm transition md:aspect-[4/3] md:items-start md:p-2 ${isSel ? 'bg-royal-600 text-white shadow' : isHoy ? 'bg-royal-50 font-bold text-royal-700' : finde ? 'text-coral-500 hover:bg-slate-50' : 'hover:bg-slate-50'}`}>
                  <span className="font-semibold">{d}</span>
                  <span className="mt-auto flex gap-0.5 md:hidden">{ts.slice(0, 3).map((t) => <span key={t.id} className={`h-1.5 w-1.5 rounded-full ${isSel ? 'bg-white' : EVENTO_DOT[t.evento]}`} />)}</span>
                  <span className="mt-1 hidden w-full space-y-0.5 md:block">{ts.slice(0, 2).map((t) => <span key={t.id} className={`block truncate rounded px-1 text-left text-[10px] font-medium ${isSel ? 'bg-white/20' : EVENTO_COLOR[t.evento]}`}>{t.titulo}</span>)}{ts.length > 2 && <span className="block text-left text-[10px] opacity-70">+{ts.length - 2}</span>}</span>
                </button>
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-500">{EVENTOS.map((e) => <span key={e} className="flex items-center gap-1.5"><span className={`h-2 w-2 rounded-full ${EVENTO_DOT[e]}`} />{e}</span>)}</div>
        </div>

        <div className="card p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Día seleccionado</p>
          <p className="mb-4 text-lg font-bold capitalize text-royal-900">{fechaLarga}</p>
          {delDia.length === 0 ? (
            <div className="py-8 text-center"><CalendarDays className="mx-auto mb-2 text-slate-300" size={36} /><p className="text-sm text-slate-500">Sin tareas para este día.</p><button className="btn-secondary mt-3" onClick={() => setForm({ ...vacia })}><Plus size={16} /> Agregar</button></div>
          ) : (
            <ul className="space-y-3">
              {delDia.map((t) => (
                <li key={t.id} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0"><span className={`chip ${EVENTO_COLOR[t.evento]}`}>{t.evento}</span><p className="mt-1.5 font-semibold">{t.titulo}</p></div>
                    <div className="flex shrink-0">
                      <button className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-royal-600" onClick={() => setForm({ id: t.id, evento: t.evento, titulo: t.titulo, horario: t.horario?.slice(0, 5) ?? '', ubicacion: t.ubicacion ?? '', notas: t.notas ?? '' })} aria-label="Editar"><Pencil size={15} /></button>
                      <button className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-coral-500" onClick={() => borrar(t.id)} aria-label="Eliminar"><Trash2 size={15} /></button>
                    </div>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-slate-500">{t.horario && <span className="flex items-center gap-1"><Clock size={12} />{t.horario.slice(0, 5)}</span>}{t.ubicacion && <span className="flex items-center gap-1"><MapPin size={12} />{t.ubicacion}</span>}</div>
                  {t.notas && <p className="mt-2 whitespace-pre-line text-sm text-slate-600">{t.notas}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <Modal open={!!form} onClose={() => setForm(null)} title={form?.id ? 'Editar tarea' : 'Nueva tarea'}>
        {form && (
          <form onSubmit={guardar} className="space-y-3.5">
            <p className="text-sm capitalize text-slate-500">Fecha: <span className="font-semibold text-slate-800">{fechaLarga}</span></p>
            <div><label className="label">Tipo</label><div className="flex flex-wrap gap-1.5">{EVENTOS.map((e) => <button type="button" key={e} onClick={() => setForm({ ...form, evento: e })} className={`chip px-3 py-1.5 ${form.evento === e ? EVENTO_COLOR[e] : 'bg-slate-100 text-slate-600'}`}>{e}</button>)}</div></div>
            <div><label className="label">Título</label><input className="input" value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} required /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Horario</label><input className="input" type="time" value={form.horario} onChange={(e) => setForm({ ...form, horario: e.target.value })} /></div>
              <div><label className="label">Ubicación</label><input className="input" value={form.ubicacion} onChange={(e) => setForm({ ...form, ubicacion: e.target.value })} /></div>
            </div>
            <div><label className="label">Notas</label><textarea className="input min-h-[90px]" value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} /></div>
            <button className="btn-primary w-full">{form.id ? 'Guardar cambios' : 'Crear tarea'}</button>
          </form>
        )}
      </Modal>
      <Toast msg={toast.msg} kind={toast.kind} />
    </div>
  );
}
