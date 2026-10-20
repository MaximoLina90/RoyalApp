export const pesos = (n: number) => '$ ' + Math.round(n || 0).toLocaleString('es-AR');
export const fechaCorta = (iso: string) => new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
export const hoyISO = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
export const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
export const EVENTO_COLOR: Record<string, string> = {
  Demo: 'bg-royal-600 text-white', Entrevista: 'bg-amber-500 text-white', 'Capacitación': 'bg-emerald-600 text-white',
  Servicio: 'bg-coral-500 text-white', Otro: 'bg-slate-500 text-white',
};
export const EVENTO_DOT: Record<string, string> = {
  Demo: 'bg-royal-600', Entrevista: 'bg-amber-500', 'Capacitación': 'bg-emerald-600', Servicio: 'bg-coral-500', Otro: 'bg-slate-500',
};
