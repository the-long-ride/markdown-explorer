import { useCallback, useEffect, useRef, useState } from 'react';
import type { PlatformBridge } from '../../platform/bridge';
import type { PersistedState } from '../../types';

export interface FileHistoryLayout {
  readonly listWidth: number;
  readonly splitRatio: number;
}

export const LIST_WIDTH = { min: 200, max: 560, initial: 280, step: 16 } as const;
export const SPLIT_RATIO = { min: 0.2, max: 0.8, initial: 0.5, step: 0.02 } as const;
const PERSIST_DELAY_MS = 200;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const finiteOr = (value: unknown, fallback: number) => (typeof value === 'number' && Number.isFinite(value) ? value : fallback);

function normalize(listWidth: number, splitRatio: number): FileHistoryLayout {
  return {
    listWidth: Math.round(clamp(listWidth, LIST_WIDTH.min, LIST_WIDTH.max)),
    splitRatio: Math.round(clamp(splitRatio, SPLIT_RATIO.min, SPLIT_RATIO.max) * 1000) / 1000,
  };
}

function readLayout(bridge: PlatformBridge): FileHistoryLayout {
  const stored = bridge.getState<PersistedState>()?.fileHistoryLayout;
  return normalize(finiteOr(stored?.listWidth, LIST_WIDTH.initial), finiteOr(stored?.splitRatio, SPLIT_RATIO.initial));
}

/** Commit-list width and diff split ratio for the file history modal, persisted in bridge state. */
export function useFileHistoryLayout(bridge: PlatformBridge) {
  const [layout, setLayout] = useState(() => readLayout(bridge));
  const pendingRef = useRef<FileHistoryLayout | null>(null);

  const flush = useCallback(() => {
    const next = pendingRef.current;
    if (!next) return;
    pendingRef.current = null;
    const state = bridge.getState<PersistedState>() ?? {};
    bridge.setState<PersistedState>({ ...state, fileHistoryLayout: next });
  }, [bridge]);

  // Dragging updates many times per second; write once the pointer settles.
  useEffect(() => {
    if (!pendingRef.current) return undefined;
    const timer = window.setTimeout(flush, PERSIST_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [flush, layout]);
  useEffect(() => flush, [flush]);

  const updateLayout = useCallback((patch: Partial<FileHistoryLayout>) => {
    setLayout((previous) => {
      const next = normalize(patch.listWidth ?? previous.listWidth, patch.splitRatio ?? previous.splitRatio);
      if (next.listWidth === previous.listWidth && next.splitRatio === previous.splitRatio) return previous;
      pendingRef.current = next;
      return next;
    });
  }, []);

  return { layout, updateLayout };
}
