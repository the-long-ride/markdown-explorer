// =============================================================================
// hooks/useSupportPrompt.ts — Hook managing support & appreciation prompt timing
// =============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import { GITHUB_REPO_URL } from '../constants/urls';
import {
  addSupportPromptUsage,
  isDebugMode,
  loadSupportPromptState,
  recordSupportPromptShown,
  setSupportPromptNeverShowAgain,
  shouldShowSupportPrompt,
} from '../utils/supportPromptStore';

export interface UseSupportPromptOptions {
  enabled?: boolean;
  isBlocked?: boolean;
  isDebug?: boolean;
  tickIntervalMs?: number;
  onOpenExternal?: (url: string) => void;
}

export function useSupportPrompt({
  enabled = true,
  isBlocked = false,
  isDebug,
  tickIntervalMs = 30_000,
  onOpenExternal,
}: UseSupportPromptOptions = {}) {
  const [isOpen, setIsOpen] = useState(false);
  const lastTickRef = useRef(Date.now());
  const onOpenExternalRef = useRef(onOpenExternal);
  onOpenExternalRef.current = onOpenExternal;
  const dismissedInSessionRef = useRef(false);

  const debug = isDebug ?? isDebugMode();

  // On mount and interval, accumulate usage and check prompt condition
  useEffect(() => {
    if (!enabled) return;

    lastTickRef.current = Date.now();

    // Check immediately on mount if conditions are already satisfied
    const initialState = loadSupportPromptState();
    if (!isBlocked && !dismissedInSessionRef.current && shouldShowSupportPrompt(initialState, debug)) {
      setIsOpen(true);
      if (!debug) {
        recordSupportPromptShown(initialState);
      }
    }

    const interval = setInterval(() => {
      const now = Date.now();
      const delta = Math.max(0, now - lastTickRef.current);
      lastTickRef.current = now;

      const updatedState = addSupportPromptUsage(delta);
      if (!isBlocked && !isOpen && !dismissedInSessionRef.current && shouldShowSupportPrompt(updatedState, debug)) {
        setIsOpen(true);
        if (!debug) {
          recordSupportPromptShown(updatedState);
        }
      }
    }, tickIntervalMs);

    const handleBeforeUnload = () => {
      const now = Date.now();
      const delta = Math.max(0, now - lastTickRef.current);
      addSupportPromptUsage(delta);
    };

    const handleOpenEvent = () => {
      dismissedInSessionRef.current = false;
      setIsOpen(true);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('markdown-explorer-open-support-modal', handleOpenEvent);

    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('markdown-explorer-open-support-modal', handleOpenEvent);
      handleBeforeUnload();
    };
  }, [enabled, isBlocked, isOpen, tickIntervalMs, debug]);

  const handleClose = useCallback((neverShowAgain?: boolean) => {
    dismissedInSessionRef.current = true;
    if (neverShowAgain) {
      setSupportPromptNeverShowAgain();
    }
    setIsOpen(false);
  }, []);

  const handleStar = useCallback((neverShowAgain?: boolean) => {
    dismissedInSessionRef.current = true;
    if (onOpenExternalRef.current) {
      onOpenExternalRef.current(GITHUB_REPO_URL);
    } else if (typeof window !== 'undefined') {
      window.open(GITHUB_REPO_URL, '_blank', 'noopener,noreferrer');
    }
    if (neverShowAgain) {
      setSupportPromptNeverShowAgain();
    }
    setIsOpen(false);
  }, []);

  return {
    isOpen,
    handleClose,
    handleStar,
  };
}
