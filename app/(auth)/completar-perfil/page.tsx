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
  const [f, setF] = useState({ celular: '', codigo: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!session) { router.replace('/login'); return; }
    if (profile) { router.replace('/'); return; }
    setF({ celular: meta.celular ?? '', codigo: meta.codigo_vendedor ?? '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, session, profile]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(''); setBusy(true);
    const { error } = await supabase.rpc('registrar_perfil', { p_codigo: f.codigo, p_celular: f.celular });
    setBusy(false);
    if (error) return setErr(error.message);
    await refresh(); router.replace('/');
  };

  if (loading || !session) return <Spinner />;
  return (
    <AuthCard title="Completá tu perfil" subtitle="Ingresá el código que te dio tu líder.">
      <form onSubmit={submit} className="space-y-3.5">
        <div><label className="label">Código de vendedor</label><input className="input uppercase" value={f.codigo} onChange={(e) => setF({ ...f, codigo: e.target.value })} required /></div>
        <div><label className="label">Celular</label><input className="input" type="tel" value={f.celular} onChange={(e) => setF({ ...f, celular: e.target.value })} required /></div>
        {err && <p className="rounded-xl bg-coral-500/10 px-3 py-2 text-sm text-coral-600">{err}</p>}
        <button className="btn-primary w-full" disabled={busy}>{busy ? 'Guardando…' : 'Continuar'}</button>
        <button type="button" className="btn-ghost w-full" onClick={async () => { await signOut(); router.replace('/login'); }}>Salir</button>
      </form>
    </AuthCard>
  );
}
