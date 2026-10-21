'use client';
import { useCallback, useEffect, useState, ReactNode } from 'react';
import Image from 'next/image';
import { ShieldCheck, Clock, Ban, Smartphone, Loader2, LogOut, MessageCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { getDeviceId, getDeviceName } from '@/lib/device';
import { useAuth } from './AuthProvider';
import { Spinner } from './ui';

type Estado = { estado: 'ok' | 'pendiente' | 'suspendido' | 'revocado' | 'limite' | 'verificar' | 'verificar_telefono' | 'sin_perfil'; celular?: string; max?: number };
const CANALES = (process.env.NEXT_PUBLIC_VERIFY_CHANNELS || 'sms').split(',');

async function api(path: string, body: object) {
  const { data } = await supabase.auth.getSession();
  const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token}` }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'Error inesperado');
  return j;
}

export default function DeviceGate({ children }: { children: ReactNode }) {
  const { signOut } = useAuth();
  const [st, setSt] = useState<Estado | null>(null);
  const [enviado, setEnviado] = useState(false);
  const [codigo, setCodigo] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    for (let i = 0; i < 3; i++) {
      const r = await Promise.race([
        supabase.rpc('estado_dispositivo'),
        new Promise<null>((ok) => setTimeout(() => ok(null), 8000)),
      ]);
      if (r && !r.error) { setSt(r.data as Estado); return; }
    }
    setSt({ estado: 'pendiente' });
  }, []);

  useEffect(() => {
    cargar();
    if (!sessionStorage.getItem('royal_acceso')) {
      sessionStorage.setItem('royal_acceso', '1');
      api('/api/acceso', { device_id: getDeviceId(), nombre: getDeviceName() }).catch(() => {});
    }
  }, [cargar]);

  if (!st) return <div className="min-h-screen"><Spinner /></div>;
  if (st.estado === 'ok') return <>{children}</>;

  const enviar = async (canal: string) => {
    setBusy(true); setErr(null);
    try { await api('/api/verificacion/enviar', { device_id: getDeviceId(), canal }); setEnviado(true); } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  };
  const confirmar = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(null);
    try { await api('/api/verificacion/confirmar', { device_id: getDeviceId(), nombre: getDeviceName(), codigo }); await cargar(); } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  };

  const info: Record<string, { icon: ReactNode; title: string; text: string }> = {
    pendiente: { icon: <Clock size={30} />, title: 'Cuenta pendiente de aprobación', text: 'Tu celular ya está verificado. Tu líder tiene que aprobar la cuenta para que puedas entrar.' },
    suspendido: { icon: <Ban size={30} />, title: 'Cuenta suspendida', text: 'Tu cuenta fue suspendida. Comunicate con el administrador del equipo.' },
    revocado: { icon: <Ban size={30} />, title: 'Dispositivo dado de baja', text: 'Este dispositivo ya no está autorizado para tu cuenta.' },
    limite: { icon: <Smartphone size={30} />, title: 'Límite de dispositivos', text: `Tu cuenta ya está activa en ${st.max ?? 2} dispositivos. Pedile a tu líder que libere uno para usar este.` },
    sin_perfil: { icon: <Clock size={30} />, title: 'Perfil incompleto', text: 'Completá tu perfil para continuar.' },
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-royal-600 to-royal-900 p-4">
      <div className="card w-full max-w-md p-6 text-center md:p-8">
        <div className="mx-auto mb-4 w-fit rounded-full bg-white p-1 shadow"><Image src="/icon.png" alt="" width={48} height={48} /></div>
        {st.estado === 'verificar' || st.estado === 'verificar_telefono' ? (<>
          <div className="mx-auto mb-3 w-fit rounded-2xl bg-royal-50 p-4 text-royal-600"><ShieldCheck size={30} /></div>
          <h1 className="text-xl font-bold text-royal-900">{st.estado === 'verificar_telefono' ? 'Verificá tu celular' : 'Verificá este dispositivo'}</h1>
          <p className="mt-2 text-sm text-slate-500">{st.estado === 'verificar_telefono' ? `Último paso del registro: te enviamos un código al ${st.celular ?? 'celular'} que cargaste. Después tu líder aprueba la cuenta.` : `Por seguridad, cada cuenta puede usarse en hasta 2 dispositivos. Te enviamos un código a tu celular ${st.celular ?? ''}.`}</p>
          {!enviado ? (
            <div className="mt-5 space-y-2">
              {CANALES.map((c) => (
                <button key={c} className={c === 'whatsapp' ? 'btn-secondary w-full' : 'btn-primary w-full'} disabled={busy} onClick={() => enviar(c)}>
                  {busy ? <Loader2 className="animate-spin" size={18} /> : c === 'whatsapp' ? <MessageCircle size={18} /> : <Smartphone size={18} />}
                  Enviar código por {c === 'whatsapp' ? 'WhatsApp' : 'SMS'}
                </button>
              ))}
            </div>
          ) : (
            <form onSubmit={confirmar} className="mt-5 space-y-3">
              <input className="input text-center text-2xl tracking-[0.5em]" inputMode="numeric" autoComplete="one-time-code" maxLength={8} placeholder="••••••" value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))} autoFocus />
              <button className="btn-primary w-full" disabled={busy || codigo.length < 4}>{busy && <Loader2 className="animate-spin" size={18} />}Verificar</button>
              <button type="button" className="text-sm font-semibold text-royal-600" onClick={() => { setEnviado(false); setCodigo(''); }}>Reenviar código</button>
            </form>
          )}
        </>) : (<>
          <div className="mx-auto mb-3 w-fit rounded-2xl bg-royal-50 p-4 text-royal-600">{info[st.estado].icon}</div>
          <h1 className="text-xl font-bold text-royal-900">{info[st.estado].title}</h1>
          <p className="mt-2 text-sm text-slate-500">{info[st.estado].text}</p>
          {st.estado === 'pendiente' && <button className="btn-secondary mt-5 w-full" onClick={cargar}>Volver a comprobar</button>}
        </>)}
        {err && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{err}</p>}
        <button className="mt-6 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700" onClick={async () => { await signOut(); location.href = '/login'; }}><LogOut size={14} /> Cerrar sesión</button>
      </div>
    </div>
  );
}
