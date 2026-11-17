import { NextResponse } from 'next/server';
import { admin, e164, twilio } from '@/lib/server';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const { email, codigo, password } = await req.json().catch(() => ({}));
  if (!email || !codigo || !password) return NextResponse.json({ error: 'Faltan datos.' }, { status: 400 });
  if (String(password).length < 8) return NextResponse.json({ error: 'La contraseña tiene que tener al menos 8 caracteres.' }, { status: 400 });
  const db = admin();
  const { data } = await db.rpc('cuenta_por_email', { p_email: String(email) });
  const c = (data as { id: string; celular: string | null; suspendido: boolean }[] | null)?.[0];
  if (!c?.celular || c.suspendido) return NextResponse.json({ error: 'Cuenta no habilitada.' }, { status: 403 });
  const r = await twilio('VerificationCheck', { To: e164(c.celular), Code: String(codigo).trim() });
  if (!r.ok || r.data?.status !== 'approved') return NextResponse.json({ error: 'Código incorrecto o vencido.' }, { status: 400 });
  const { error } = await db.auth.admin.updateUserById(c.id, { password: String(password) });
  if (error) return NextResponse.json({ error: 'No se pudo cambiar la contraseña. ' + error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
