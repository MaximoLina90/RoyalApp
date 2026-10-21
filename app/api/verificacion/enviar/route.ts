import { NextResponse } from 'next/server';
import { admin, usuarioDe, e164, twilio, contarDispositivos } from '@/lib/server';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const u = await usuarioDe(req);
  if (!u) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  const { device_id, canal } = await req.json();
  if (!device_id) return NextResponse.json({ error: 'Falta dispositivo' }, { status: 400 });
  const db = admin();
  const { data: p } = await db.from('profiles').select('celular,aprobado,suspendido,max_dispositivos').eq('id', u.id).single();
  if (!p || !p.aprobado || p.suspendido) return NextResponse.json({ error: 'Cuenta no habilitada' }, { status: 403 });
  if (!p.celular) return NextResponse.json({ error: 'Tu cuenta no tiene celular. Pedile al administrador que lo cargue.' }, { status: 400 });
  const { data: d } = await db.from('dispositivos').select('verificado_at,revocado').eq('usuario_id', u.id).eq('device_id', device_id).maybeSingle();
  if (d?.revocado) return NextResponse.json({ error: 'Este dispositivo fue dado de baja por el administrador.' }, { status: 403 });
  if (!d?.verificado_at && (await contarDispositivos(u.id)) >= p.max_dispositivos)
    return NextResponse.json({ error: `Ya tenés ${p.max_dispositivos} dispositivos registrados. Pedile al administrador que libere uno.` }, { status: 409 });
  const r = await twilio('Verifications', { To: e164(p.celular), Channel: canal === 'whatsapp' ? 'whatsapp' : 'sms', Locale: 'es' });
  if (!r.ok) return NextResponse.json({ error: 'No se pudo enviar el código. ' + (r.data?.message ?? '') }, { status: 502 });
  return NextResponse.json({ ok: true });
}
