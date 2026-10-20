'use client';
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { ItemPedido, Producto } from '@/lib/types';

interface Cart { items: ItemPedido[]; add: (p: Producto) => void; setQty: (id: number, q: number) => void; remove: (id: number) => void; clear: () => void; count: number }
const Ctx = createContext<Cart | null>(null);
const KEY = 'royal-cotizador';

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ItemPedido[]>([]);
  useEffect(() => { try { const s = localStorage.getItem(KEY); if (s) setItems(JSON.parse(s)); } catch {} }, []);
  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(items)); }, [items]);
  const add = (p: Producto) => setItems((prev) => {
    const ex = prev.find((i) => i.id === p.id);
    if (ex) return prev.map((i) => (i.id === p.id ? { ...i, cantidad: i.cantidad + 1 } : i));
    return [...prev, { id: p.id, nombre: p.nombre, codigo: p.codigo, precio: Number(p.precio), cantidad: 1 }];
  });
  const setQty = (id: number, q: number) => setItems((prev) => (q <= 0 ? prev.filter((i) => i.id !== id) : prev.map((i) => (i.id === id ? { ...i, cantidad: q } : i))));
  const remove = (id: number) => setItems((prev) => prev.filter((i) => i.id !== id));
  const clear = () => setItems([]);
  return <Ctx.Provider value={{ items, add, setQty, remove, clear, count: items.reduce((s, i) => s + i.cantidad, 0) }}>{children}</Ctx.Provider>;
}
export const useCart = () => { const c = useContext(Ctx); if (!c) throw new Error('CartProvider'); return c; };
