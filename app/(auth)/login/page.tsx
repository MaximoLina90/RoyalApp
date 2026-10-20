'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';
import AuthCard from '@/components/AuthCard';

export default function Login() {
  const router = useRouter();
  const { session, profile, loading, refresh } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!loading && session) router.replace(profile ? '/' : '/completar-perfil'); }, [loading, session, profile, router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) { setError(error.message.includes('confirm') ? 'Verificá tu correo electrónico antes de ingresar.' : 'Usuario o contraseña incorrectos.'); return; }
    await refresh();
  };

  const recuperar = async () => {
    if (!email) { setError('Escribí tu email para recuperar la contraseña.'); return; }
    await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${location.origin}/login` });
    setError('Te enviamos un correo para restablecer la contraseña.');
  };

  return (
    <AuthCard title="Bienvenido/a" subtitle="Ingresá con tu cuenta de vendedor.">
      <form onSubmit={submit} className="space-y-4">
        <div><label className="label">Email</label><input className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
        <div><label className="label">Contraseña</label><input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
        {error && <p className="rounded-xl bg-coral-500/10 px-3 py-2 text-sm text-coral-600">{error}</p>}
        <button className="btn-primary w-full" disabled={busy}>{busy ? 'Ingresando…' : 'Ingresar'}</button>
        <button type="button" onClick={recuperar} className="w-full text-center text-sm text-royal-600 hover:underline">Olvidé mi contraseña</button>
      </form>
      <p className="mt-8 text-center text-sm text-slate-500">¿No tenés cuenta? <Link href="/registro" className="font-semibold text-royal-600 hover:underline">Registrate</Link></p>
    </AuthCard>
  );
}
