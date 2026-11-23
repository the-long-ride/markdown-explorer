import { afterEach, describe, expect, it, vi } from 'vitest';
import { getInitialEditorFontSize, getInitialEditorWordWrap, matchesEditorShortcut, persistEditorFontSize, persistEditorWordWrap } from '../../../../ui/src/editor/editorUx';

afterEach(() => vi.unstubAllGlobals());

describe('editorUx shortcut and storage edges', () => {
  it('rejects empty and modifier-only shortcuts', () => {
    const chord = { key: 'b', ctrlKey: true, shiftKey: false, altKey: false, metaKey: false } as any;
    expect(matchesEditorShortcut(chord, '+')).toBe(false);
    expect(matchesEditorShortcut(chord, 'ctrl')).toBe(false);
    expect(matchesEditorShortcut(chord, undefined)).toBe(false);
  });

  it('uses defaults when localStorage is unavailable', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(typeof getInitialEditorWordWrap()).toBe('boolean');
    expect(getInitialEditorFontSize()).toBeGreaterThan(0);
    expect(() => { persistEditorWordWrap(true); persistEditorFontSize(16); }).not.toThrow();
  });
});
