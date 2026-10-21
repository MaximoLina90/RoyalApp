'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import AuthCard from '@/components/AuthCard';

export default function Registro() {
  const router = useRouter();
  const [codigo, setCodigo] = useState('');
  const [nombre, setNombre] = useState<string | null>(null);
  const [f, setF] = useState({ email: '', celular: '', password: '', password2: '' });
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  const validar = async (e: React.FormEvent) => {
    e.preventDefault(); setMsg(null); setBusy(true);
    const { data, error } = await supabase.rpc('validar_codigo', { p_codigo: codigo });
    setBusy(false);
    if (error) return setMsg('No se pudo validar el código. Probá de nuevo.');
    if (!data.ok) return setMsg(data.error);
    setNombre(data.nombre);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setMsg(null);
    if (f.password !== f.password2) return setMsg('Las contraseñas no coinciden.');
    if (f.password.length < 8) return setMsg('La contraseña debe tener al menos 8 caracteres.');
    if (f.celular.replace(/\D/g, '').length < 10) return setMsg('Ingresá el celular con característica, sin 0 ni 15 (ej. 351 2345678).');
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({ email: f.email.trim(), password: f.password, options: { data: { codigo_vendedor: codigo, celular: f.celular } } });
    if (error) { setBusy(false); return setMsg(error.message.includes('registered') ? 'Ese email ya tiene una cuenta.' : 'No se pudo registrar: ' + error.message); }
    if (!data.session) { setBusy(false); return router.replace('/login'); }
    const { error: e2 } = await supabase.rpc('registrar_perfil', { p_codigo: codigo, p_celular: f.celular });
    setBusy(false);
    if (e2) return setMsg(e2.message);
    location.href = '/';
  };

  return (
    <AuthCard title="Crear cuenta" subtitle={nombre ? 'Completá tus datos de acceso.' : 'Ingresá el código de vendedor que te dio tu líder.'}>
      {!nombre ? (
        <form onSubmit={validar} className="space-y-3.5">
          <div><label className="label">Código de vendedor</label><input className="input uppercase" value={codigo} onChange={(e) => setCodigo(e.target.value)} required autoFocus /></div>
          {msg && <p className="rounded-xl bg-coral-500/10 px-3 py-2 text-sm text-coral-600">{msg}</p>}
          <button className="btn-primary w-full" disabled={busy || !codigo.trim()}>{busy && <Loader2 className="animate-spin" size={18} />}Continuar</button>
        </form>
      ) : (
        <form onSubmit={submit} className="space-y-3.5">
          <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800"><CheckCircle2 size={18} /><span>Hola <b>{nombre}</b> · código {codigo.toUpperCase()}</span>
            <button type="button" className="ml-auto text-xs font-semibold underline" onClick={() => { setNombre(null); setMsg(null); }}>Cambiar</button></div>
          <div><label className="label">Email</label><input className="input" type="email" value={f.email} onChange={set('email')} required /></div>
          <div><label className="label">Celular (te enviaremos un código por SMS)</label><input className="input" type="tel" placeholder="351 2345678" value={f.celular} onChange={set('celular')} required /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Contraseña</label><input className="input" type="password" value={f.password} onChange={set('password')} required /></div>
            <div><label className="label">Repetir</label><input className="input" type="password" value={f.password2} onChange={set('password2')} required /></div>
          </div>
          {msg && <p className="rounded-xl bg-coral-500/10 px-3 py-2 text-sm text-coral-600">{msg}</p>}
          <button className="btn-primary w-full" disabled={busy}>{busy && <Loader2 className="animate-spin" size={18} />}Registrarme</button>
        </form>
      )}
      <p className="mt-6 text-center text-sm text-slate-500">¿Ya tenés cuenta? <Link href="/login" className="font-semibold text-royal-600 hover:underline">Ingresá</Link></p>
    </AuthCard>
  );
}
