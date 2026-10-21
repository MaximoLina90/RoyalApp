import { NextResponse } from 'next/server';
import { admin, usuarioDe, e164, twilio, contarDispositivos } from '@/lib/server';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const u = await usuarioDe(req);
  if (!u) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  const { device_id, canal } = await req.json();
  if (!device_id) return NextResponse.json({ error: 'Falta dispositivo' }, { status: 400 });
  const db = admin();
  const { data: p } = await db.from('profiles').select('celular,aprobado,suspendido,max_dispositivos,telefono_verificado').eq('id', u.id).single();
  if (!p || p.suspendido) return NextResponse.json({ error: 'Cuenta no habilitada' }, { status: 403 });
  if (!p.celular) return NextResponse.json({ error: 'Tu cuenta no tiene celular cargado. Pedile a tu líder que lo cargue.' }, { status: 400 });
  // Verificación de teléfono en el registro: no requiere aprobación previa
  if (p.telefono_verificado) {
    if (!p.aprobado) return NextResponse.json({ error: 'Tu cuenta está pendiente de aprobación' }, { status: 403 });
    const { data: d } = await db.from('dispositivos').select('verificado_at,revocado').eq('usuario_id', u.id).eq('device_id', device_id).maybeSingle();
    if (d?.revocado) return NextResponse.json({ error: 'Este dispositivo fue dado de baja por tu líder.' }, { status: 403 });
    if (!d?.verificado_at && (await contarDispositivos(u.id)) >= p.max_dispositivos)
      return NextResponse.json({ error: `Ya tenés ${p.max_dispositivos} dispositivos registrados. Pedile a tu líder que libere uno.` }, { status: 409 });
  }
  const r = await twilio('Verifications', { To: e164(p.celular), Channel: canal === 'whatsapp' ? 'whatsapp' : 'sms', Locale: 'es' });
  if (!r.ok) return NextResponse.json({ error: 'No se pudo enviar el código. ' + (r.data?.message ?? '') }, { status: 502 });
  return NextResponse.json({ ok: true });
}
