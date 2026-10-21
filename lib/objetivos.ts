import { supabase } from './supabase';
import type { Objetivo, Posicion } from './types';

export const TIPOS: { k: string; l: string; plural: string }[] = [
  { k: 'venta', l: 'Venta', plural: 'ventas' },
  { k: 'demo', l: 'Demo', plural: 'demos' },
  { k: 'entrevista', l: 'Entrevista / recluta', plural: 'entrevistas' },
  { k: 'servicio', l: 'Servicio', plural: 'servicios' },
  { k: 'capacitacion', l: 'Capacitación oficial (agenda)', plural: 'capacitaciones' },
  { k: 'video', l: 'Video de capacitación', plural: 'videos vistos' },
  { k: 'extracurricular', l: 'Extracurricular', plural: 'extracurriculares' },
];
export const PREMIOS = [1, 2, 3, 5, 10];
export const CANTIDADES = [1, 3, 5, 10, 15, 20, 30, 50];

export const PRESETS: { titulo: string; tipos: string[]; metrica: 'cantidad' | 'mayor'; emoji: string }[] = [
  { titulo: 'Mayor venta', tipos: ['venta'], metrica: 'mayor', emoji: '💰' },
  { titulo: 'Más ventas del mes', tipos: ['venta'], metrica: 'cantidad', emoji: '🏆' },
  { titulo: 'Más entrevistas / reclutas', tipos: ['entrevista'], metrica: 'cantidad', emoji: '🤝' },
  { titulo: 'Más capacitaciones', tipos: ['capacitacion', 'video'], metrica: 'cantidad', emoji: '🎓' },
  { titulo: 'Más demos', tipos: ['demo'], metrica: 'cantidad', emoji: '🍳' },
  { titulo: 'Más servicios', tipos: ['servicio'], metrica: 'cantidad', emoji: '🛠️' },
];

export const emojiDe = (o: Objetivo) => o.metrica === 'mayor' ? '💰' : o.modo === 'meta' ? '🎯' : (PRESETS.find((p) => p.titulo === o.titulo)?.emoji ?? '🏆');
export const pluralDe = (tipos: string[]) => tipos.map((t) => TIPOS.find((x) => x.k === t)?.plural ?? t).join(' + ');

export async function tabla(id: string): Promise<Posicion[]> {
  const { data } = await supabase.rpc('tabla_objetivo', { p_id: id });
  return ((data as Posicion[]) ?? []).map((r) => ({ ...r, valor: Number(r.valor) }));
}
/** Puesto (1-based) con empates compartidos; null si no participa. */
export function puesto(t: Posicion[], uid: string): number | null {
  const i = t.findIndex((r) => r.usuario_id === uid); if (i < 0) return null;
  return t.filter((r) => r.valor > t[i].valor).length + 1;
}
export const medalla = (p: number | null) => (p === 1 ? '🥇' : p === 2 ? '🥈' : p === 3 ? '🥉' : null);
