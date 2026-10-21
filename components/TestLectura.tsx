'use client';
import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, RotateCcw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Spinner } from '@/components/ui';

type Preg = { id: string; capitulo: string | null; pregunta: string; opciones: string[] };
type Det = { id: string; correcta: number; ok: boolean; explicacion: string | null };
type Res = { correctas: number; total: number; aprobado: boolean; detalle: Det[] };

export default function TestLectura({ videoId, titulo, onAprobado }: { videoId: string; titulo: string; onAprobado: () => void }) {
  const [preg, setPreg] = useState<Preg[] | null>(null);
  const [resp, setResp] = useState<Record<string, number>>({});
  const [res, setRes] = useState<Res | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  const cargar = async () => {
    setPreg(null); setResp({}); setRes(null); setError('');
    const { data, error } = await supabase.rpc('preguntas_test', { p_video: videoId, p_cant: 10 });
    if (error) { setError(error.message); setPreg([]); return; }
    setPreg((data as Preg[]) ?? []);
  };
  useEffect(() => { cargar(); }, [videoId]); // eslint-disable-line react-hooks/exhaustive-deps

  const enviar = async () => {
    setEnviando(true);
    const { data, error } = await supabase.rpc('corregir_test', { p_video: videoId, p_respuestas: resp });
    setEnviando(false);
    if (error) return setError(error.message);
    const r = data as Res; setRes(r);
    if (r.aprobado) onAprobado();
    window.scrollTo?.(0, 0);
  };

  if (!preg) return <Spinner />;
  if (error && !res) return <p className="text-sm text-coral-600">{error}</p>;
  const det = new Map((res?.detalle ?? []).map((d) => [d.id, d]));
  const completo = preg.length > 0 && preg.every((p) => resp[p.id] !== undefined);

  return (
    <div className="space-y-4">
      {res ? (
        <div className={`rounded-2xl p-4 ${res.aprobado ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>
          <p className="text-lg font-bold">{res.aprobado ? '🎉 ¡Aprobaste!' : 'Casi… te faltó poco'} {res.correctas}/{res.total}</p>
          <p className="text-sm">{res.aprobado ? `"${titulo}" ya cuenta como leído en tu avance y tus objetivos.` : 'Necesitás 7 de 10. Repasá los capítulos marcados y volvé a intentarlo: te tocan otras preguntas.'}</p>
          {!res.aprobado && <button className="btn-primary mt-3" onClick={cargar}><RotateCcw size={16} /> Intentar de nuevo</button>}
        </div>
      ) : <p className="text-sm text-slate-500">10 preguntas sobre el libro. Aprobás con 7. Si no sale, podés repetirlo cuantas veces quieras.</p>}
      {preg.map((p, i) => { const d = det.get(p.id); return (
        <div key={p.id} className="rounded-2xl border border-slate-200 p-4">
          {p.capitulo && <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">{p.capitulo}</p>}
          <p className="mb-2 font-semibold">{i + 1}. {p.pregunta}</p>
          <div className="space-y-1.5">{p.opciones.map((o, j) => {
            const sel = resp[p.id] === j; const esOk = d && d.correcta === j; const esMal = d && sel && !d.ok;
            return (
              <button key={j} disabled={!!res} onClick={() => setResp({ ...resp, [p.id]: j })}
                className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm transition ${esOk ? 'border-emerald-400 bg-emerald-50' : esMal ? 'border-rose-400 bg-rose-50' : sel ? 'border-royal-500 bg-royal-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                {esOk ? <CheckCircle2 size={16} className="shrink-0 text-emerald-600" /> : esMal ? <XCircle size={16} className="shrink-0 text-coral-600" /> : <span className={`h-4 w-4 shrink-0 rounded-full border ${sel ? 'border-4 border-royal-600' : 'border-slate-300'}`} />}
                {o}
              </button>); })}</div>
          {d && d.explicacion && <p className="mt-2 text-xs text-slate-500">💡 {d.explicacion}</p>}
        </div>); })}
      {!res && <button className="btn-primary w-full" disabled={!completo || enviando} onClick={enviar}>{enviando ? 'Corrigiendo…' : completo ? 'Enviar respuestas' : `Respondé todas (${Object.keys(resp).length}/${preg.length})`}</button>}
    </div>
  );
}
