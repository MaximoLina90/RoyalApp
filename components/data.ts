'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Categoria, Producto, ConfigPublica } from '@/lib/types';
import { DEFAULT_FACTORES } from '@/lib/cotizador';

let cacheCat: Categoria[] | null = null;
let cacheProd: Producto[] | null = null;

export function useCatalogo() {
  const [categorias, setC] = useState<Categoria[]>(cacheCat ?? []);
  const [productos, setP] = useState<Producto[]>(cacheProd ?? []);
  const [loading, setL] = useState(!cacheProd);
  const reload = async () => {
    const [c, p] = await Promise.all([
      supabase.from('categorias').select('*').order('orden'),
      supabase.from('productos').select('*').order('orden'),
    ]);
    cacheCat = (c.data as Categoria[]) ?? []; cacheProd = (p.data as Producto[]) ?? [];
    setC(cacheCat); setP(cacheProd); setL(false);
  };
  useEffect(() => { reload(); }, []);
  return { categorias, productos, loading, reload };
}

export function useConfig() {
  const [cfg, setCfg] = useState<ConfigPublica>({ factores: DEFAULT_FACTORES, dias_mes: 31 });
  useEffect(() => { supabase.from('config_publica').select('*').maybeSingle().then(({ data }) => { if (data) setCfg(data as ConfigPublica); }); }, []);
  return cfg;
}
