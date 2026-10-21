import type { ItemPedido, Profile } from './types';
import { calcular, PORCENTAJES, PLANES } from './cotizador';

const $ = (n: number) => '$ ' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const AZUL: [number, number, number] = [0, 74, 144];
const OSCURO: [number, number, number] = [2, 26, 69];

async function logo(): Promise<string | null> {
  try {
    const blob = await (await fetch('/logo.png')).blob();
    return await new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(r.result as string); r.onerror = () => ok(null); r.readAsDataURL(blob); });
  } catch { return null; }
}

export interface DatosPresupuesto {
  items: ItemPedido[];
  porcentaje: number;
  cuotas: number;
  factores: Record<string, number>;
  diasMes: number;
  cliente?: string;
  vendedor: Profile | null;
}

export async function generarPresupuesto(d: DatosPresupuesto): Promise<{ blob: Blob; nombre: string }> {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 14;
  const hoy = new Date();
  const fecha = hoy.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const nro = `${hoy.getFullYear() % 100}${String(hoy.getMonth() + 1).padStart(2, '0')}${String(hoy.getDate()).padStart(2, '0')}-${String(hoy.getHours()).padStart(2, '0')}${String(hoy.getMinutes()).padStart(2, '0')}`;
  const r = calcular(d.items, d.porcentaje, d.cuotas, d.factores, d.diasMes);

  // Encabezado
  doc.setFillColor(...OSCURO); doc.rect(0, 0, W, 34, 'F');
  const img = await logo();
  if (img) doc.addImage(img, 'PNG', M, 5, 24, 24);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.text('Presupuesto', img ? M + 30 : M, 16);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.text('Royal Prestige®', img ? M + 30 : M, 23);
  doc.setFontSize(9);
  doc.text(`N° ${nro}`, W - M, 14, { align: 'right' });
  doc.text(`Fecha: ${fecha}`, W - M, 20, { align: 'right' });

  // Cliente y vendedor
  let y = 44;
  doc.setTextColor(...OSCURO); doc.setFontSize(9);
  doc.setFont('helvetica', 'bold'); doc.text('CLIENTE', M, y); doc.text('VENDEDOR', W / 2 + 4, y);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(40, 40, 40);
  doc.text(d.cliente?.trim() || '—', M, y + 6);
  const v = d.vendedor;
  const lv = [v?.nombre ?? '', v?.codigo_vendedor ? `Código ${v.codigo_vendedor}` : '', v?.celular ?? '', v?.email ?? ''].filter(Boolean);
  lv.forEach((t, i) => doc.text(t, W / 2 + 4, y + 6 + i * 5));
  y += 8 + Math.max(1, lv.length) * 5;

  // Productos
  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M },
    head: [['Código', 'Producto', 'Cant.', 'Precio de lista', 'Subtotal']],
    body: d.items.map((i) => [i.codigo ?? '', i.nombre, String(i.cantidad), $(i.precio), $(i.precio * i.cantidad)]),
    foot: [[{ content: 'Total', colSpan: 4, styles: { halign: 'right' } }, $(r.total)]],
    headStyles: { fillColor: AZUL, textColor: 255, fontStyle: 'bold' },
    footStyles: { fillColor: [238, 245, 252], textColor: OSCURO, fontStyle: 'bold', fontSize: 11 },
    styles: { fontSize: 9, cellPadding: 2.2 },
    columnStyles: { 0: { cellWidth: 22 }, 2: { halign: 'center', cellWidth: 14 }, 3: { halign: 'right', cellWidth: 32 }, 4: { halign: 'right', cellWidth: 32 } },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // Forma de pago elegida
  const caja = (alto: number) => { if (y + alto > H - 20) { doc.addPage(); y = 20; } };
  caja(34);
  doc.setFillColor(...AZUL); doc.roundedRect(M, y, W - 2 * M, 30, 3, 3, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.text('FORMA DE PAGO ELEGIDA', M + 5, y + 7);
  if (r.financiado) {
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.text(`Entrega ${d.porcentaje}%: ${$(r.entrega)}   ·   Monto a financiar: ${$(r.total - r.entrega)}`, M + 5, y + 14);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(16);
    doc.text(`${d.cuotas} cuotas de ${$(r.cuota)}`, M + 5, y + 24);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
    doc.text(`Importe diario: ${$(r.diario)}`, W - M - 5, y + 24, { align: 'right' });
  } else {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(16);
    doc.text(`Contado: ${$(r.total)}`, M + 5, y + 21);
  }
  y += 38;

  // Todos los planes
  caja(20);
  doc.setTextColor(...OSCURO); doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
  doc.text('Todos los planes de financiación', M, y);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(100, 100, 100);
  doc.text('Valor de cada cuota según la entrega y la cantidad de cuotas.', M, y + 5);
  const filas = PORCENTAJES.slice().reverse().map((p) => {
    const ent = Math.round(r.total * p / 100);
    return [`${p}%`, $(ent), $(r.total - ent), ...PLANES.map((c) => $(calcular(d.items, p, c, d.factores, d.diasMes).cuota))];
  });
  autoTable(doc, {
    startY: y + 8,
    margin: { left: M, right: M },
    head: [['Entrega', 'Depósito', 'A financiar', ...PLANES.map((c) => `${c} cuotas`)]],
    body: filas,
    headStyles: { fillColor: OSCURO, textColor: 255, fontSize: 8, halign: 'center' },
    styles: { fontSize: 8, halign: 'right', cellPadding: 1.8 },
    columnStyles: { 0: { halign: 'center', fontStyle: 'bold' } },
    didParseCell: (h) => {
      if (h.section !== 'body' || !r.financiado) return;
      const p = PORCENTAJES.slice().reverse()[h.row.index];
      const c = PLANES[h.column.index - 3];
      if (p === d.porcentaje && c === d.cuotas) { h.cell.styles.fillColor = [213, 230, 247]; h.cell.styles.fontStyle = 'bold'; }
    },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // Notas
  caja(22);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(90, 90, 90);
  const notas = [
    'Precios de lista vigentes a la fecha de emisión, sujetos a cambio sin previo aviso.',
    'Este presupuesto no constituye una factura ni un compromiso de compra.',
  ];
  notas.forEach((t, i) => doc.text('• ' + t, M, y + i * 4.5));

  // Pie
  const pags = doc.getNumberOfPages();
  for (let i = 1; i <= pags; i++) {
    doc.setPage(i);
    doc.setDrawColor(220, 220, 220); doc.line(M, H - 14, W - M, H - 14);
    doc.setFontSize(8); doc.setTextColor(130, 130, 130);
    doc.text(`${v?.nombre ?? ''}${v?.codigo_vendedor ? ' · Cód. ' + v.codigo_vendedor : ''}${v?.celular ? ' · ' + v.celular : ''}`, M, H - 9);
    doc.text(`Página ${i} de ${pags}`, W - M, H - 9, { align: 'right' });
  }

  const slug = (d.cliente?.trim() || 'cliente').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return { blob: doc.output('blob'), nombre: `presupuesto-royal-${slug}-${nro}.pdf` };
}
