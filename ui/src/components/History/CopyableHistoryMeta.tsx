import { useEffect, useRef, useState } from 'react';
import { usePlatform } from '../../contexts/PlatformContext';
import { TooltipButton } from '../shared/TooltipButton';

interface CopyableHistoryMetaProps {
  display: string;
  copyValue: string;
  tooltip: string;
  copiedLabel: string;
  monospace?: boolean;
}

export function CopyableHistoryMeta({ display, copyValue, tooltip, copiedLabel, monospace = false }: CopyableHistoryMetaProps) {
  const bridge = usePlatform();
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
  }, []);

  const copy = async () => {
    try {
      await bridge.copyToClipboard(copyValue);
      setCopied(true);
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  };

  return (
    <span className="document-history-panel__copy-meta">
      <TooltipButton
        type="button"
        className={`document-history-panel__meta-copy${monospace ? ' is-monospace' : ''}`}
        tooltip={tooltip}
        label={display}
        onlyIcon={false}
        aria-label={tooltip}
        onClick={() => { void copy(); }}
      />
      <span className="sr-only" aria-live="polite">{copied ? copiedLabel : ''}</span>
    </span>
  );
}
