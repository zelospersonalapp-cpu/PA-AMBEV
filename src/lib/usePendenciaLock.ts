/**
 * Hook compartilhado — controla se o bloqueio de pendências está ativo.
 * O valor é salvo em localStorage e lido por qualquer componente.
 */
import { useState, useEffect } from 'react';

const STORAGE_KEY = 'pendencia_lock_enabled';

export function usePendenciaLock() {
  const [enabled, setEnabledState] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      // padrão: OFF (false) até o admin ligar manualmente
      return stored === null ? false : stored === 'true';
    } catch {
      return false;
    }
  });

  const setEnabled = (value: boolean) => {
    try {
      localStorage.setItem(STORAGE_KEY, String(value));
    } catch {
      // ignore
    }
    setEnabledState(value);
    // dispara evento para outros componentes abertos na mesma aba
    window.dispatchEvent(new CustomEvent('pendencia-lock-changed', { detail: value }));
  };

  // Reage a mudanças feitas por outro componente na mesma aba
  useEffect(() => {
    const handler = (e: Event) => {
      setEnabledState((e as CustomEvent<boolean>).detail);
    };
    window.addEventListener('pendencia-lock-changed', handler);
    return () => window.removeEventListener('pendencia-lock-changed', handler);
  }, []);

  return { enabled, setEnabled };
}
