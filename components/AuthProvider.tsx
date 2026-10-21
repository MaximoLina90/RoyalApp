'use client';
import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/types';

interface Auth { session: Session | null; profile: Profile | null; loading: boolean; refresh: () => Promise<void>; signOut: () => Promise<void> }
const Ctx = createContext<Auth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (s: Session | null) => {
    if (!s) { setProfile(null); return; }
    const { data } = await supabase.from('profiles').select('*').eq('id', s.user.id).maybeSingle();
    setProfile((data as Profile) ?? null);
  }, []);

  useEffect(() => {
    let listo = false;
    const fin = () => { if (!listo) { listo = true; setLoading(false); } };
    // Red de seguridad: nunca quedar cargando para siempre
    const t = setTimeout(fin, 8000);
    supabase.auth.getSession().then(async ({ data }) => { setSession(data.session); await loadProfile(data.session); }).catch(() => {}).finally(fin);
    // Importante: no llamar a Supabase dentro del callback (bloquea el lock de auth y la app queda colgada)
    const { data: sub } = supabase.auth.onAuthStateChange((e, s) => {
      setSession(s);
      if (e === 'TOKEN_REFRESHED') return;
      setTimeout(() => { loadProfile(s).catch(() => {}); }, 0);
    });
    return () => { clearTimeout(t); sub.subscription.unsubscribe(); };
  }, [loadProfile]);

  const refresh = async () => { const { data } = await supabase.auth.getSession(); setSession(data.session); await loadProfile(data.session); };
  const signOut = async () => { await supabase.auth.signOut(); setSession(null); setProfile(null); };
  return <Ctx.Provider value={{ session, profile, loading, refresh, signOut }}>{children}</Ctx.Provider>;
}
export const useAuth = () => { const c = useContext(Ctx); if (!c) throw new Error('AuthProvider'); return c; };
