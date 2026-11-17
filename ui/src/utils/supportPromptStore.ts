// =============================================================================
// utils/supportPromptStore.ts — Local storage management for Community Support prompt
// =============================================================================

import { SUPPORT_PROMPT_STATE_STORAGE_KEY } from '../constants/storage';

export const SUPPORT_PROMPT_FIRST_THRESHOLD_MS = 2 * 60 * 60 * 1000; // 2 hours
export const SUPPORT_PROMPT_REPEAT_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

export const WEB_SUPPORT_PROMPT_FIRST_FILES_THRESHOLD = 2;
export const WEB_SUPPORT_PROMPT_FIRST_USAGE_MS = 20 * 60 * 1000; // 20 minutes
export const WEB_SUPPORT_PROMPT_REPEAT_FILES_THRESHOLD = 10;
export const WEB_SUPPORT_PROMPT_REPEAT_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // 1 week (7 days)

const LEGACY_STORAGE_KEY = 'markdown-explorer-star-prompt-state-v1';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

export interface SupportPromptState {
  totalUsageMs: number;
  lastPromptUsageMs: number;
  neverShowAgain: boolean;
  webPromptCount: number;
  webFilesOpenedSinceReset: number;
  webUsageMsSinceReset: number;
  webLastResetTimestampMs: number;
}

export function getDefaultSupportPromptState(): SupportPromptState {
  return {
    totalUsageMs: 0,
    lastPromptUsageMs: 0,
    neverShowAgain: false,
    webPromptCount: 0,
    webFilesOpenedSinceReset: 0,
    webUsageMsSinceReset: 0,
    webLastResetTimestampMs: 0,
  };
}

export function loadSupportPromptState(storage?: StorageLike): SupportPromptState {
  const store = storage ?? (typeof localStorage !== 'undefined' ? localStorage : undefined);
  if (!store) {
    return getDefaultSupportPromptState();
  }
  try {
    const raw = store.getItem(SUPPORT_PROMPT_STATE_STORAGE_KEY) || store.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return getDefaultSupportPromptState();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return getDefaultSupportPromptState();
    return {
      totalUsageMs: typeof parsed.totalUsageMs === 'number' && Number.isFinite(parsed.totalUsageMs) ? Math.max(0, parsed.totalUsageMs) : 0,
      lastPromptUsageMs: typeof parsed.lastPromptUsageMs === 'number' && Number.isFinite(parsed.lastPromptUsageMs) ? Math.max(0, parsed.lastPromptUsageMs) : 0,
      neverShowAgain: Boolean(parsed.neverShowAgain),
      webPromptCount: typeof parsed.webPromptCount === 'number' && Number.isFinite(parsed.webPromptCount) ? Math.max(0, parsed.webPromptCount) : 0,
      webFilesOpenedSinceReset: typeof parsed.webFilesOpenedSinceReset === 'number' && Number.isFinite(parsed.webFilesOpenedSinceReset) ? Math.max(0, parsed.webFilesOpenedSinceReset) : 0,
      webUsageMsSinceReset: typeof parsed.webUsageMsSinceReset === 'number' && Number.isFinite(parsed.webUsageMsSinceReset) ? Math.max(0, parsed.webUsageMsSinceReset) : 0,
      webLastResetTimestampMs: typeof parsed.webLastResetTimestampMs === 'number' && Number.isFinite(parsed.webLastResetTimestampMs) ? Math.max(0, parsed.webLastResetTimestampMs) : 0,
    };
  } catch {
    return getDefaultSupportPromptState();
  }
}

