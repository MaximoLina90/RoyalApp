import type { Profile } from './types';
import { esTitulo } from './recetas';

export interface RecetaPdf { slug: string; titulo: string; descripcion: string | null; ingredientes: string[]; pasos: string[]; tips: string | null; fotos: string[]; video_url: string | null; tiempo_min: number | null; porciones: string | null }

const AZUL: [number, number, number] = [0, 74, 144];
const OSCURO: [number, number, number] = [2, 26, 69];
const GRIS: [number, number, number] = [70, 70, 70];

// jsPDF con Helvetica solo dibuja Latin-1/WinAnsi: normalizamos fracciones y sacamos emojis.
const FR: Record<string, string> = { '⅓': '1/3', '⅔': '2/3', '⅛': '1/8', '⅜': '3/8', '⅝': '5/8', '⅞': '7/8', '⅕': '1/5', '⅙': '1/6', '–': '-', '—': '-', '…': '...', '″': '"', '′': "'" };
const limpio = (t: string) => t.replace(/[⅓⅔⅛⅜⅝⅞⅕⅙–—…″′]/g, (c) => FR[c] ?? c).replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF“”‘’•€™]/g, '').trim();

async function imagen(url: string, ancho = 1000): Promise<{ data: string; w: number; h: number } | null> {
  try {
    const blob = await (await fetch(url)).blob();
    const bmp = await createImageBitmap(blob);
    const k = Math.min(1, ancho / bmp.width);
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
    return { data: c.toDataURL('image/jpeg', 0.8), w: c.width, h: c.height };
  } catch { return null; }
}

