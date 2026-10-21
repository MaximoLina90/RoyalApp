import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { admin, usuarioDe } from '@/lib/server';
export const dynamic = 'force-dynamic';

// Un líder borra la cuenta de alguien de su red. El código queda libre para volver a registrarse (o el líder lo deshabilita).
export async function POST(req: Request) {
  const u = await usuarioDe(req);
  if (!u) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  const { user_id } = await req.json();
  if (!user_id || user_id === u.id) return NextResponse.json({ error: 'Cuenta inválida' }, { status: 400 });
  const token = req.headers.get('authorization')!.replace(/^Bearer\s+/i, '');
  const comoActor = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
  const { data: puede } = await comoActor.rpc('usuario_debajo_mio', { p_uid: user_id });
  if (!puede) return NextResponse.json({ error: 'Esa cuenta no pertenece a tu red' }, { status: 403 });
  const { error } = await admin().auth.admin.deleteUser(user_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
