import { useCallback, useEffect, useRef, type RefObject } from 'react';
import type { HeadingSectionState } from './enhancements/headingSectionState';
import { createHeadingSectionInteractions } from './headingSectionInteractions';
import {
  flushReadingProgress,
  getHeadingState,
  getScrollPosition,
  rememberHeadingState,
  rememberScrollPosition,
} from '../../readingProgress/readingProgressStore';

// Reading Progress Memory wiring shared by the content render effects: keeps a
// stable workspace key for capture callbacks, hydrates per-document state from
// the persisted store, and flushes pending writes on hide/unload/unmount.
export function useReadingProgressPersistence(workspaceKey: string) {
  const workspaceKeyRef = useRef(workspaceKey);
  useEffect(() => { workspaceKeyRef.current = workspaceKey; }, [workspaceKey]);

  useEffect(() => {
    const flush = () => flushReadingProgress();
    window.addEventListener('beforeunload', flush);
    document.addEventListener('visibilitychange', flush);
    return () => {
      window.removeEventListener('beforeunload', flush);
      document.removeEventListener('visibilitychange', flush);
      flushReadingProgress();
    };
  }, []);

  const handleScrollCaptured = useCallback((filePath: string, scrollTop: number) => {
    rememberScrollPosition(workspaceKeyRef.current, filePath, scrollTop);
  }, []);

  const rememberHeadingsFor = useCallback((filePath: string, captured: ReadonlyMap<string, boolean>) => {
    rememberHeadingState(workspaceKeyRef.current, filePath, captured);
  }, []);

  return { handleScrollCaptured, rememberHeadingsFor };
}

export function seedHeadingStateForFile(
  stateByFile: Map<string, HeadingSectionState>,
  workspaceKey: string,
  currentFile: string | null,
): void {
  if (!currentFile) return;
  if (stateByFile.has(currentFile)) return;
  const stored = getHeadingState(workspaceKey, currentFile);
  if (stored) stateByFile.set(currentFile, stored);
}

export function resolveRestoredScroll(
  scrollPositions: Record<string, number>,
  workspaceKey: string,
  currentFile: string | null,
): number {
  if (!currentFile) return 0;
  return scrollPositions[currentFile] ?? getScrollPosition(workspaceKey, currentFile) ?? 0;
}

export function createScrollPersistHandler(
  scrollRef: RefObject<HTMLDivElement | null>,
  workspaceKey: string,
  currentFile: string | null,
): { persist: () => void; flush: () => void } {
  let lastPersistedScrollAt = 0;
  let pendingScrollTop: number | null = null;
  const persist = () => {
    const now = Date.now();
    if (scrollRef.current && currentFile && now - lastPersistedScrollAt > 400) {
      lastPersistedScrollAt = now;
      pendingScrollTop = null;
      rememberScrollPosition(workspaceKey, currentFile, scrollRef.current.scrollTop);
    } else if (scrollRef.current && currentFile) {
      // Throttled: hold onto the latest position so lifecycle cleanup can
      // flush it, otherwise the final offset before hide/close/unmount is
      // lost and the document reopens at a stale position.
      pendingScrollTop = scrollRef.current.scrollTop;
    }
  };
  const flush = () => {
    if (pendingScrollTop === null || !currentFile) return;
    const position = pendingScrollTop;
    pendingScrollTop = null;
    rememberScrollPosition(workspaceKey, currentFile, position);
  };
  return { persist, flush };
}

export function restoreScrollPosition(args: {
  scrollRef: RefObject<HTMLDivElement | null>;
  positions: Record<string, number>;
  workspaceKey: string;
  currentFile: string | null;
  renderVersion: number;
  lastFileRef: RefObject<string | null>;
  lastVersionRef: RefObject<number | null>;
}): void {
  const { scrollRef, positions, workspaceKey, currentFile, renderVersion, lastFileRef, lastVersionRef } = args;
  if (!scrollRef.current) return;
  if (lastFileRef.current === currentFile && lastVersionRef.current === renderVersion) return;
  const savedScroll = resolveRestoredScroll(positions, workspaceKey, currentFile);
  if (currentFile && savedScroll) positions[currentFile] = savedScroll;
  scrollRef.current.scrollTop = savedScroll || 0;
  lastFileRef.current = currentFile;
  lastVersionRef.current = renderVersion;
}

export function createTrackedHeadingSections(args: {
  body: HTMLElement;
  currentFile: string | null;
  defaultExpanded: boolean;
  stateByFile: Map<string, HeadingSectionState>;
  workspaceKey: string;
  onPersist: (filePath: string, captured: ReadonlyMap<string, boolean>) => void;
}) {
  seedHeadingStateForFile(args.stateByFile, args.workspaceKey, args.currentFile);
  return createHeadingSectionInteractions({
    body: args.body,
    currentFile: args.currentFile,
    defaultExpanded: args.defaultExpanded,
    stateByFile: args.stateByFile,
    onRemember: (captured) => {
      if (args.currentFile) args.onPersist(args.currentFile, captured);
    },
  });
}
