import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GITHUB_REPO_URL } from '../../../../ui/src/constants/urls';
import { useSupportPrompt } from '../../../../ui/src/hooks/useSupportPrompt';
import {
  loadSupportPromptState,
  saveSupportPromptState,
  SUPPORT_PROMPT_FIRST_THRESHOLD_MS,
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
});

