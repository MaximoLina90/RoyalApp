import { createClient } from '@supabase/supabase-js';

/** Cliente anónimo para las páginas públicas (sin sesión). */
export const anonimo = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const uuidOk = (v?: string | null) => (v && UUID.test(v) ? v : null);

/** Celular argentino → dígitos para wa.me (549…). */
export function waNumero(cel: string) {
  let d = cel.replace(/\D/g, '');
  if (d.startsWith('549')) return d;
  if (d.startsWith('54')) d = d.slice(2);
  d = d.replace(/^0/, '');
  if (d.length === 12) for (const n of [2, 3, 4]) if (d.slice(n, n + 2) === '15') { d = d.slice(0, n) + d.slice(n + 2); break; }
  return '549' + d;
}
export const waLink = (cel: string | null | undefined, texto: string) => (cel ? `https://wa.me/${waNumero(cel)}?text=${encodeURIComponent(texto)}` : null);
