'use client';
import { useState, useCallback } from 'react';
export function useToast() {
  const [state, set] = useState<{ msg: string | null; kind: 'ok' | 'error' }>({ msg: null, kind: 'ok' });
  const show = useCallback((msg: string, kind: 'ok' | 'error' = 'ok') => { set({ msg, kind }); setTimeout(() => set({ msg: null, kind }), 2800); }, []);
  return { ...state, show };
}
