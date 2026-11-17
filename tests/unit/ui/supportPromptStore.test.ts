import { beforeEach, describe, expect, it } from 'vitest';
import { SUPPORT_PROMPT_STATE_STORAGE_KEY } from '../../../ui/src/constants/storage';
import {
  addSupportPromptUsage,
  getDefaultSupportPromptState,
  isDebugMode,
  loadSupportPromptState,
  markWebSupportPromptShown,
  recordSupportPromptShown,
  recordWebSupportFileOpen,
  resetSupportPromptState,
  saveSupportPromptState,
  setSupportPromptNeverShowAgain,
  shouldShowSupportPrompt,
  shouldShowWebSupportPrompt,
  SUPPORT_PROMPT_FIRST_THRESHOLD_MS,
  SUPPORT_PROMPT_REPEAT_INTERVAL_MS,
  WEB_SUPPORT_PROMPT_FIRST_FILES_THRESHOLD,
  WEB_SUPPORT_PROMPT_FIRST_USAGE_MS,
  WEB_SUPPORT_PROMPT_REPEAT_FILES_THRESHOLD,
  WEB_SUPPORT_PROMPT_REPEAT_INTERVAL_MS,
  type SupportPromptState,
} from '../../../ui/src/utils/supportPromptStore';

describe('supportPromptStore', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('creates clean default state', () => {
    const state = getDefaultSupportPromptState();
    expect(state.totalUsageMs).toBe(0);
    expect(state.lastPromptUsageMs).toBe(0);
    expect(state.neverShowAgain).toBe(false);
    expect(state.webPromptCount).toBe(0);
    expect(state.webFilesOpenedSinceReset).toBe(0);
    expect(state.webUsageMsSinceReset).toBe(0);
    expect(state.webLastResetTimestampMs).toBe(0);
  });

  it('loads default state when localStorage is empty or corrupt', () => {
    expect(loadSupportPromptState()).toEqual(getDefaultSupportPromptState());

    localStorage.setItem(SUPPORT_PROMPT_STATE_STORAGE_KEY, 'invalid json');
    expect(loadSupportPromptState()).toEqual(getDefaultSupportPromptState());

    localStorage.setItem(SUPPORT_PROMPT_STATE_STORAGE_KEY, JSON.stringify({ totalUsageMs: 'invalid' }));
    expect(loadSupportPromptState().totalUsageMs).toBe(0);
  });

  it('loads legacy star prompt state if new key is missing', () => {
    localStorage.setItem('markdown-explorer-star-prompt-state-v1', JSON.stringify({
      totalUsageMs: 9000000,
      lastPromptUsageMs: 7200000,
      neverShowAgain: false,
    }));

    const state = loadSupportPromptState();
    expect(state.totalUsageMs).toBe(9000000);
    expect(state.lastPromptUsageMs).toBe(7200000);
  });

  it('saves and loads state properly', () => {
    const customState: SupportPromptState = {
      totalUsageMs: 5000,
      lastPromptUsageMs: 4000,
      neverShowAgain: false,
      webPromptCount: 1,
      webFilesOpenedSinceReset: 2,
      webUsageMsSinceReset: 3000,
      webLastResetTimestampMs: 1731280000000,
    };
    saveSupportPromptState(customState);
    expect(loadSupportPromptState()).toEqual(customState);
  });

  it('should not show prompt before 2 hours threshold', () => {
    const state = getDefaultSupportPromptState();
    state.totalUsageMs = SUPPORT_PROMPT_FIRST_THRESHOLD_MS - 1;
    expect(shouldShowSupportPrompt(state)).toBe(false);
  });

  it('should show prompt after reaching 2 hours threshold for first time', () => {
    const state = getDefaultSupportPromptState();
    state.totalUsageMs = SUPPORT_PROMPT_FIRST_THRESHOLD_MS;
    expect(shouldShowSupportPrompt(state)).toBe(true);

    state.totalUsageMs = SUPPORT_PROMPT_FIRST_THRESHOLD_MS + 1000;
    expect(shouldShowSupportPrompt(state)).toBe(true);
  });

  it('never shows prompt if neverShowAgain is true', () => {
    const state: SupportPromptState = {
      totalUsageMs: SUPPORT_PROMPT_FIRST_THRESHOLD_MS * 10,
      lastPromptUsageMs: 0,
      neverShowAgain: true,
    };
    expect(shouldShowSupportPrompt(state)).toBe(false);
  });

  it('handles repeat interval after being shown once', () => {
    let state = getDefaultSupportPromptState();
    state.totalUsageMs = SUPPORT_PROMPT_FIRST_THRESHOLD_MS;
    expect(shouldShowSupportPrompt(state)).toBe(true);

    // Record shown at 2h
    state = recordSupportPromptShown(state);
    expect(state.lastPromptUsageMs).toBe(SUPPORT_PROMPT_FIRST_THRESHOLD_MS);

    // Immediately after being shown, shouldShowSupportPrompt is false
    expect(shouldShowSupportPrompt(state)).toBe(false);

    // 10 hours of additional usage: should still be false (< 24h)
    state.totalUsageMs += 10 * 3600 * 1000;
    expect(shouldShowSupportPrompt(state)).toBe(false);

    // 24 hours of additional usage reached: should be true
    state.totalUsageMs = SUPPORT_PROMPT_FIRST_THRESHOLD_MS + SUPPORT_PROMPT_REPEAT_INTERVAL_MS;
    expect(shouldShowSupportPrompt(state)).toBe(true);
  });

  it('addSupportPromptUsage accumulates time and ignores negative deltas', () => {
    addSupportPromptUsage(5000);
    expect(loadSupportPromptState().totalUsageMs).toBe(5000);

    addSupportPromptUsage(-1000);
    expect(loadSupportPromptState().totalUsageMs).toBe(5000);

    addSupportPromptUsage(2500);
    expect(loadSupportPromptState().totalUsageMs).toBe(7500);
  });

  it('setSupportPromptNeverShowAgain persists neverShowAgain flag', () => {
    setSupportPromptNeverShowAgain();
    const state = loadSupportPromptState();
    expect(state.neverShowAgain).toBe(true);
    expect(shouldShowSupportPrompt(state)).toBe(false);
  });

  it('resetSupportPromptState clears storage keys', () => {
    addSupportPromptUsage(10000);
    expect(loadSupportPromptState().totalUsageMs).toBe(10000);
    resetSupportPromptState();
    expect(loadSupportPromptState().totalUsageMs).toBe(0);
  });

  describe('debug mode behavior', () => {
    it('always shows prompt when isDebug is true, even with 0 usage or neverShowAgain', () => {
      const state = getDefaultSupportPromptState();
      expect(shouldShowSupportPrompt(state, true)).toBe(true);

      state.neverShowAgain = true;
      expect(shouldShowSupportPrompt(state, true)).toBe(true);

      state.lastPromptUsageMs = 10000;
      state.totalUsageMs = 10000;
      expect(shouldShowSupportPrompt(state, true)).toBe(true);
    });

    it('detects debug mode from window.__DEBUG__', () => {
      (window as any).__DEBUG__ = true;
      expect(isDebugMode()).toBe(true);
      delete (window as any).__DEBUG__;
    });

    it('detects debug mode from window.__MARKDOWN_EXPLORER_DEBUG__', () => {
      (window as any).__MARKDOWN_EXPLORER_DEBUG__ = true;
      expect(isDebugMode()).toBe(true);
      delete (window as any).__MARKDOWN_EXPLORER_DEBUG__;
    });

    it('detects debug mode from localStorage', () => {
      localStorage.setItem('markdown-explorer-debug', 'true');
      expect(isDebugMode()).toBe(true);
      localStorage.removeItem('markdown-explorer-debug');

      localStorage.setItem('debug', '1');
      expect(isDebugMode()).toBe(true);
      localStorage.removeItem('debug');
    });

    it('detects debug mode from sessionStorage', () => {
      sessionStorage.setItem('markdown-explorer-debug', 'true');
      expect(isDebugMode()).toBe(true);
      sessionStorage.removeItem('markdown-explorer-debug');
    });

    it('detects debug mode from URL search parameters and hash', () => {
      const originalLocation = window.location;
      delete (window as any).location;
      window.location = { ...originalLocation, search: '?debug=1' } as any;

      expect(isDebugMode()).toBe(true);

      window.location = { ...originalLocation, search: '?mode=debug' } as any;
      expect(isDebugMode()).toBe(true);

      window.location = { ...originalLocation, search: '', hash: '#debug' } as any;
      expect(isDebugMode()).toBe(true);

      window.location = originalLocation;
    });

    it('exposes __openSupportModal and __showSupportPrompt global helpers on window', () => {
      expect(typeof (window as any).__openSupportModal).toBe('function');
      expect(typeof (window as any).__showSupportPrompt).toBe('function');
    });

    it('returns false when no debug flags are set in test environment', () => {
      expect(isDebugMode()).toBe(false);
    });
  });

  describe('web demo support prompt dual-counter state machine', () => {
    it('exports expected web threshold constants', () => {
      expect(WEB_SUPPORT_PROMPT_FIRST_FILES_THRESHOLD).toBe(2);
      expect(WEB_SUPPORT_PROMPT_FIRST_USAGE_MS).toBe(20 * 60 * 1000);
      expect(WEB_SUPPORT_PROMPT_REPEAT_FILES_THRESHOLD).toBe(10);
      expect(WEB_SUPPORT_PROMPT_REPEAT_INTERVAL_MS).toBe(7 * 24 * 60 * 60 * 1000);
    });

    it('recordWebSupportFileOpen increments webFilesOpenedSinceReset and initializes reset timestamp', () => {
      const now = 1731280000000;
      const first = recordWebSupportFileOpen(now);
      expect(first.webFilesOpenedSinceReset).toBe(1);
      expect(first.webLastResetTimestampMs).toBe(now);

      const second = recordWebSupportFileOpen(now + 1000);
      expect(second.webFilesOpenedSinceReset).toBe(2);
      expect(second.webLastResetTimestampMs).toBe(now); // keeps initial timestamp
    });

    it('addSupportPromptUsage accumulates both totalUsageMs and webUsageMsSinceReset', () => {
      const now = 1731280000000;
      const state = addSupportPromptUsage(5000, undefined, now);
      expect(state.totalUsageMs).toBe(5000);
      expect(state.webUsageMsSinceReset).toBe(5000);
      expect(state.webLastResetTimestampMs).toBe(now);

      const state2 = addSupportPromptUsage(3000, undefined, now + 10000);
      expect(state2.totalUsageMs).toBe(8000);
      expect(state2.webUsageMsSinceReset).toBe(8000);
      expect(state2.webLastResetTimestampMs).toBe(now);
    });

    it('initial trigger: fires at 2 files opened before 20 minutes', () => {
      const state = getDefaultSupportPromptState();
      state.webPromptCount = 0;
      state.webFilesOpenedSinceReset = 1;
      state.webUsageMsSinceReset = 1000;
      expect(shouldShowWebSupportPrompt(state)).toBe(false);

      state.webFilesOpenedSinceReset = 2;
      expect(shouldShowWebSupportPrompt(state)).toBe(true);
    });

    it('initial trigger: fires at 20 minutes usage before 2 files opened', () => {
      const state = getDefaultSupportPromptState();
      state.webPromptCount = 0;
      state.webFilesOpenedSinceReset = 1;
      state.webUsageMsSinceReset = WEB_SUPPORT_PROMPT_FIRST_USAGE_MS - 1;
      expect(shouldShowWebSupportPrompt(state)).toBe(false);

      state.webUsageMsSinceReset = WEB_SUPPORT_PROMPT_FIRST_USAGE_MS;
      expect(shouldShowWebSupportPrompt(state)).toBe(true);
    });

    it('never shows web prompt when neverShowAgain is true', () => {
      const state = getDefaultSupportPromptState();
      state.neverShowAgain = true;
      state.webFilesOpenedSinceReset = 100;
      state.webUsageMsSinceReset = WEB_SUPPORT_PROMPT_REPEAT_INTERVAL_MS * 10;
      expect(shouldShowWebSupportPrompt(state)).toBe(false);
    });

    it('repeat trigger: fires at 10 files opened before 1 week', () => {
      const state = getDefaultSupportPromptState();
      state.webPromptCount = 1;
      state.webFilesOpenedSinceReset = 9;
      state.webUsageMsSinceReset = 60000;
      state.webLastResetTimestampMs = 1731280000000;
      const now = state.webLastResetTimestampMs + 60000; // 1 min elapsed
      expect(shouldShowWebSupportPrompt(state, now)).toBe(false);

      state.webFilesOpenedSinceReset = 10;
      expect(shouldShowWebSupportPrompt(state, now)).toBe(true);
    });

    it('repeat trigger: fires at 1 week wall-clock elapsed before 10 files opened', () => {
      const state = getDefaultSupportPromptState();
      state.webPromptCount = 1;
      state.webFilesOpenedSinceReset = 3;
      state.webLastResetTimestampMs = 1731280000000;
      const nowBeforeWeek = state.webLastResetTimestampMs + WEB_SUPPORT_PROMPT_REPEAT_INTERVAL_MS - 1;
      expect(shouldShowWebSupportPrompt(state, nowBeforeWeek)).toBe(false);

      const nowAtWeek = state.webLastResetTimestampMs + WEB_SUPPORT_PROMPT_REPEAT_INTERVAL_MS;
      expect(shouldShowWebSupportPrompt(state, nowAtWeek)).toBe(true);
    });

    it('repeat trigger: fires at 1 week active usage accumulated before 10 files opened', () => {
      const state = getDefaultSupportPromptState();
      state.webPromptCount = 1;
      state.webFilesOpenedSinceReset = 1;
      state.webLastResetTimestampMs = 1731280000000;
      state.webUsageMsSinceReset = WEB_SUPPORT_PROMPT_REPEAT_INTERVAL_MS - 1;
      const now = state.webLastResetTimestampMs + 60000;
      expect(shouldShowWebSupportPrompt(state, now)).toBe(false);

      state.webUsageMsSinceReset = WEB_SUPPORT_PROMPT_REPEAT_INTERVAL_MS;
      expect(shouldShowWebSupportPrompt(state, now)).toBe(true);
    });

    it('markWebSupportPromptShown increments prompt count and resets both file and usage counters', () => {
      const now = 1731285000000;
      let state = getDefaultSupportPromptState();
      state.totalUsageMs = 25000;
      state.webFilesOpenedSinceReset = 2;
      state.webUsageMsSinceReset = 25000;
      state.webLastResetTimestampMs = now - 25000;
      saveSupportPromptState(state);

      const next = markWebSupportPromptShown(now);
      expect(next.webPromptCount).toBe(1);
      expect(next.webFilesOpenedSinceReset).toBe(0);
      expect(next.webUsageMsSinceReset).toBe(0);
      expect(next.webLastResetTimestampMs).toBe(now);
      expect(next.lastPromptUsageMs).toBe(25000);

      // Verify persisted state matches
      const loaded = loadSupportPromptState();
      expect(loaded.webPromptCount).toBe(1);
      expect(loaded.webFilesOpenedSinceReset).toBe(0);
      expect(loaded.webUsageMsSinceReset).toBe(0);
      expect(loaded.webLastResetTimestampMs).toBe(now);
      expect(loaded.lastPromptUsageMs).toBe(25000);
    });

    it('does not show web prompt on initial entry even when isDebugMode would be true on localhost', () => {
      // Simulate localhost / dev where isDebugMode() evaluates to true
      (window as any).__DEBUG__ = true;
      expect(isDebugMode()).toBe(true);

      const state = getDefaultSupportPromptState();
      // shouldShowWebSupportPrompt defaults isDebug to false so localhost heuristics do not force-open
      expect(shouldShowWebSupportPrompt(state)).toBe(false);

      // Only explicit isDebug=true forces prompt
      expect(shouldShowWebSupportPrompt(state, Date.now(), true)).toBe(true);

      delete (window as any).__DEBUG__;
    });
  });
});

