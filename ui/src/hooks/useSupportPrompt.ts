// =============================================================================
// hooks/useSupportPrompt.ts — Hook managing support & appreciation prompt timing
// =============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import { DONATE_URL, GITHUB_REPO_URL } from '../constants/urls';
import { isWebRuntime } from '../insights/runtimeCapabilities';
import {
  addSupportPromptUsage,
  isDebugMode,
  loadSupportPromptState,
  markWebSupportPromptShown,
  recordSupportPromptShown,
  recordWebSupportFileOpen,
  setSupportPromptNeverShowAgain,
  shouldShowSupportPrompt,
  shouldShowWebSupportPrompt,
} from '../utils/supportPromptStore';

export interface UseSupportPromptOptions {
  enabled?: boolean;
  isBlocked?: boolean;
  isDebug?: boolean;
  tickIntervalMs?: number;
  onOpenExternal?: (url: string) => void;
  currentFile?: string | null;
  isWebDemo?: boolean;
}

export function useSupportPrompt({
  enabled = true,
  isBlocked = false,
  isDebug,
  tickIntervalMs = 30_000,
  onOpenExternal,
  currentFile,
  isWebDemo = isWebRuntime(),
}: UseSupportPromptOptions = {}) {
  const [isOpen, setIsOpen] = useState(false);
  const isOpenRef = useRef(isOpen);
  isOpenRef.current = isOpen;

  const lastTickRef = useRef(Date.now());
  const onOpenExternalRef = useRef(onOpenExternal);
  onOpenExternalRef.current = onOpenExternal;
  const dismissedInSessionRef = useRef(false);
  const lastCountedFileRef = useRef<string | null>(null);

  // In web demo mode, never use localhost/DEV heuristics to force-show the modal on startup.
  // Only honor an explicit boolean isDebug === true option.
  const effectiveDebug = isWebDemo ? isDebug === true : (isDebug ?? isDebugMode());

  // Track file opens in web demo mode
  useEffect(() => {
    if (!enabled || !isWebDemo) return;
    if (!currentFile || typeof currentFile !== 'string' || !currentFile.trim()) return;
    if (currentFile === lastCountedFileRef.current) return;

    lastCountedFileRef.current = currentFile;
    const next = recordWebSupportFileOpen();
    if (!isBlocked && !isOpenRef.current && shouldShowWebSupportPrompt(next, Date.now(), effectiveDebug)) {
      markWebSupportPromptShown();
      setIsOpen(true);
    }
  }, [currentFile, enabled, isBlocked, isWebDemo, effectiveDebug]);

  // On mount and interval, accumulate usage and check prompt condition
  useEffect(() => {
    if (!enabled) return;

    lastTickRef.current = Date.now();

    // Check immediately on mount if conditions are already satisfied
    const initialState = loadSupportPromptState();
    if (!isBlocked && !isOpenRef.current) {
      if (isWebDemo) {
        const canShow =
          (!effectiveDebug || !dismissedInSessionRef.current) &&
          shouldShowWebSupportPrompt(initialState, Date.now(), effectiveDebug);
        if (canShow) {
          markWebSupportPromptShown();
          setIsOpen(true);
        }
      } else {
        if (!dismissedInSessionRef.current && shouldShowSupportPrompt(initialState, effectiveDebug)) {
          setIsOpen(true);
          if (!effectiveDebug) {
            recordSupportPromptShown(initialState);
          }
        }
      }
    }

    const interval = setInterval(() => {
      const now = Date.now();
      const delta = Math.max(0, now - lastTickRef.current);
      lastTickRef.current = now;

      const updatedState = addSupportPromptUsage(delta);
      if (!isBlocked && !isOpenRef.current) {
        if (isWebDemo) {
          const canShow =
            (!effectiveDebug || !dismissedInSessionRef.current) &&
            shouldShowWebSupportPrompt(updatedState, now, effectiveDebug);
          if (canShow) {
            markWebSupportPromptShown(now);
            setIsOpen(true);
          }
        } else {
          if (!dismissedInSessionRef.current && shouldShowSupportPrompt(updatedState, effectiveDebug)) {
            setIsOpen(true);
            if (!effectiveDebug) {
              recordSupportPromptShown(updatedState);
            }
          }
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
      lastTickRef.current = Date.now();
      setIsOpen(true);
    };

    const win = typeof window !== 'undefined' ? (window as any) : undefined;
    if (win) {
      win.__openSupportModal = handleOpenEvent;
      win.__showSupportPrompt = handleOpenEvent;
    }

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('markdown-explorer-open-support-modal', handleOpenEvent);
    window.addEventListener('open-support-prompt-modal', handleOpenEvent);

    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('markdown-explorer-open-support-modal', handleOpenEvent);
      window.removeEventListener('open-support-prompt-modal', handleOpenEvent);
      handleBeforeUnload();
    };
  }, [enabled, isBlocked, tickIntervalMs, effectiveDebug, isWebDemo]);

  const handleClose = useCallback((neverShowAgain?: boolean) => {
    dismissedInSessionRef.current = true;
    if (neverShowAgain) {
      setSupportPromptNeverShowAgain();
    }
    setIsOpen(false);
  }, []);

  const openSupportLink = useCallback((url: string, neverShowAgain?: boolean) => {
    dismissedInSessionRef.current = true;
    if (onOpenExternalRef.current) {
      onOpenExternalRef.current(url);
    } else if (typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
    if (neverShowAgain) {
      setSupportPromptNeverShowAgain();
    }
    setIsOpen(false);
  }, []);

  const handleStar = useCallback((neverShowAgain?: boolean) => openSupportLink(GITHUB_REPO_URL, neverShowAgain), [openSupportLink]);
  const handleDonate = useCallback((neverShowAgain?: boolean) => openSupportLink(DONATE_URL, neverShowAgain), [openSupportLink]);

  return {
    isOpen,
    handleClose,
    handleStar,
    handleDonate,
  };
}
