'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { BookOpen, Calculator, CalendarDays, BarChart3, Receipt, Store, ChefHat, GraduationCap, ArrowRight, MapPin, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';
import { pesos, hoyISO, EVENTO_COLOR } from '@/lib/format';
import type { Tarea } from '@/lib/types';
import { Stat } from '@/components/ui';

const ACCESOS = [
  { href: '/catalogo', label: 'Catálogo', text: 'Productos y fichas', icon: BookOpen, color: 'from-royal-500 to-royal-700' },
  { href: '/cotizador', label: 'Cotizador', text: 'Cuotas al instante', icon: Calculator, color: 'from-coral-500 to-coral-600' },
  { href: '/cronograma', label: 'Agenda', text: 'Demos y visitas', icon: CalendarDays, color: 'from-emerald-500 to-emerald-700' },
  { href: '/estadisticas', label: 'Estadísticas', text: 'Tus resultados', icon: BarChart3, color: 'from-amber-500 to-orange-600' },
  { href: '/ventas', label: 'Mis pedidos', text: 'Historial de ventas', icon: Receipt, color: 'from-sky-500 to-blue-700' },
  { href: '/marketplace', label: 'Marketplace', text: 'Comprá y vendé', icon: Store, color: 'from-violet-500 to-purple-700' },
  { href: '/recetas', label: 'Recetas Royal', text: 'Próximamente', icon: ChefHat, color: 'from-rose-500 to-red-600' },
  { href: '/capacitacion', label: 'Capacitación', text: 'Próximamente', icon: GraduationCap, color: 'from-teal-500 to-cyan-700' },
];

export default function Inicio() {
  const { profile } = useAuth();
  const [mes, setMes] = useState({ total: 0, cant: 0 });
  const [tareas, setTareas] = useState<Tarea[]>([]);

  useEffect(() => {
    const d = new Date(); const inicio = new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
    supabase.from('pedidos').select('total').eq('usuario_id', profile!.id).gte('created_at', inicio)
      .then(({ data }) => setMes({ total: (data ?? []).reduce((s, p) => s + Number(p.total), 0), cant: data?.length ?? 0 }));
    supabase.from('tareas').select('*').gte('fecha', hoyISO()).order('fecha').order('horario').limit(5)
      .then(({ data }) => setTareas((data as Tarea[]) ?? []));
  }, [profile]);

  const hora = new Date().getHours();
  const saludo = hora < 12 ? 'Buen día' : hora < 20 ? 'Buenas tardes' : 'Buenas noches';

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-royal-600 to-royal-900 p-6 text-white shadow-lg md:p-8">
        <p className="text-sm text-royal-100">{saludo},</p>
        <h1 className="text-2xl font-bold md:text-3xl">{profile?.nombre.split(' ')[0]}</h1>
        <div className="mt-5 grid grid-cols-2 gap-3 md:max-w-md">
          <div className="rounded-2xl bg-white/10 p-3"><p className="text-xs text-royal-100">Vendido este mes</p><p className="mt-1 text-lg font-bold md:text-xl">{pesos(mes.total)}</p></div>
          <div className="rounded-2xl bg-white/10 p-3"><p className="text-xs text-royal-100">Pedidos</p><p className="mt-1 text-lg font-bold md:text-xl">{mes.cant}</p></div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        {ACCESOS.map(({ href, label, text, icon: Icon, color }) => (
          <Link key={href} href={href} className="card group p-4 transition hover:-translate-y-0.5 hover:shadow-md">
            <div className={`mb-3 inline-flex rounded-xl bg-gradient-to-br ${color} p-2.5 text-white`}><Icon size={22} /></div>
            <p className="font-semibold text-slate-900">{label}</p>
            <p className="text-xs text-slate-500">{text}</p>
          </Link>
        ))}
      </div>

      <div className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-bold text-royal-900">Próximas actividades</h2>
          <Link href="/cronograma" className="flex items-center gap-1 text-sm font-semibold text-royal-600">Ver agenda <ArrowRight size={15} /></Link>
        </div>
        {tareas.length === 0 ? <p className="py-6 text-center text-sm text-slate-500">No tenés actividades próximas.</p> : (
          <ul className="divide-y divide-slate-100">
            {tareas.map((t) => (
              <li key={t.id} className="flex items-center gap-3 py-3">
                <div className="w-12 shrink-0 text-center"><p className="text-lg font-bold leading-none text-royal-700">{t.fecha.slice(8, 10)}</p><p className="text-[11px] uppercase text-slate-500">{new Date(t.fecha + 'T12:00').toLocaleDateString('es-AR', { month: 'short' })}</p></div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{t.titulo}</p>
                  <p className="flex flex-wrap gap-x-3 text-xs text-slate-500">{t.horario && <span className="flex items-center gap-1"><Clock size={12} />{t.horario.slice(0, 5)}</span>}{t.ubicacion && <span className="flex items-center gap-1"><MapPin size={12} />{t.ubicacion}</span>}</p>
                </div>
                <span className={`chip ${EVENTO_COLOR[t.evento]}`}>{t.evento}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
