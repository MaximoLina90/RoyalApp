'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Minus, Trash2, ShoppingCart, Search, Check, Share2, FileDown, MessageCircle, Link2 } from 'lucide-react';
import { generarPresupuesto } from '@/lib/presupuestoPdf';
import { useCart } from '@/components/CartProvider';
import { useCatalogo, useConfig } from '@/components/data';
import { PageHeader, Modal, Empty, Toast } from '@/components/ui';
import { useToast } from '@/components/useToast';
import { calcular, PORCENTAJES, PLANES } from '@/lib/cotizador';
import { pesos } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';

export default function Cotizador() {
  const router = useRouter();
  const { profile } = useAuth();
  const { items, add, setQty, remove, clear } = useCart();
  const { productos: todos, categorias } = useCatalogo();
  const productos = todos.filter((p) => p.activo);
  const cfg = useConfig();
  const toast = useToast();
  const [porc, setPorc] = useState(20);
  const [cuotas, setCuotas] = useState(1);
  const [picker, setPicker] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [cliente, setCliente] = useState('');
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<number | 'all'>('all');
  const [busy, setBusy] = useState(false);
  const [compartirOpen, setCompartirOpen] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);

  const r = calcular(items, porc, cuotas, cfg.factores, cfg.dias_mes);
  const lista = useMemo(() => productos.filter((p) => (cat === 'all' || p.categoria_id === cat) && p.nombre.toLowerCase().includes(q.toLowerCase())), [productos, cat, q]);

  const texto = () => [
    'Cotización Royal Prestige®', '',
    ...items.map((i) => `• ${i.cantidad} x ${i.nombre} — ${pesos(i.precio * i.cantidad)}`), '',
    `Total: ${pesos(r.total)}`,
    ...(r.financiado ? [`Entrega (${porc}%): ${pesos(r.entrega)}`, `${cuotas} cuotas de ${pesos(r.cuota)}`, `Equivale a ${pesos(r.diario)} por día`] : ['Pago de contado']),
    '', `Vendedor: ${profile?.nombre}${profile?.codigo_vendedor ? ' (Cód. ' + profile.codigo_vendedor + ')' : ''}${profile?.celular ? ' · ' + profile.celular : ''}`, 'Royal Prestige®',
  ].join('\n');

  const pdf = () => generarPresupuesto({ items, porcentaje: porc, cuotas, factores: cfg.factores, diasMes: cfg.dias_mes, cliente, vendedor: profile ?? null });

  const descargar = (blob: Blob, nombre: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = nombre; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  const compartirPdf = async () => {
    setPdfBusy(true);
    try {
      const { blob, nombre } = await pdf();
      const file = new File([blob], nombre, { type: 'application/pdf' });
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      if (nav.share && nav.canShare?.({ files: [file] })) {
        try { await nav.share({ files: [file], title: 'Presupuesto Royal Prestige', text: texto() }); setCompartirOpen(false); return; }
        catch (e) { if ((e as Error)?.name === 'AbortError') return; }
      }
      descargar(blob, nombre);
      toast.show('PDF descargado. Adjuntalo en WhatsApp o por mail.');
      setCompartirOpen(false);
    } catch (e) {
      toast.show('No se pudo generar el PDF', 'error');
    } finally { setPdfBusy(false); }
  };

  const bajarPdf = async () => {
    setPdfBusy(true);
    try { const { blob, nombre } = await pdf(); descargar(blob, nombre); setCompartirOpen(false); }
    catch { toast.show('No se pudo generar el PDF', 'error'); }
    finally { setPdfBusy(false); }
  };

  const enviarLink = async () => {
    setPdfBusy(true);
    const { data, error } = await supabase.from('presupuestos').insert({
      cliente: cliente.trim() || null, items, porcentaje: r.financiado ? porc : 0, cuotas: r.financiado ? cuotas : 1, factores: cfg.factores, dias_mes: cfg.dias_mes,
    }).select('id').single();
    setPdfBusy(false);
    if (error || !data) return toast.show('No se pudo crear el link', 'error');
    const url = `${window.location.origin}/q/${data.id}`;
    const t = `Hola${cliente.trim() ? ' ' + cliente.trim().split(' ')[0] : ''}! Te paso el presupuesto Royal Prestige®, con todos los planes de cuotas:`;
    if (navigator.share) { try { await navigator.share({ title: 'Presupuesto Royal Prestige', text: t, url }); setCompartirOpen(false); return; } catch (e) { if ((e as Error)?.name === 'AbortError') return; } }
    window.open(`https://wa.me/?text=${encodeURIComponent(`${t}\n${url}`)}`, '_blank');
    setCompartirOpen(false);
  };

  const compartirTexto = () => window.open('https://wa.me/?text=' + encodeURIComponent(texto()), '_blank');

  const guardar = async () => {
    setBusy(true);
    const { error } = await supabase.from('pedidos').insert({
      usuario_id: profile!.id, numero: 0, cliente: cliente || null, total: r.total, entrega: r.entrega, porcentaje_entrega: r.financiado ? porc : 0,
      cuotas: r.financiado ? cuotas : 1, cuota: r.cuota, pago: r.financiado ? 'Financiado' : 'Contado', items,
    });
    setBusy(false);
    if (error) return toast.show('No se pudo guardar: ' + error.message, 'error');
    clear(); setConfirmar(false); setCliente('');
    toast.show('Pedido confirmado');
    setTimeout(() => router.push('/ventas'), 700);
  };

  return (
    <div>
      <PageHeader title="Cotizador" subtitle="Armá el pedido y calculá entrega y cuotas al instante."
        action={<button className="btn-primary" onClick={() => setPicker(true)}><Plus size={18} /> Agregar productos</button>} />

      {items.length === 0 ? (
        <Empty icon={<ShoppingCart size={28} />} title="No hay productos seleccionados" text="Agregá productos desde acá o desde el catálogo para empezar a cotizar."
          action={<button className="btn-primary" onClick={() => setPicker(true)}><Plus size={18} /> Agregar productos</button>} />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
          <div className="card divide-y divide-slate-100">
            {items.map((i) => (
              <div key={i.id} className="flex items-center gap-3 p-4">
                <div className="min-w-0 flex-1"><p className="font-medium leading-snug">{i.nombre}</p><p className="text-xs text-slate-500">{pesos(i.precio)} c/u</p></div>
                <div className="flex items-center rounded-xl border border-slate-200">
                  <button className="p-2 text-slate-500 hover:text-royal-600" onClick={() => setQty(i.id, i.cantidad - 1)} aria-label="Restar"><Minus size={15} /></button>
                  <span className="w-6 text-center text-sm font-semibold">{i.cantidad}</span>
                  <button className="p-2 text-slate-500 hover:text-royal-600" onClick={() => setQty(i.id, i.cantidad + 1)} aria-label="Sumar"><Plus size={15} /></button>
                </div>
                <p className="hidden w-28 text-right font-semibold sm:block">{pesos(i.precio * i.cantidad)}</p>
                <button className="p-2 text-slate-400 hover:text-coral-500" onClick={() => remove(i.id)} aria-label="Quitar"><Trash2 size={17} /></button>
              </div>
            ))}
          </div>

          <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
            <div className="card space-y-4 p-5">
              <div>
                <label className="label" htmlFor="cliente">Cliente</label>
                <input id="cliente" className="input" value={cliente} onChange={(e) => setCliente(e.target.value)} placeholder="Nombre del cliente (opcional)" />
              </div>
              <div>
                <p className="label">Forma de pago</p>
                <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
                  <button className={`seg ${cuotas === 1 ? 'seg-on' : 'seg-off'}`} onClick={() => setCuotas(1)}>Contado</button>
                  <button className={`seg ${cuotas > 1 ? 'seg-on' : 'seg-off'}`} onClick={() => setCuotas(cuotas > 1 ? cuotas : 12)}>Financiado</button>
                </div>
              </div>
              {cuotas > 1 && (<>
                <div>
                  <p className="label">Entrega</p>
                  <div className="flex gap-1 rounded-xl bg-slate-100 p-1">{PORCENTAJES.map((p) => <button key={p} className={`seg ${porc === p ? 'seg-on' : 'seg-off'}`} onClick={() => setPorc(p)}>{p}%</button>)}</div>
                </div>
                <div>
                  <p className="label">Cuotas</p>
                  <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1">{PLANES.map((c) => <button key={c} className={`seg ${cuotas === c ? 'seg-on' : 'seg-off'}`} onClick={() => setCuotas(c)}>{c}</button>)}</div>
                </div>
              </>)}
            </div>

            <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-royal-600 to-royal-900 p-5 text-white shadow-lg">
              <div className="flex justify-between text-sm text-royal-100"><span>Total</span><span className="text-lg font-bold text-white">{pesos(r.total)}</span></div>
              {r.financiado ? (<>
                <div className="mt-2 flex justify-between text-sm text-royal-100"><span>Entrega {porc}%</span><span className="font-semibold text-white">{pesos(r.entrega)}</span></div>
                <div className="my-4 border-t border-white/15" />
                <p className="text-xs uppercase tracking-wide text-royal-100">{cuotas} cuotas de</p>
                <p className="text-4xl font-bold">{pesos(r.cuota)}</p>
                <p className="mt-1 text-sm text-royal-100">Importe diario: <span className="font-semibold text-white">{pesos(r.diario)}</span></p>
              </>) : <p className="mt-3 text-sm text-royal-100">Pago de contado.</p>}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button className="btn-secondary" onClick={() => setCompartirOpen(true)}><Share2 size={17} /> Compartir</button>
              <button className="btn-primary" onClick={() => setConfirmar(true)}><Check size={17} /> Confirmar</button>
            </div>
            <button className="btn-ghost w-full text-xs" onClick={() => confirm('¿Vaciar el cotizador?') && clear()}>Vaciar cotizador</button>
          </div>
        </div>
      )}

      <Modal open={picker} onClose={() => setPicker(false)} title="Agregar productos" wide>
        <div className="relative mb-3"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} /><input className="input pl-9" placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus /></div>
        <div className="-mx-1 mb-3 flex gap-1.5 overflow-x-auto pb-1">
          <button className={`chip shrink-0 px-3 py-1.5 ${cat === 'all' ? 'bg-royal-600 text-white' : 'bg-slate-100 text-slate-600'}`} onClick={() => setCat('all')}>Todos</button>
          {categorias.map((c) => <button key={c.id} className={`chip shrink-0 px-3 py-1.5 ${cat === c.id ? 'bg-royal-600 text-white' : 'bg-slate-100 text-slate-600'}`} onClick={() => setCat(c.id)}>{c.nombre}</button>)}
        </div>
        <ul className="divide-y divide-slate-100">
          {lista.map((p) => {
            const enCarrito = items.find((i) => i.id === p.id)?.cantidad;
            return (
              <li key={p.id} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1"><p className="text-sm font-medium">{p.nombre}</p><p className="text-xs text-slate-500">{p.precio > 0 ? pesos(p.precio) : 'Sin precio'}</p></div>
                {enCarrito && <span className="chip bg-royal-50 text-royal-700">x{enCarrito}</span>}
                <button className="rounded-full bg-royal-600 p-2 text-white hover:bg-royal-700" onClick={() => { add(p); toast.show('Agregado: ' + p.nombre); }} aria-label="Agregar"><Plus size={16} /></button>
              </li>
            );
          })}
        </ul>
      </Modal>

      <Modal open={confirmar} onClose={() => setConfirmar(false)} title="¿Confirmar el pedido?">
        <div className="space-y-4">
          <div><label className="label">Cliente (opcional)</label><input className="input" value={cliente} onChange={(e) => setCliente(e.target.value)} placeholder="Nombre del cliente" /></div>
          <div className="rounded-xl bg-slate-50 p-4 text-sm">
            <div className="flex justify-between"><span>{items.length} productos</span><span className="font-bold">{pesos(r.total)}</span></div>
            <div className="mt-1 flex justify-between text-slate-500"><span>{r.financiado ? `Entrega ${porc}% + ${cuotas} cuotas` : 'Contado'}</span><span>{r.financiado ? `${pesos(r.entrega)} + ${pesos(r.cuota)}` : ''}</span></div>
          </div>
          <button className="btn-primary w-full" onClick={guardar} disabled={busy}>{busy ? 'Guardando…' : 'Confirmar pedido'}</button>
        </div>
      </Modal>
      <Modal open={compartirOpen} onClose={() => setCompartirOpen(false)} title="Compartir presupuesto">
        <div className="space-y-4">
          <p className="text-sm text-slate-500">{cliente.trim() ? `Presupuesto para ${cliente.trim()}. ` : 'Sin cliente cargado: el PDF no lo incluye. '}Se genera un PDF con los productos, códigos, precios de lista, la forma de pago elegida, la tabla de todos los planes y tus datos de contacto.</p>
          <button className="btn-primary w-full" onClick={enviarLink} disabled={pdfBusy}><Link2 size={17} /> {pdfBusy ? 'Generando…' : 'Enviar link con botón "Lo quiero"'}</button>
          <p className="-mt-2 text-xs text-slate-500">Te avisamos cuando el cliente lo abre o toca &quot;Lo quiero&quot;.</p>
          <button className="btn-secondary w-full" onClick={compartirPdf} disabled={pdfBusy}><Share2 size={17} /> Compartir PDF</button>
          <div className="grid grid-cols-2 gap-2">
            <button className="btn-secondary" onClick={bajarPdf} disabled={pdfBusy}><FileDown size={17} /> Descargar</button>
            <button className="btn-secondary" onClick={compartirTexto}><MessageCircle size={17} /> Solo texto</button>
          </div>
        </div>
      </Modal>
      <Toast msg={toast.msg} kind={toast.kind} />
    </div>
  );
}
