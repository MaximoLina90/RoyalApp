import type { Nodo } from './types';

/** Códigos de la rama de `codigo` (incluido). */
export function rama(nodos: Nodo[], codigo: string): Set<string> {
  const hijos = new Map<string, string[]>();
  nodos.forEach((n) => { if (n.superior) hijos.set(n.superior, [...(hijos.get(n.superior) ?? []), n.codigo]); });
  const out = new Set<string>(); const pila = [codigo];
  while (pila.length) { const c = pila.pop()!; if (out.has(c)) continue; out.add(c); pila.push(...(hijos.get(c) ?? [])); }
  return out;
}

/** Nodos ordenados en árbol (preorden) con su profundidad, desde las raíces visibles. */
export function arbol(nodos: Nodo[], raiz?: string | null): { n: Nodo; nivel: number }[] {
  const por = new Map(nodos.map((n) => [n.codigo, n]));
  const hijos = new Map<string, Nodo[]>();
  nodos.forEach((n) => { const k = n.superior ?? ''; hijos.set(k, [...(hijos.get(k) ?? []), n]); });
  hijos.forEach((l) => l.sort((a, b) => a.nombre.localeCompare(b.nombre)));
  const raices = raiz && por.has(raiz) ? [por.get(raiz)!] : nodos.filter((n) => !n.superior || !por.has(n.superior));
  const out: { n: Nodo; nivel: number }[] = [];
  const visit = (n: Nodo, nivel: number) => { out.push({ n, nivel }); (hijos.get(n.codigo) ?? []).forEach((h) => visit(h, nivel + 1)); };
  raices.forEach((r) => visit(r, 0));
  return out;
}

export const esLider = (nodos: Nodo[], codigo: string) => nodos.some((n) => n.superior === codigo);
export const etiquetaEquipo = (n: Nodo) => [n.equipo_numero ? `#${n.equipo_numero}` : null, n.equipo_nombre].filter(Boolean).join(' ') || null;