export function saveSupportPromptState(state: SupportPromptState, storage?: StorageLike): void {
  const store = storage ?? (typeof localStorage !== 'undefined' ? localStorage : undefined);
  if (!store) return;
  try {
    store.setItem(SUPPORT_PROMPT_STATE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage write errors (e.g. quota or sandbox restrictions)
  }
}

export function isDebugMode(): boolean {
  if (typeof window === 'undefined') return false;

  // Explicit debug flags always take precedence
  try {
    const win = window as any;
    if (win.__DEBUG__ === true || win.__MARKDOWN_EXPLORER_DEBUG__ === true || win.electronAPI?.isDebug === true) {
      return true;
    }
  } catch {}

  try {
    const flag =
      localStorage.getItem('markdown-explorer-debug') ??
      localStorage.getItem('debug') ??
      sessionStorage.getItem('markdown-explorer-debug') ??
      sessionStorage.getItem('debug');
    if (flag && /^(1|true|yes|on)$/i.test(flag)) {
      return true;
    }
  } catch {}

  try {
    const params = new URLSearchParams(window.location.search);
    if (params.has('debug') && params.get('debug') !== '0' && params.get('debug') !== 'false') {
      return true;
    }
    if (params.get('mode') === 'debug') {
      return true;
    }
    if (window.location.hash.includes('debug')) {
      return true;
    }
  } catch {}

  // Avoid defaulting to debug mode inside automated test environments
  const isTestEnv =
    (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test') ||
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.MODE === 'test');

  if (isTestEnv) {
    return false;
  }

  // Vite development server / Node development runtime
  try {
    if (typeof import.meta !== 'undefined' && (import.meta as any).env?.DEV) {
      return true;
    }
  } catch {}
  try {
    if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
      return true;
    }
  } catch {}

  // Localhost web development
  try {
    if (
      window.location &&
      (window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname === '0.0.0.0' ||
        window.location.port === '5173')
    ) {
      return true;
    }
  } catch {}

  return false;
}

if (typeof window !== 'undefined') {
  const win = window as any;
  win.__openSupportModal = () => {
    window.dispatchEvent(new CustomEvent('markdown-explorer-open-support-modal'));
    window.dispatchEvent(new CustomEvent('open-support-prompt-modal'));
  };
  win.__showSupportPrompt = win.__openSupportModal;
}

export function shouldShowSupportPrompt(
  state: SupportPromptState,
  isDebug: boolean = isDebugMode(),
): boolean {
  if (isDebug) {
    return true;
  }
  if (state.neverShowAgain) {
    return false;
  }
  if (state.lastPromptUsageMs === 0) {
    return state.totalUsageMs >= SUPPORT_PROMPT_FIRST_THRESHOLD_MS;
  }
  return state.totalUsageMs - state.lastPromptUsageMs >= SUPPORT_PROMPT_REPEAT_INTERVAL_MS;
}

export function recordSupportPromptShown(customState?: SupportPromptState, storage?: StorageLike): SupportPromptState {
  const current = customState ? { ...customState } : loadSupportPromptState(storage);
  current.lastPromptUsageMs = current.totalUsageMs;
  saveSupportPromptState(current, storage);
  return current;
}

export function setSupportPromptNeverShowAgain(customState?: SupportPromptState, storage?: StorageLike): SupportPromptState {
  const current = customState ? { ...customState } : loadSupportPromptState(storage);
  current.neverShowAgain = true;
  saveSupportPromptState(current, storage);
  return current;
}

export function recordWebSupportFileOpen(
  nowMs: number = Date.now(),
  storage?: StorageLike,
): SupportPromptState {
  const current = loadSupportPromptState(storage);
  current.webFilesOpenedSinceReset += 1;
  if (!current.webLastResetTimestampMs) {
    current.webLastResetTimestampMs = nowMs;
  }
  saveSupportPromptState(current, storage);
  return current;
}

export function addSupportPromptUsage(
  deltaMs: number,
  storageOrState?: StorageLike | SupportPromptState,
  nowMs: number = Date.now(),
): SupportPromptState {
  const isCustomState = Boolean(storageOrState && 'totalUsageMs' in storageOrState);
  const storage = isCustomState ? undefined : (storageOrState as StorageLike | undefined);
  const current = isCustomState ? { ...(storageOrState as SupportPromptState) } : loadSupportPromptState(storage);
  if (deltaMs <= 0) return current;
  const safeDelta = Math.max(0, deltaMs);
  current.totalUsageMs += safeDelta;
  current.webUsageMsSinceReset = (current.webUsageMsSinceReset || 0) + safeDelta;
  if (!current.webLastResetTimestampMs) {
    current.webLastResetTimestampMs = nowMs;
  }
  if (!isCustomState) {
    saveSupportPromptState(current, storage);
  }
  return current;
}

