import { createClient, type User } from '@supabase/supabase-js';

export const admin = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

export async function usuarioDe(req: Request): Promise<User | null> {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const { data } = await admin().auth.getUser(token);
  return data.user ?? null;
}

/** Normaliza un celular argentino a E.164 (+549…). */
export function e164(cel: string): string {
  let d = cel.replace(/\D/g, '');
  if (cel.trim().startsWith('+') && !d.startsWith('54')) return '+' + d;
  if (d.startsWith('549')) return '+' + d;
  if (d.startsWith('54')) d = d.slice(2);
  d = d.replace(/^0/, '');
  // quita el "15" después de la característica (2, 3 o 4 dígitos)
  if (d.length === 12) { for (const n of [2, 3, 4]) if (d.slice(n, n + 2) === '15') { d = d.slice(0, n) + d.slice(n + 2); break; } }
  return '+549' + d;
}

export async function twilio(path: string, body: Record<string, string>) {
  const sid = process.env.TWILIO_ACCOUNT_SID!, tok = process.env.TWILIO_AUTH_TOKEN!;
  const r = await fetch(`https://verify.twilio.com/v2/Services/${process.env.TWILIO_VERIFY_SID}/${path}`, {
    method: 'POST',
    headers: { Authorization: 'Basic ' + Buffer.from(`${sid}:${tok}`).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
  });
  return { ok: r.ok, data: await r.json().catch(() => ({})) };
}

export async function contarDispositivos(uid: string) {
  const { count } = await admin().from('dispositivos').select('id', { count: 'exact', head: true }).eq('usuario_id', uid).not('verificado_at', 'is', null).eq('revocado', false);
  return count ?? 0;
}
