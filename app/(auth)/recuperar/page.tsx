'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import AuthCard from '@/components/AuthCard';

export default function Recuperar() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  useEffect(() => { const e = new URLSearchParams(window.location.search).get('email'); if (e) setEmail(e); }, []);
  const [cel, setCel] = useState<string | null>(null);
  const [codigo, setCodigo] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const post = async (url: string, body: object) => {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return { ok: r.ok, data: await r.json().catch(() => ({})) };
  };

  const enviar = async (e?: React.FormEvent) => {
    e?.preventDefault(); setError(''); setBusy(true);
    const r = await post('/api/recuperar/enviar', { email: email.trim() });
    setBusy(false);
    if (!r.ok) { setError(r.data.error ?? 'No se pudo enviar el código.'); return; }
    setCel(r.data.celular);
  };

  const confirmar = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    if (password.length < 8) { setError('La contraseña tiene que tener al menos 8 caracteres.'); return; }
    if (password !== password2) { setError('Las contraseñas no coinciden.'); return; }
    setBusy(true);
    const r = await post('/api/recuperar/confirmar', { email: email.trim(), codigo, password });
    if (!r.ok) { setBusy(false); setError(r.data.error ?? 'No se pudo cambiar la contraseña.'); return; }
    await supabase.auth.signInWithPassword({ email: email.trim(), password });
    router.replace('/');
  };

  return (
    <AuthCard title="Recuperar contraseña" subtitle={cel ? `Te mandamos un código por SMS al ${cel}.` : 'Te mandamos un código por SMS al celular de tu cuenta.'}>
      {!cel ? (
        <form onSubmit={enviar} className="space-y-4">
          <div><label className="label">Email de tu cuenta</label><input className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
          {error && <p className="rounded-xl bg-coral-500/10 px-3 py-2 text-sm text-coral-600">{error}</p>}
          <button className="btn-primary w-full" disabled={busy}>{busy ? 'Enviando…' : 'Enviar código'}</button>
        </form>
      ) : (
        <form onSubmit={confirmar} className="space-y-4">
          <div><label className="label">Código</label><input className="input tracking-widest" inputMode="numeric" autoComplete="one-time-code" value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 8))} required /></div>
          <div><label className="label">Nueva contraseña</label><input className="input" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
          <div><label className="label">Repetila</label><input className="input" type="password" autoComplete="new-password" value={password2} onChange={(e) => setPassword2(e.target.value)} required /></div>
          {error && <p className="rounded-xl bg-coral-500/10 px-3 py-2 text-sm text-coral-600">{error}</p>}
          <button className="btn-primary w-full" disabled={busy}>{busy ? 'Guardando…' : 'Cambiar contraseña'}</button>
          <button type="button" onClick={() => enviar()} disabled={busy} className="w-full text-center text-sm text-royal-600 hover:underline">Reenviar código</button>
        </form>
      )}
      <p className="mt-8 text-center text-sm text-slate-500"><Link href="/login" className="font-semibold text-royal-600 hover:underline">Volver a ingresar</Link></p>
    </AuthCard>
  );
}