export function shouldShowWebSupportPrompt(
  state: SupportPromptState,
  nowMs: number = Date.now(),
  isDebug: boolean = false,
): boolean {
  if (state.neverShowAgain) {
    return false;
  }
  if (isDebug) {
    return true;
  }
  if (state.webPromptCount === 0) {
    return (
      state.webFilesOpenedSinceReset >= WEB_SUPPORT_PROMPT_FIRST_FILES_THRESHOLD ||
      state.webUsageMsSinceReset >= WEB_SUPPORT_PROMPT_FIRST_USAGE_MS
    );
  }
  const elapsedWallClockMs =
    state.webLastResetTimestampMs > 0 ? Math.max(0, nowMs - state.webLastResetTimestampMs) : 0;
  return (
    state.webFilesOpenedSinceReset >= WEB_SUPPORT_PROMPT_REPEAT_FILES_THRESHOLD ||
    elapsedWallClockMs >= WEB_SUPPORT_PROMPT_REPEAT_INTERVAL_MS ||
    state.webUsageMsSinceReset >= WEB_SUPPORT_PROMPT_REPEAT_INTERVAL_MS
  );
}

export function markWebSupportPromptShown(
  nowMsOrState: number | SupportPromptState = Date.now(),
  storage?: StorageLike,
): SupportPromptState {
  const isCustomState = typeof nowMsOrState === 'object' && nowMsOrState !== null;
  const nowMs = typeof nowMsOrState === 'number' ? nowMsOrState : Date.now();
  const current = isCustomState ? { ...nowMsOrState } : loadSupportPromptState(storage);
  current.webPromptCount = (current.webPromptCount || 0) + 1;
  current.webFilesOpenedSinceReset = 0;
  current.webUsageMsSinceReset = 0;
  current.webLastResetTimestampMs = nowMs;
  current.lastPromptUsageMs = current.totalUsageMs;
  if (!isCustomState) {
    saveSupportPromptState(current, storage);
  }
  return current;
}

export function resetSupportPromptState(storage?: StorageLike): void {
  const store = storage ?? (typeof localStorage !== 'undefined' ? localStorage : undefined);
  if (!store) return;
  try {
    if (store.removeItem) {
      store.removeItem(SUPPORT_PROMPT_STATE_STORAGE_KEY);
      store.removeItem(LEGACY_STORAGE_KEY);
    }
  } catch {
    // Ignore
  }
}

export function resetSupportPromptCountersToBeginning(
  nowMs: number = Date.now(),
  storage?: StorageLike | null,
): SupportPromptState {
  const store = storage === null ? undefined : storage;
  const current = loadSupportPromptState(store ?? undefined);
  current.totalUsageMs = 0;
  current.lastPromptUsageMs = 0;
  current.webPromptCount = 0;
  current.webFilesOpenedSinceReset = 0;
  current.webUsageMsSinceReset = 0;
  current.webLastResetTimestampMs = nowMs;
  saveSupportPromptState(current, store ?? undefined);
  return current;
}

export function triggerSupportModalAndResetCounters(
  nowMs: number = Date.now(),
  storage?: StorageLike | null,
): SupportPromptState {
  const next = resetSupportPromptCountersToBeginning(nowMs, storage);
  if (typeof window !== 'undefined') {
    const win = window as any;
    if (typeof win.__openSupportModal === 'function') {
      try {
        win.__openSupportModal();
      } catch {}
    }
    try {
      window.dispatchEvent(new CustomEvent('open-support-prompt-modal'));
    } catch {}
    try {
      window.dispatchEvent(new CustomEvent('markdown-explorer-open-support-modal'));
    } catch {}
  }
  return next;
}
