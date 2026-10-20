'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import AuthCard from '@/components/AuthCard';

export default function Registro() {
  const router = useRouter();
  const [f, setF] = useState({ nombre: '', email: '', celular: '', codigo: '', password: '', password2: '', keyword: '' });
  const [msg, setMsg] = useState<{ t: string; ok?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setMsg(null);
    if (f.password !== f.password2) return setMsg({ t: 'Las contraseñas no coinciden.' });
    if (f.password.length < 8) return setMsg({ t: 'La contraseña debe tener al menos 8 caracteres.' });
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email: f.email.trim(), password: f.password,
      options: { emailRedirectTo: `${location.origin}/completar-perfil`, data: { nombre: f.nombre, celular: f.celular, codigo_vendedor: f.codigo, keyword: f.keyword } },
    });
    if (error) { setBusy(false); return setMsg({ t: error.message.includes('registered') ? 'El usuario ya se encuentra registrado.' : 'No se pudo registrar: ' + error.message }); }
    if (data.session) {
      const { error: e2 } = await supabase.rpc('registrar_perfil', { p_keyword: f.keyword, p_nombre: f.nombre, p_celular: f.celular, p_codigo: f.codigo });
      setBusy(false);
      if (e2) return setMsg({ t: 'La palabra clave es incorrecta. Comunicate con el administrador.' });
      router.replace('/');
      return;
    }
    setBusy(false);
    setMsg({ ok: true, t: `Te enviamos un correo de verificación a ${f.email}. Confirmalo y después ingresá.` });
  };

  return (
    <AuthCard title="Crear cuenta" subtitle="Registrate con la palabra clave que te dio tu líder.">
      <form onSubmit={submit} className="space-y-3.5">
        <div><label className="label">Nombre y apellido</label><input className="input" value={f.nombre} onChange={set('nombre')} required /></div>
        <div><label className="label">Email</label><input className="input" type="email" value={f.email} onChange={set('email')} required /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Celular</label><input className="input" type="tel" value={f.celular} onChange={set('celular')} required /></div>
          <div><label className="label">Cód. vendedor</label><input className="input" value={f.codigo} onChange={set('codigo')} required /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Contraseña</label><input className="input" type="password" value={f.password} onChange={set('password')} required /></div>
          <div><label className="label">Repetir</label><input className="input" type="password" value={f.password2} onChange={set('password2')} required /></div>
        </div>
        <div><label className="label">Palabra clave del equipo</label><input className="input" value={f.keyword} onChange={set('keyword')} required /></div>
        {msg && <p className={`rounded-xl px-3 py-2 text-sm ${msg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-coral-500/10 text-coral-600'}`}>{msg.t}</p>}
        <button className="btn-primary w-full" disabled={busy}>{busy ? 'Registrando…' : 'Registrarme'}</button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-500">¿Ya tenés cuenta? <Link href="/login" className="font-semibold text-royal-600 hover:underline">Ingresá</Link></p>
    </AuthCard>
  );
}
