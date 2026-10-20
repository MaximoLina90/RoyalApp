'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';
import AuthCard from '@/components/AuthCard';
import { Spinner } from '@/components/ui';

export default function CompletarPerfil() {
  const router = useRouter();
  const { session, profile, loading, refresh, signOut } = useAuth();
  const meta = (session?.user.user_metadata ?? {}) as Record<string, string>;
  const [f, setF] = useState({ nombre: '', celular: '', codigo: '', keyword: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [tried, setTried] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!session) { router.replace('/login'); return; }
    if (profile) { router.replace('/'); return; }
    setF({ nombre: meta.nombre ?? '', celular: meta.celular ?? '', codigo: meta.codigo_vendedor ?? '', keyword: meta.keyword ?? '' });
    // intento automático con los datos del registro
    if (!tried && meta.keyword) {
      setTried(true);
      supabase.rpc('registrar_perfil', { p_keyword: meta.keyword, p_nombre: meta.nombre, p_celular: meta.celular, p_codigo: meta.codigo_vendedor })
        .then(async ({ error }) => { if (!error) { await refresh(); router.replace('/'); } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, session, profile]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(''); setBusy(true);
    const { error } = await supabase.rpc('registrar_perfil', { p_keyword: f.keyword, p_nombre: f.nombre, p_celular: f.celular, p_codigo: f.codigo });
    setBusy(false);
    if (error) return setErr(error.message.includes('clave') ? 'La palabra clave es incorrecta. Comunicate con el administrador.' : error.message);
    await refresh(); router.replace('/');
  };

  if (loading || !session) return <Spinner />;
  return (
    <AuthCard title="Completá tu perfil" subtitle="Último paso para acceder a la app.">
      <form onSubmit={submit} className="space-y-3.5">
        <div><label className="label">Nombre y apellido</label><input className="input" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} required /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Celular</label><input className="input" value={f.celular} onChange={(e) => setF({ ...f, celular: e.target.value })} /></div>
          <div><label className="label">Cód. vendedor</label><input className="input" value={f.codigo} onChange={(e) => setF({ ...f, codigo: e.target.value })} /></div>
        </div>
        <div><label className="label">Palabra clave del equipo</label><input className="input" value={f.keyword} onChange={(e) => setF({ ...f, keyword: e.target.value })} required /></div>
        {err && <p className="rounded-xl bg-coral-500/10 px-3 py-2 text-sm text-coral-600">{err}</p>}
        <button className="btn-primary w-full" disabled={busy}>{busy ? 'Guardando…' : 'Continuar'}</button>
        <button type="button" className="btn-ghost w-full" onClick={async () => { await signOut(); router.replace('/login'); }}>Salir</button>
      </form>
    </AuthCard>
  );
}