export async function generarRecetario(recetas: RecetaPdf[], opts: { cliente?: string; vendedor: Profile | null; origen: string }): Promise<{ blob: Blob; nombre: string }> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 16, ANCHO = W - 2 * M;
  const v = opts.vendedor;
  const link = (slug: string) => `${opts.origen}/r/${slug}${v?.id ? `?v=${v.id}` : ''}`;
  let y = 0;

  const pie = () => {
    doc.setFontSize(8); doc.setTextColor(140, 140, 140); doc.setFont('helvetica', 'normal');
    doc.text(limpio(`Recetario Royal Prestige® · ${[v?.nombre, v?.celular].filter(Boolean).join(' · ')}`), M, H - 8);
    doc.text(String(doc.getNumberOfPages()), W - M, H - 8, { align: 'right' });
  };
  const nuevaPagina = () => { pie(); doc.addPage(); y = M; };
  const espacio = (h: number) => { if (y + h > H - 16) nuevaPagina(); };
  const parrafo = (t: string, size = 10, color = GRIS, sangria = 0, estilo: 'normal' | 'bold' = 'normal', inter = 4.6) => {
    doc.setFont('helvetica', estilo); doc.setFontSize(size); doc.setTextColor(...color);
    for (const l of doc.splitTextToSize(limpio(t), ANCHO - sangria) as string[]) { espacio(inter); doc.text(l, M + sangria, y); y += inter; }
  };

  // ---------- Tapa ----------
  doc.setFillColor(...OSCURO); doc.rect(0, 0, W, H, 'F');
  try {
    const lb = await (await fetch('/logo.png')).blob();
    const lg = await new Promise<string>((ok, ko) => { const r = new FileReader(); r.onload = () => ok(r.result as string); r.onerror = ko; r.readAsDataURL(lb); });
    doc.setFillColor(255, 255, 255); doc.roundedRect(W / 2 - 22, 50, 44, 44, 6, 6, 'F'); doc.addImage(lg, 'PNG', W / 2 - 19, 53, 38, 38);
  } catch { /* sin logo */ }
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(30); doc.text('Recetario', W / 2, 120, { align: 'center' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(14); doc.text('Royal Prestige®', W / 2, 130, { align: 'center' });
  if (opts.cliente?.trim()) { doc.setFontSize(12); doc.text(limpio(`Preparado para ${opts.cliente.trim()}`), W / 2, 146, { align: 'center' }); }
  doc.setFontSize(10); doc.setTextColor(200, 215, 235);
  recetas.forEach((r, i) => doc.text(limpio(`${i + 1}. ${r.titulo}`), W / 2, 166 + i * 7, { align: 'center' }));
  if (v) {
    doc.setFillColor(255, 255, 255); doc.roundedRect(M + 20, H - 62, ANCHO - 40, 34, 4, 4, 'F');
    doc.setTextColor(...OSCURO); doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.text('TU ASESOR ROYAL PRESTIGE®', W / 2, H - 52, { align: 'center' });
    doc.setFontSize(14); doc.text(limpio(v.nombre ?? ''), W / 2, H - 44, { align: 'center' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.text(limpio([v.celular, v.email].filter(Boolean).join('  ·  ')), W / 2, H - 37, { align: 'center' });
  }
  doc.addPage(); y = M;

  // ---------- Lista de compras ----------
  doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(...OSCURO); doc.text('Lista de compras', M, y + 4); y += 12;
  for (const r of recetas) {
    espacio(14);
    doc.setFillColor(238, 245, 252); doc.rect(M, y - 4, ANCHO, 7, 'F');
    parrafo(r.titulo, 11, AZUL, 2, 'bold', 5); y += 1.5;
    for (const i of r.ingredientes) {
      if (esTitulo(i)) { parrafo(i.replace(/:\s*$/, ''), 8.5, OSCURO, 2, 'bold', 4.4); continue; }
      espacio(5); doc.setDrawColor(150, 150, 150); doc.rect(M + 2, y - 3, 3, 3);
      parrafo(i, 9.5, GRIS, 8, 'normal', 4.6);
    }
    y += 4;
  }

  // ---------- Recetas ----------
  for (const r of recetas) {
    nuevaPagina();
    doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(...OSCURO);
    for (const l of doc.splitTextToSize(limpio(r.titulo), ANCHO) as string[]) { doc.text(l, M, y + 4); y += 8; }
    const meta = [r.tiempo_min ? `${r.tiempo_min} min` : '', r.porciones ? `${r.porciones} porciones` : ''].filter(Boolean).join('  ·  ');
    if (meta) parrafo(meta, 9, [120, 120, 120]);
    y += 2;
    if (r.fotos[0]) {
      const img = await imagen(r.fotos[0]);
      if (img) { const h = Math.min(80, (ANCHO * img.h) / img.w); const w = (h * img.w) / img.h; espacio(h + 4); doc.addImage(img.data, 'JPEG', M + (ANCHO - w) / 2, y, w, h); y += h + 6; }
    }
    if (r.descripcion) { parrafo(r.descripcion, 10, GRIS); y += 3; }
    if (r.ingredientes.length) {
      espacio(10); parrafo('Ingredientes', 13, AZUL, 0, 'bold', 6);
      for (const i of r.ingredientes) {
        if (esTitulo(i)) { y += 1; parrafo(i.replace(/:\s*$/, ''), 9, OSCURO, 0, 'bold'); continue; }
        espacio(5); doc.setFillColor(...AZUL); doc.circle(M + 1.5, y - 1.3, 0.8, 'F'); parrafo(i, 10, GRIS, 5);
      }
      y += 3;
    }
    if (r.pasos.length) {
      espacio(10); parrafo('Preparación', 13, AZUL, 0, 'bold', 6);
      let n = 0;
      for (const p of r.pasos) {
        if (esTitulo(p)) { y += 1; parrafo(p.replace(/:\s*$/, ''), 9, OSCURO, 0, 'bold'); continue; }
        espacio(6); n++;
        doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...AZUL); doc.text(`${n}.`, M, y);
        parrafo(p, 10, GRIS, 7); y += 1.2;
      }
    }
    if (r.tips) { y += 2; parrafo(`Tip: ${r.tips}`, 9.5, [150, 100, 0]); }
    y += 3; espacio(8);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...AZUL);
    doc.textWithLink(r.video_url ? 'Ver la receta con video >' : 'Ver la receta online >', M, y, { url: link(r.slug) });
    y += 6;
  }
  pie();
  const nombre = `Recetario Royal${opts.cliente?.trim() ? ' - ' + opts.cliente.trim() : ''}.pdf`.replace(/[^\wáéíóúñÁÉÍÓÚÑ .-]/g, '');
  return { blob: doc.output('blob'), nombre };
}
