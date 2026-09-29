import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { initialState } from '../../../../ui/src/contexts/appStateModel';
import { useStableDocumentState } from '../../../../ui/src/components/Content/useStableDocumentState';

describe('useStableDocumentState', () => {
  it('keeps the same reference across unrelated state changes', () => {
    const { result, rerender } = renderHook(({ state }) => useStableDocumentState(state), { initialProps: { state: initialState } });
    const first = result.current;
    rerender({ state: { ...initialState, renderVersion: 99, splitView: { ...initialState.splitView, ratio: 0.3 }, contentTabs: [] } });
    expect(result.current).toBe(first);
  });

  it('changes when a field panes read changes', () => {
    const { result, rerender } = renderHook(({ state }) => useStableDocumentState(state), { initialProps: { state: initialState } });
    const first = result.current;
    rerender({ state: { ...initialState, theme: initialState.theme === 'dark' ? 'light' : 'dark' } });
    expect(result.current).not.toBe(first);
    const second = result.current;
    rerender({ state: { ...second, settings: { ...second.settings, language: 'vi' } } });
    expect(result.current).not.toBe(second);
  });
});
