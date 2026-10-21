import { NextResponse } from 'next/server';
import { admin, usuarioDe } from '@/lib/server';
export const dynamic = 'force-dynamic';

// Registra un ingreso con ciudad aproximada (headers geo de Vercel) y marca alertas
export async function POST(req: Request) {
  const u = await usuarioDe(req);
  if (!u) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  const { device_id, nombre } = await req.json().catch(() => ({}));
  const h = req.headers;
  const ciudad = h.get('x-vercel-ip-city') ? decodeURIComponent(h.get('x-vercel-ip-city')!) : null;
  const pais = h.get('x-vercel-ip-country');
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
  const db = admin();

  let alerta: string | null = null;
  const desde = new Date(Date.now() - 3 * 3600_000).toISOString();
  const { data: previos } = await db.from('accesos').select('ciudad,device_id,created_at').eq('usuario_id', u.id).gte('created_at', desde).order('created_at', { ascending: false }).limit(20);
  const otraCiudad = (previos ?? []).find((a) => a.ciudad && ciudad && a.ciudad !== ciudad && a.device_id !== device_id);
  if (otraCiudad) alerta = `Ingreso desde ${ciudad} y ${otraCiudad.ciudad} en menos de 3 horas`;
  const { data: rev } = await db.from('dispositivos').select('revocado,verificado_at').eq('usuario_id', u.id).eq('device_id', device_id ?? '').maybeSingle();
  if (!alerta && rev?.revocado) alerta = 'Intento de ingreso desde un dispositivo dado de baja';

  await db.from('accesos').insert({ usuario_id: u.id, device_id: device_id ?? null, dispositivo: nombre ?? null, ip, ciudad, pais, alerta });
  if (device_id) await db.from('dispositivos').update({ ultimo_acceso: new Date().toISOString() }).eq('usuario_id', u.id).eq('device_id', device_id);
  return NextResponse.json({ ok: true });
}
