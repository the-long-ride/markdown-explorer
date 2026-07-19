import { useEffect, useState } from 'react';
import { REMIX_STATUS_TIMEOUT_MS } from './themeRemixModel';

export type RemixStatusTone = 'info' | 'error';
export type RemixStatus = { message: string; tone: RemixStatusTone };

export function useThemeRemixStatus(isOpen: boolean) {
  const [status, setStatus] = useState<RemixStatus | null>(null);
  const [statusKey, setStatusKey] = useState(0);
  const showStatus = (message: string, tone: RemixStatusTone = 'info') => { setStatus({ message, tone }); setStatusKey((key) => key + 1); };
  useEffect(() => {
    if (!isOpen) { setStatus(null); return; }
    if (!status) return;
    const timeoutId = window.setTimeout(() => setStatus(null), REMIX_STATUS_TIMEOUT_MS);
    return () => window.clearTimeout(timeoutId);
  }, [isOpen, status, statusKey]);
  return { status, statusKey, showStatus };
}
