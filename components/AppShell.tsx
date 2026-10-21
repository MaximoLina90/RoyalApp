'use client';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, ReactNode } from 'react';
import { Home, BookOpen, Calculator, CalendarDays, BarChart3, Settings, LogOut, Receipt, ChefHat, GraduationCap, Store, Menu, X, Network, Target } from 'lucide-react';
import { useAuth } from './AuthProvider';
import { useCart } from './CartProvider';
import { Spinner } from './ui';
import DeviceGate from './DeviceGate';
import { supabase } from '@/lib/supabase';

const NAV = [
  { href: '/', label: 'Inicio', icon: Home },
  { href: '/catalogo', label: 'Catálogo', icon: BookOpen },
  { href: '/cotizador', label: 'Cotizador', icon: Calculator },
  { href: '/recetas', label: 'Recetas Royal', icon: ChefHat, soloMenu: true },
  { href: '/cronograma', label: 'Agenda', icon: CalendarDays },
  { href: '/estadisticas', label: 'Ventas', icon: BarChart3 },
];

const EXTRA = [
  { href: '/objetivos', label: 'Objetivos', icon: Target },
  { href: '/ventas', label: 'Mis pedidos', icon: Receipt },
  { href: '/marketplace', label: 'Marketplace', icon: Store },
  { href: '/capacitacion', label: 'Capacitación', icon: GraduationCap },
];

export default function AppShell({ children }: { children: ReactNode }) {
  const { session, profile, loading, signOut } = useAuth();
  const { count } = useCart();
  const path = usePathname();
  const router = useRouter();
  const [menu, setMenu] = useState(false);
  const [lider, setLider] = useState(false);
  useEffect(() => {
    if (!profile?.codigo_vendedor) return;
    supabase.from('nodos').select('codigo', { count: 'exact', head: true }).eq('superior', profile.codigo_vendedor).then(({ count }) => setLider((count ?? 0) > 0));
  }, [profile]);
  useEffect(() => setMenu(false), [path]);

  useEffect(() => {
    if (loading) return;
    if (!session) router.replace('/login');
    else if (!profile) router.replace('/completar-perfil');
  }, [loading, session, profile, router]);

  if (loading || !session || !profile) return <div className="min-h-screen"><Spinner /></div>;

  const active = (href: string) => (href === '/' ? path === '/' : path.startsWith(href) || (href === '/estadisticas' && path.startsWith('/ventas')));
  const salir = async () => { if (confirm('¿Deseás cerrar la sesión?')) { await signOut(); router.replace('/login'); } };

  return (
    <DeviceGate>
    <div className="min-h-screen md:flex">
      {/* Sidebar desktop */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-gradient-to-b from-royal-700 to-royal-900 text-white md:flex">
        <div className="flex items-center gap-3 px-6 py-6">
          <div className="rounded-full bg-white p-1"><Image src="/icon.png" alt="Royal Prestige" width={40} height={40} /></div>
          <div><p className="text-lg font-bold leading-tight">Royal App</p><p className="text-xs text-royal-100/80">Royal Prestige®</p></div>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${active(href) ? 'bg-white text-royal-700 shadow' : 'text-royal-50 hover:bg-white/10'}`}>
              <Icon size={19} /> {label}
              {href === '/cotizador' && count > 0 && <span className="ml-auto rounded-full bg-coral-500 px-2 py-0.5 text-xs font-bold text-white">{count}</span>}
            </Link>
          ))}
          <div className="mx-3 my-3 border-t border-white/15" />
          {[...((lider || profile.rol === 'admin') ? [{ href: '/red', label: 'Mi red', icon: Network }] : []), ...EXTRA].map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${path.startsWith(href) ? 'bg-white text-royal-700 shadow' : 'text-royal-50 hover:bg-white/10'}`}><Icon size={19} /> {label}</Link>
          ))}
          {profile.rol === 'admin' && (
            <Link href="/admin" className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${active('/admin') ? 'bg-white text-royal-700 shadow' : 'text-royal-50 hover:bg-white/10'}`}><Settings size={19} /> Administración</Link>
          )}
        </nav>
        <div className="m-3 rounded-2xl bg-white/10 p-4">
          <p className="truncate text-sm font-semibold">{profile.nombre}</p>
          <p className="truncate text-xs text-royal-100/80">{profile.codigo_vendedor ? `Vendedor ${profile.codigo_vendedor}` : profile.email}</p>
          <button onClick={salir} className="mt-3 flex items-center gap-2 text-xs font-semibold text-royal-100 hover:text-white"><LogOut size={14} /> Cerrar sesión</button>
        </div>
      </aside>

      {/* Header mobile */}
      <header className="sticky top-0 z-30 flex items-center justify-between bg-royal-600 px-4 py-3 text-white shadow md:hidden">
        <div className="flex items-center gap-2.5">
          <div className="rounded-full bg-white p-0.5"><Image src="/icon.png" alt="" width={30} height={30} /></div>
          <span className="font-bold">Royal App</span>
        </div>
        <button onClick={() => setMenu(true)} className="rounded-full p-2 hover:bg-white/10" aria-label="Menú"><Menu size={22} /></button>
      </header>

      {/* Menú mobile */}
      {menu && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm md:hidden" onClick={() => setMenu(false)}>
          <div className="absolute right-0 top-0 flex h-full w-72 flex-col bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between bg-royal-600 px-4 py-4 text-white">
              <div className="min-w-0"><p className="truncate font-semibold">{profile.nombre}</p><p className="truncate text-xs text-royal-100">{profile.codigo_vendedor ? `Vendedor ${profile.codigo_vendedor}` : profile.email}</p></div>
              <button onClick={() => setMenu(false)} className="rounded-full p-1.5 hover:bg-white/10" aria-label="Cerrar"><X size={20} /></button>
            </div>
            <nav className="flex-1 space-y-1 overflow-y-auto p-3">
              {[...NAV.filter((n) => n.soloMenu), ...((lider || profile.rol === 'admin') ? [{ href: '/red', label: 'Mi red', icon: Network }] : []), ...EXTRA, ...(profile.rol === 'admin' ? [{ href: '/admin', label: 'Administración', icon: Settings }] : [])].map(({ href, label, icon: Icon }) => (
                <Link key={href} href={href} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium ${path.startsWith(href) ? 'bg-royal-50 text-royal-700' : 'text-slate-700 hover:bg-slate-50'}`}><Icon size={20} /> {label}</Link>
              ))}
            </nav>
            <button onClick={salir} className="pb-safe flex items-center gap-3 border-t border-slate-100 px-6 py-4 text-sm font-semibold text-coral-600"><LogOut size={18} /> Cerrar sesión</button>
          </div>
        </div>
      )}

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-5 md:px-8 md:pb-10 md:pt-8">{children}</main>

      {/* Bottom nav mobile */}
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-slate-200 bg-white/95 backdrop-blur md:hidden">
        {NAV.filter((n) => !n.soloMenu).map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className={`relative flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium ${active(href) ? 'text-royal-600' : 'text-slate-500'}`}>
            <Icon size={22} strokeWidth={active(href) ? 2.4 : 1.8} />{label}
            {href === '/cotizador' && count > 0 && <span className="absolute right-[22%] top-1.5 rounded-full bg-coral-500 px-1.5 text-[10px] font-bold text-white">{count}</span>}
          </Link>
        ))}
      </nav>
    </div>
    </DeviceGate>
  );
}
