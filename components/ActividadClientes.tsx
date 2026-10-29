'use client';
import { useEffect, useMemo, useState } from 'react';
import { Eye, MessageCircle, Heart, ChefHat, Package, Receipt, BellRing } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './AuthProvider';

export interface Apertura { id: number; vendedor: string; vendedor_nombre: string; tipo: 'receta' | 'producto' | 'presupuesto'; ref: string; titulo: string | null; evento: 'vista' | 'whatsapp' | 'lo_quiero'; created_at: string }

const TIPO = { receta: { l: 'receta', i: ChefHat }, producto: { l: 'producto', i: Package }, presupuesto: { l: 'presupuesto', i: Receipt } };
const EVENTO = {
  vista: { l: 'Abrió', i: Eye, c: 'bg-sky-50 text-sky-700' },
  whatsapp: { l: 'Te escribió por', i: MessageCircle, c: 'bg-emerald-50 text-emerald-700' },
  lo_quiero: { l: '¡Lo quiere!', i: Heart, c: 'bg-coral-50 text-coral-600' },
};

function hace(iso: string) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'recién';
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `hace ${h} h`;
  return new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
}

const href = (a: Apertura) => (a.tipo === 'receta' ? `/r/${a.ref}` : a.tipo === 'producto' ? `/p/${a.ref}` : `/q/${a.ref}`);

/** Avisos de lectura: quién abrió los links compartidos (receta, producto, presupuesto). */
export default function ActividadClientes({ compacto = false, soloMia = false, dias = 30 }: { compacto?: boolean; soloMia?: boolean; dias?: number }) {
  const { profile } = useAuth();
  const [items, setItems] = useState<Apertura[] | null>(null);
  useEffect(() => {
    supabase.rpc('actividad_clientes', { p_dias: dias, p_solo_mia: soloMia }).then(({ data }) => setItems((data as Apertura[]) ?? []));
  }, [dias, soloMia]);

  const resumen = useMemo(() => {
    const xs = items ?? [];
    return { vistas: xs.filter((a) => a.evento === 'vista').length, wa: xs.filter((a) => a.evento === 'whatsapp').length, quiero: xs.filter((a) => a.evento === 'lo_quiero').length };
  }, [items]);
  const lista = (items ?? []).slice(0, compacto ? 6 : 100);
  const deRed = (items ?? []).some((a) => a.vendedor !== profile?.id);

  return (
    <div className="card p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-bold text-royal-900"><BellRing size={18} /> Clientes interesados</h2>
        <div className="flex gap-1.5 text-xs">
          <span className="chip bg-sky-50 text-sky-700"><Eye size={12} className="mr-1" />{resumen.vistas}</span>
          <span className="chip bg-emerald-50 text-emerald-700"><MessageCircle size={12} className="mr-1" />{resumen.wa}</span>
          <span className="chip bg-coral-50 text-coral-600"><Heart size={12} className="mr-1" />{resumen.quiero}</span>
        </div>
      </div>
      {items === null ? <p className="py-4 text-center text-sm text-slate-400">Cargando…</p> : lista.length === 0 ? (
        <p className="py-4 text-center text-sm text-slate-500">Cuando un cliente abra una receta, un producto o un presupuesto que le compartiste, lo vas a ver acá.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {lista.map((a) => {
            const E = EVENTO[a.evento]; const T = TIPO[a.tipo];
            return (
              <li key={a.id} className="flex items-center gap-3 py-2.5">
                <span className={`rounded-full p-2 ${E.c}`}><E.i size={15} /></span>
                <a href={href(a)} target="_blank" rel="noreferrer" className="min-w-0 flex-1">
                  <p className="truncate text-sm"><span className="font-semibold">{E.l}</span>{a.evento === 'lo_quiero' ? ' ' : ` ${a.evento === 'whatsapp' ? 'WhatsApp desde' : 'tu'} ${T.l} `}<span className="text-slate-600">{a.titulo}</span></p>
                  <p className="text-xs text-slate-500">{hace(a.created_at)}{deRed && a.vendedor !== profile?.id ? ` · ${a.vendedor_nombre}` : ''}</p>
                </a>
                <T.i size={15} className="shrink-0 text-slate-300" />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
