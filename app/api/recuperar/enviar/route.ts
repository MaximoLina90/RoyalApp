import { NextResponse } from 'next/server';
import { admin, e164, twilio } from '@/lib/server';
export const dynamic = 'force-dynamic';

const enmascarar = (c: string) => { const d = c.replace(/\D/g, ''); return '•••• ' + d.slice(-4); };

export async function POST(req: Request) {
  const { email } = await req.json().catch(() => ({}));
  if (!email) return NextResponse.json({ error: 'Escribí tu email.' }, { status: 400 });
  const { data } = await admin().rpc('cuenta_por_email', { p_email: String(email) });
  const c = (data as { id: string; celular: string | null; suspendido: boolean }[] | null)?.[0];
  if (!c || c.suspendido) return NextResponse.json({ error: 'No encontramos una cuenta habilitada con ese email.' }, { status: 404 });
  if (!c.celular) return NextResponse.json({ error: 'Tu cuenta no tiene celular cargado. Pedile a tu líder que te ayude.' }, { status: 400 });
  const r = await twilio('Verifications', { To: e164(c.celular), Channel: 'sms', Locale: 'es' });
  if (!r.ok) return NextResponse.json({ error: 'No se pudo enviar el código. ' + (r.data?.message ?? '') }, { status: 502 });
  return NextResponse.json({ ok: true, celular: enmascarar(c.celular) });
}
