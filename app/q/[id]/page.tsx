import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { MessageCircle, Heart } from 'lucide-react';
import { Rastreo, BotonWa } from '@/components/Rastreo';
import { anonimo, uuidOk, waLink } from '@/lib/publico';
import { calcular, PORCENTAJES, PLANES } from '@/lib/cotizador';
import { pesos } from '@/lib/format';
import type { ItemPedido } from '@/lib/types';

export const dynamic = 'force-dynamic';

type Datos = {
  presupuesto: { id: string; cliente: string | null; items: ItemPedido[]; porcentaje: number; cuotas: number; factores: Record<string, number>; dias_mes: number; created_at: string };
  vendedor: { id: string; nombre: string | null; celular: string | null };
} | null;
type Props = { params: { id: string } };

async function cargar(id: string): Promise<Datos> {
  if (!uuidOk(id)) return null;
  const { data } = await anonimo().rpc('presupuesto_publico', { p_id: id });
  return (data as Datos) ?? null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const d = await cargar(params.id);
  return { title: d ? `Presupuesto Royal Prestige${d.presupuesto.cliente ? ' para ' + d.presupuesto.cliente : ''}` : 'Presupuesto Royal Prestige', robots: { index: false } };
}

export default async function PresupuestoPublico({ params }: Props) {
  const d = await cargar(params.id);
  if (!d) notFound();
  const { presupuesto: q, vendedor } = d;
  const r = calcular(q.items, q.porcentaje, q.cuotas, q.factores, q.dias_mes);
  const fecha = new Date(q.created_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Argentina/Buenos_Aires' });
  const forma = r.financiado ? `entrega del ${q.porcentaje}% y ${q.cuotas} cuotas de ${pesos(r.cuota)}` : 'pago de contado';
  const nombres = q.items.map((i) => i.nombre).join(', ');
  const titulo = `Presupuesto ${pesos(r.total)}`;
  const wa = waLink(vendedor.celular, `Hola ${vendedor.nombre ?? ''}! Vi el presupuesto (${nombres}, ${forma}) y tengo una consulta.`);
  const quiero = waLink(vendedor.celular, `Hola ${vendedor.nombre ?? ''}! ¡Lo quiero! Acepto el presupuesto de ${nombres} con ${forma}. ¿Cómo seguimos?`);
  const filas = PLANES.filter((c) => q.factores[String(c)]);

  return (
    <div className="min-h-screen bg-slate-50 pb-28">
      <Rastreo v={vendedor.id} tipo="presupuesto" refId={q.id} titulo={titulo} />
      <header className="bg-gradient-to-r from-royal-800 to-royal-600 px-4 py-3 text-white">
        <div className="mx-auto flex max-w-3xl items-center gap-2">
          <img src="/logo.png" alt="" className="h-8 w-8 rounded-lg bg-white object-contain p-0.5" />
          <span className="font-bold">Presupuesto Royal Prestige®</span>
        </div>
      </header>
      <main className="mx-auto max-w-3xl space-y-5 p-4">
        <div>
          <h1 className="text-2xl font-bold text-royal-900">{q.cliente ? `Hola ${q.cliente.split(' ')[0]}, este es tu presupuesto` : 'Tu presupuesto'}</h1>
          <p className="mt-1 text-sm text-slate-500">Preparado por {vendedor.nombre} el {fecha}. Precios de lista sujetos a cambios.</p>
        </div>

        <div className="divide-y divide-slate-100 rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
          {q.items.map((i) => (
            <div key={i.id} className="flex items-center gap-3 p-4">
              <div className="min-w-0 flex-1"><p className="font-medium leading-snug">{i.nombre}</p><p className="text-xs text-slate-500">{i.cantidad} × {pesos(i.precio)}</p></div>
              <p className="font-semibold">{pesos(i.precio * i.cantidad)}</p>
            </div>
          ))}
          <div className="flex justify-between p-4 text-lg font-bold text-royal-900"><span>Total</span><span>{pesos(r.total)}</span></div>
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-royal-600 to-royal-900 p-5 text-white shadow-lg">
          <p className="text-xs uppercase tracking-wide text-royal-100">Forma de pago elegida</p>
          {r.financiado ? (<>
            <p className="mt-1 text-sm text-royal-100">Entrega {q.porcentaje}%: <b className="text-white">{pesos(r.entrega)}</b></p>
            <p className="mt-2 text-4xl font-bold">{q.cuotas} × {pesos(r.cuota)}</p>
            <p className="mt-1 text-sm text-royal-100">Equivale a {pesos(r.diario)} por día</p>
          </>) : <p className="mt-1 text-3xl font-bold">Contado {pesos(r.total)}</p>}
        </div>

        {filas.length > 0 && (
          <section className="overflow-x-auto rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
            <h2 className="mb-2 font-bold text-royal-900">Todos los planes</h2>
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-slate-500"><th className="py-1.5">Cuotas</th>{PORCENTAJES.map((p) => <th key={p} className="py-1.5 text-right">Entrega {p}%<br /><span className="font-normal">{pesos(Math.round(r.total * p / 100))}</span></th>)}</tr></thead>
              <tbody>
                {filas.map((c) => (
                  <tr key={c} className="border-t border-slate-100">
                    <td className="py-2 font-semibold">{c}</td>
                    {PORCENTAJES.map((p) => {
                      const x = calcular(q.items, p, c, q.factores, q.dias_mes);
                      const sel = r.financiado && p === q.porcentaje && c === q.cuotas;
                      return <td key={p} className={`py-2 text-right ${sel ? 'rounded-md bg-royal-100 font-bold text-royal-800' : ''}`}>{pesos(x.cuota)}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {quiero && (
          <div className="space-y-2">
            <BotonWa href={quiero} v={vendedor.id} tipo="presupuesto" refId={q.id} titulo={titulo} evento="lo_quiero" className="flex items-center justify-center gap-2 rounded-xl bg-coral-500 px-4 py-3.5 text-lg font-bold text-white shadow hover:bg-coral-600"><Heart size={20} /> ¡Lo quiero!</BotonWa>
            {wa && <BotonWa href={wa} v={vendedor.id} tipo="presupuesto" refId={q.id} titulo={titulo} className="flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 font-semibold text-emerald-700 ring-1 ring-emerald-200"><MessageCircle size={18} /> Tengo una consulta</BotonWa>}
          </div>
        )}
      </main>
    </div>
  );
}
