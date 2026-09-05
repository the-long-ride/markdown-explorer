// =============================================================================
// utils/supportPromptStore.ts — Local storage management for Community Support prompt
// =============================================================================

import { SUPPORT_PROMPT_STATE_STORAGE_KEY } from '../constants/storage';

export const SUPPORT_PROMPT_FIRST_THRESHOLD_MS = 2 * 60 * 60 * 1000; // 2 hours
export const SUPPORT_PROMPT_REPEAT_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

const LEGACY_STORAGE_KEY = 'markdown-explorer-star-prompt-state-v1';

export interface SupportPromptState {
  totalUsageMs: number;
  lastPromptUsageMs: number;
  neverShowAgain: boolean;
}

export function getDefaultSupportPromptState(): SupportPromptState {
  return {
    totalUsageMs: 0,
    lastPromptUsageMs: 0,
    neverShowAgain: false,
  };
}

export function loadSupportPromptState(): SupportPromptState {
  if (typeof localStorage === 'undefined') {
    return getDefaultSupportPromptState();
  }
  try {
    const raw = localStorage.getItem(SUPPORT_PROMPT_STATE_STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return getDefaultSupportPromptState();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return getDefaultSupportPromptState();
    return {
      totalUsageMs: typeof parsed.totalUsageMs === 'number' && Number.isFinite(parsed.totalUsageMs) ? Math.max(0, parsed.totalUsageMs) : 0,
      lastPromptUsageMs: typeof parsed.lastPromptUsageMs === 'number' && Number.isFinite(parsed.lastPromptUsageMs) ? Math.max(0, parsed.lastPromptUsageMs) : 0,
      neverShowAgain: Boolean(parsed.neverShowAgain),
    };
  } catch {
    return getDefaultSupportPromptState();
  }
}

export function saveSupportPromptState(state: SupportPromptState): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(SUPPORT_PROMPT_STATE_STORAGE_KEY, JSON.stringify(state));
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

export function recordSupportPromptShown(customState?: SupportPromptState): SupportPromptState {
  const current = customState ? { ...customState } : loadSupportPromptState();
  current.lastPromptUsageMs = current.totalUsageMs;
  saveSupportPromptState(current);
  return current;
}

export function setSupportPromptNeverShowAgain(customState?: SupportPromptState): SupportPromptState {
  const current = customState ? { ...customState } : loadSupportPromptState();
  current.neverShowAgain = true;
  saveSupportPromptState(current);
  return current;
}

export function addSupportPromptUsage(deltaMs: number, customState?: SupportPromptState): SupportPromptState {
  if (deltaMs <= 0) return customState ?? loadSupportPromptState();
  const current = customState ? { ...customState } : loadSupportPromptState();
  current.totalUsageMs += deltaMs;
  saveSupportPromptState(current);
  return current;
}

export function resetSupportPromptState(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(SUPPORT_PROMPT_STATE_STORAGE_KEY);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // Ignore
  }
}
