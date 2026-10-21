import { NextResponse } from 'next/server';
import { admin, usuarioDe, e164, twilio, contarDispositivos } from '@/lib/server';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const u = await usuarioDe(req);
  if (!u) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  const { device_id, nombre, codigo } = await req.json();
  if (!device_id || !codigo) return NextResponse.json({ error: 'Faltan datos' }, { status: 400 });
  const db = admin();
  const { data: p } = await db.from('profiles').select('celular,aprobado,suspendido,max_dispositivos').eq('id', u.id).single();
  if (!p?.celular || !p.aprobado || p.suspendido) return NextResponse.json({ error: 'Cuenta no habilitada' }, { status: 403 });
  const r = await twilio('VerificationCheck', { To: e164(p.celular), Code: String(codigo).trim() });
  if (!r.ok || r.data?.status !== 'approved') return NextResponse.json({ error: 'Código incorrecto o vencido' }, { status: 400 });
  const { data: d } = await db.from('dispositivos').select('verificado_at,revocado').eq('usuario_id', u.id).eq('device_id', device_id).maybeSingle();
  if (d?.revocado) return NextResponse.json({ error: 'Dispositivo dado de baja' }, { status: 403 });
  if (!d?.verificado_at && (await contarDispositivos(u.id)) >= p.max_dispositivos) return NextResponse.json({ error: 'Límite de dispositivos alcanzado' }, { status: 409 });
  const { error } = await db.from('dispositivos').upsert({ usuario_id: u.id, device_id, nombre: nombre ?? null, verificado_at: new Date().toISOString(), ultimo_acceso: new Date().toISOString(), revocado: false }, { onConflict: 'usuario_id,device_id' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
