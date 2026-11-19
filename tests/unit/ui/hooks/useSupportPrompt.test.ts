import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DONATE_URL, GITHUB_REPO_URL } from '../../../../ui/src/constants/urls';
import { useSupportPrompt } from '../../../../ui/src/hooks/useSupportPrompt';
import {
  loadSupportPromptState,
  saveSupportPromptState,
  SUPPORT_PROMPT_FIRST_THRESHOLD_MS,
  WEB_SUPPORT_PROMPT_FIRST_USAGE_MS,
} from '../../../../ui/src/utils/supportPromptStore';

describe('useSupportPrompt', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('remains closed when usage threshold is not met', () => {
    const { result } = renderHook(() => useSupportPrompt({ tickIntervalMs: 1000 }));
    expect(result.current.isOpen).toBe(false);

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(result.current.isOpen).toBe(false);
    expect(loadSupportPromptState().totalUsageMs).toBe(5000);
  });

  it('opens immediately on mount if state already meets threshold and is not blocked', () => {
    saveSupportPromptState({
      totalUsageMs: SUPPORT_PROMPT_FIRST_THRESHOLD_MS + 100,
      lastPromptUsageMs: 0,
      neverShowAgain: false,
    });

    const { result } = renderHook(() => useSupportPrompt());
    expect(result.current.isOpen).toBe(true);
    expect(loadSupportPromptState().lastPromptUsageMs).toBe(SUPPORT_PROMPT_FIRST_THRESHOLD_MS + 100);
  });

  it('does not open on mount if blocked', () => {
    saveSupportPromptState({
      totalUsageMs: SUPPORT_PROMPT_FIRST_THRESHOLD_MS + 100,
      lastPromptUsageMs: 0,
      neverShowAgain: false,
    });

    const { result } = renderHook(() => useSupportPrompt({ isBlocked: true }));
    expect(result.current.isOpen).toBe(false);
  });

  it('opens after interval ticks reach threshold', () => {
    const { result } = renderHook(() => useSupportPrompt({ tickIntervalMs: 1000 }));
    expect(result.current.isOpen).toBe(false);

    act(() => {
      vi.advanceTimersByTime(SUPPORT_PROMPT_FIRST_THRESHOLD_MS);
    });

    expect(result.current.isOpen).toBe(true);
  });

  it('handleClose closes modal and records neverShowAgain when true', () => {
    saveSupportPromptState({
      totalUsageMs: SUPPORT_PROMPT_FIRST_THRESHOLD_MS + 100,
      lastPromptUsageMs: 0,
      neverShowAgain: false,
    });

    const { result } = renderHook(() => useSupportPrompt());
    expect(result.current.isOpen).toBe(true);

    act(() => {
      result.current.handleClose(true);
    });

    expect(result.current.isOpen).toBe(false);
    expect(loadSupportPromptState().neverShowAgain).toBe(true);
  });

  it('handleStar triggers onOpenExternal and closes modal', () => {
    const onOpenExternal = vi.fn();
    saveSupportPromptState({
      totalUsageMs: SUPPORT_PROMPT_FIRST_THRESHOLD_MS + 100,
      lastPromptUsageMs: 0,
      neverShowAgain: false,
    });

    const { result } = renderHook(() => useSupportPrompt({ onOpenExternal }));
    expect(result.current.isOpen).toBe(true);

    act(() => {
      result.current.handleStar(false);
    });

    expect(onOpenExternal).toHaveBeenCalledWith(GITHUB_REPO_URL);
    expect(result.current.isOpen).toBe(false);
    expect(loadSupportPromptState().neverShowAgain).toBe(false);
  });

  it('handleDonate opens the donation page and closes modal', () => {
    const onOpenExternal = vi.fn();
    saveSupportPromptState({
      totalUsageMs: SUPPORT_PROMPT_FIRST_THRESHOLD_MS + 100,
      lastPromptUsageMs: 0,
      neverShowAgain: false,
    });

    const { result } = renderHook(() => useSupportPrompt({ onOpenExternal }));
    act(() => {
      result.current.handleDonate(true);
    });

    expect(DONATE_URL).toBe('https://github.com/the-long-ride#donate');
    expect(onOpenExternal).toHaveBeenCalledWith(DONATE_URL);
    expect(result.current.isOpen).toBe(false);
    expect(loadSupportPromptState().neverShowAgain).toBe(true);
  });

  it('handleStar falls back to window.open if onOpenExternal not provided', () => {
    const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    saveSupportPromptState({
      totalUsageMs: SUPPORT_PROMPT_FIRST_THRESHOLD_MS + 100,
      lastPromptUsageMs: 0,
      neverShowAgain: false,
    });

    const { result } = renderHook(() => useSupportPrompt());
    expect(result.current.isOpen).toBe(true);

    act(() => {
      result.current.handleStar(true);
    });

    expect(windowOpenSpy).toHaveBeenCalledWith(GITHUB_REPO_URL, '_blank', 'noopener,noreferrer');
    expect(result.current.isOpen).toBe(false);
    expect(loadSupportPromptState().neverShowAgain).toBe(true);
  });

  describe('debug mode in useSupportPrompt', () => {
    it('opens immediately on mount in debug mode with 0 usage', () => {
      const { result } = renderHook(() => useSupportPrompt({ isDebug: true }));
      expect(result.current.isOpen).toBe(true);
      // In debug mode, usage tracking does not record lastPromptUsageMs so developer state is preserved
      expect(loadSupportPromptState().lastPromptUsageMs).toBe(0);
    });

    it('does not re-open on interval ticks in the same session after being dismissed', () => {
      const { result } = renderHook(() => useSupportPrompt({ isDebug: true, tickIntervalMs: 1000 }));
      expect(result.current.isOpen).toBe(true);

      act(() => {
        result.current.handleClose();
      });
      expect(result.current.isOpen).toBe(false);

      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(result.current.isOpen).toBe(false);
    });

    it('can be manually re-opened via window event even after dismissal', () => {
      const { result } = renderHook(() => useSupportPrompt({ isDebug: true }));
      expect(result.current.isOpen).toBe(true);

      act(() => {
        result.current.handleClose();
      });
      expect(result.current.isOpen).toBe(false);

      act(() => {
        window.dispatchEvent(new CustomEvent('markdown-explorer-open-support-modal'));
      });
      expect(result.current.isOpen).toBe(true);
    });
  });

  describe('web demo support prompt dual-counter behavior', () => {
    it('triggers initial prompt after opening 2 distinct files and resets both counters', () => {
      const { result, rerender } = renderHook(
        ({ currentFile }) => useSupportPrompt({ isWebDemo: true, currentFile }),
        { initialProps: { currentFile: 'doc-1.md' } },
      );

      // First file: modal should not open yet
      expect(result.current.isOpen).toBe(false);
      let state = loadSupportPromptState();
      expect(state.webFilesOpenedSinceReset).toBe(1);
      expect(state.webPromptCount).toBe(0);

      // Re-rendering with same file does not increment
      rerender({ currentFile: 'doc-1.md' });
      expect(result.current.isOpen).toBe(false);
      state = loadSupportPromptState();
      expect(state.webFilesOpenedSinceReset).toBe(1);

      // Second distinct file: triggers prompt and resets both counters immediately
      rerender({ currentFile: 'doc-2.md' });
      expect(result.current.isOpen).toBe(true);
      state = loadSupportPromptState();
      expect(state.webPromptCount).toBe(1);
      expect(state.webFilesOpenedSinceReset).toBe(0);
      expect(state.webUsageMsSinceReset).toBe(0);

      // User dismisses modal
      act(() => {
        result.current.handleClose();
      });
      expect(result.current.isOpen).toBe(false);

      // Repeat triggers: opening 9 more files does not trigger yet
      for (let i = 3; i <= 11; i++) {
        rerender({ currentFile: `doc-${i}.md` });
        expect(result.current.isOpen).toBe(false);
      }
      state = loadSupportPromptState();
      expect(state.webFilesOpenedSinceReset).toBe(9);

      // 10th distinct file opened since reset: triggers repeat modal!
      rerender({ currentFile: 'doc-12.md' });
      expect(result.current.isOpen).toBe(true);
      state = loadSupportPromptState();
      expect(state.webPromptCount).toBe(2);
      expect(state.webFilesOpenedSinceReset).toBe(0);
      expect(state.webUsageMsSinceReset).toBe(0);
    });

    it('triggers web demo prompt after 20 minutes active usage and resets counters', () => {
      const { result } = renderHook(() =>
        useSupportPrompt({ isWebDemo: true, tickIntervalMs: 1000 }),
      );
      expect(result.current.isOpen).toBe(false);

      act(() => {
        vi.advanceTimersByTime(WEB_SUPPORT_PROMPT_FIRST_USAGE_MS);
      });

      expect(result.current.isOpen).toBe(true);
      const state = loadSupportPromptState();
      expect(state.webPromptCount).toBe(1);
      expect(state.webFilesOpenedSinceReset).toBe(0);
      expect(state.webUsageMsSinceReset).toBe(0);
    });

    it('does not open modal when blocked even if files threshold is met', () => {
      const { result, rerender } = renderHook(
        ({ currentFile, isBlocked }) =>
          useSupportPrompt({ isWebDemo: true, currentFile, isBlocked }),
        { initialProps: { currentFile: 'doc-1.md', isBlocked: true } },
      );

      rerender({ currentFile: 'doc-2.md', isBlocked: true });
      expect(result.current.isOpen).toBe(false);

      const state = loadSupportPromptState();
      // Counter incremented to 2, but modal blocked
      expect(state.webFilesOpenedSinceReset).toBe(2);
      expect(state.webPromptCount).toBe(0);
    });

    it('does not open modal on first-time entry even if localhost debug flag is present', () => {
      (window as any).__DEBUG__ = true;

      const { result } = renderHook(() =>
        useSupportPrompt({ isWebDemo: true, tickIntervalMs: 1000 }),
      );

      // Should remain closed because web demo ignores localhost/DEV debug heuristic
      expect(result.current.isOpen).toBe(false);

      delete (window as any).__DEBUG__;
    });

    it('closing the donate modal in Web Demo closes in 1 click and never re-opens immediately', () => {
      const { result, rerender } = renderHook(
        ({ currentFile }) => useSupportPrompt({ isWebDemo: true, currentFile }),
        { initialProps: { currentFile: 'first.md' } },
      );

      // Open second file to trigger modal
      rerender({ currentFile: 'second.md' });
      expect(result.current.isOpen).toBe(true);

      // Close modal in 1 click
      act(() => {
        result.current.handleClose();
      });

      // Must remain closed in 1 click, not re-open
      expect(result.current.isOpen).toBe(false);

      // Advance timers to confirm it does not immediately bounce back
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(result.current.isOpen).toBe(false);
    });

    it('closing a debug-forced modal in Web Demo closes in 1 click and respects session dismissal', () => {
      const { result } = renderHook(() =>
        useSupportPrompt({ isWebDemo: true, isDebug: true, tickIntervalMs: 1000 }),
      );

      expect(result.current.isOpen).toBe(true);

      act(() => {
        result.current.handleClose();
      });

      expect(result.current.isOpen).toBe(false);

      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(result.current.isOpen).toBe(false);
    });
  });
});

