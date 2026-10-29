'use client';
import { useEffect, type ReactNode } from 'react';
import { createClient } from '@supabase/supabase-js';

type Tipo = 'receta' | 'producto' | 'presupuesto';
type Evento = 'vista' | 'whatsapp' | 'lo_quiero';
const sb = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });

export function registrar(v: string | null | undefined, tipo: Tipo, ref: string, evento: Evento, titulo?: string) {
  if (!v) return Promise.resolve();
  return Promise.resolve(sb().rpc('registrar_apertura', { p_vendedor: v, p_tipo: tipo, p_ref: ref, p_evento: evento, p_titulo: titulo ?? null })).catch(() => {});
}

/** Avisa al vendedor que el cliente abrió el link (solo navegadores reales; las previews de WhatsApp no ejecutan JS). */
export function Rastreo({ v, tipo, refId, titulo }: { v: string | null; tipo: Tipo; refId: string; titulo?: string }) {
  useEffect(() => {
    if (!v) return;
    const k = `visto:${tipo}:${refId}:${v}`;
    try { if (sessionStorage.getItem(k)) return; sessionStorage.setItem(k, '1'); } catch { /* sin storage */ }
    registrar(v, tipo, refId, 'vista', titulo);
  }, [v, tipo, refId, titulo]);
  return null;
}

/** Link de WhatsApp que además avisa al vendedor. */
export function BotonWa({ href, v, tipo, refId, titulo, evento = 'whatsapp', className, children }: {
  href: string; v: string | null; tipo: Tipo; refId: string; titulo?: string; evento?: Evento; className?: string; children: ReactNode;
}) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className={className} onClick={() => { registrar(v, tipo, refId, evento, titulo); }}>
      {children}
    </a>
  );
}
