import type { ItemPedido } from './types';
export const PORCENTAJES = [10, 20, 30];
export const PLANES = [3, 6, 9, 12, 14, 18];
export const DEFAULT_FACTORES: Record<string, number> = { '3': 0.36, '6': 0.19, '9': 0.135, '12': 0.105, '14': 0.093, '18': 0.075 };

export function calcular(items: ItemPedido[], porcentaje: number, cuotas: number, factores: Record<string, number>, diasMes = 31) {
  const total = items.reduce((s, i) => s + i.precio * i.cantidad, 0);
  if (cuotas <= 1) return { total, entrega: total, cuota: total, diario: 0, financiado: false };
  const entrega = Math.round(total * (porcentaje / 100));
  const factor = factores[String(cuotas)] ?? 0;
  const cuota = Math.round((total - entrega) * factor);
  return { total, entrega, cuota, diario: Math.round(cuota / diasMes), financiado: true, totalFinanciado: entrega + cuota * cuotas };
}
