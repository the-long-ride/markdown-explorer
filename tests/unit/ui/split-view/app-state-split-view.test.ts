import { describe, expect, it } from 'vitest';
import { createInitialState, initialState } from '../../../../ui/src/contexts/appStateModel';

describe('AppState split view initialization', () => {
  it('starts disabled with an empty primary pane', () => {
    expect(initialState.splitView.enabled).toBe(false);
    expect(initialState.splitView.primary.filePath).toBeNull();
    expect(initialState.splitView.secondary.filePath).toBeNull();
    expect(initialState.splitView.ratio).toBe(0.5);
  });

  it('does not restore split layout from persisted state', () => {
    const restored = createInitialState({} as any, false);
    expect(restored.splitView.enabled).toBe(false);
    expect(restored.splitView.activePane).toBe('primary');
  });
});
