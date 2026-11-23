import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  EDITOR_FONT_SIZE_STORAGE_KEY, EDITOR_WORD_WRAP_STORAGE_KEY, fontSizeActionForChord, formatCommandForChord, getEditorCommandShortcutLabel,
  getEditorFontSizeShortcutLabel, getInitialEditorFontSize, getInitialEditorWordWrap, isRedoChord, matchesEditorShortcut,
  persistEditorFontSize, persistEditorWordWrap,
} from '../../../../ui/src/editor/editorUx';

const chord = (key: string, mods: Record<string, boolean> = {}) => ({ key, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...mods }) as any;
afterEach(() => { localStorage.clear(); vi.restoreAllMocks(); });

describe('editor shortcut matching', () => {
  it('matches modifier and arrow aliases and rejects malformed shortcuts', () => {
    expect(matchesEditorShortcut(chord('b', { ctrlKey: true }), undefined)).toBe(false);
    expect(matchesEditorShortcut(chord('b', { ctrlKey: true }), '')).toBe(false);
    expect(matchesEditorShortcut(chord('b', { ctrlKey: true }), 'ctrl+shift')).toBe(false);
    expect(matchesEditorShortcut(chord('ArrowLeft', { altKey: true }), 'option+<-')).toBe(true);
    expect(matchesEditorShortcut(chord('ArrowRight', { metaKey: true }), 'cmd+right')).toBe(true);
    expect(matchesEditorShortcut(chord('ArrowRight', { ctrlKey: true }), 'mod+->')).toBe(true);
    expect(isRedoChord(chord('Z', { ctrlKey: true, shiftKey: true }))).toBe(true);
    expect(isRedoChord(chord('y', { ctrlKey: true }))).toBe(true);
  });

  it('resolves custom keybindings and labels', () => {
    formatCommandForChord(chord('b', { ctrlKey: true }), { bold: '' } as any);
    formatCommandForChord(chord('q', { ctrlKey: true, altKey: true }), { bold: 'ctrl+alt+q' } as any);
    fontSizeActionForChord(chord('=', { ctrlKey: true }), { 'font-size-increase': '' } as any);
    expect(getEditorCommandShortcutLabel('bold' as any, { editorBold: 'alt+shift+ctrl+b' }, {}, 'MacIntel')).toMatch(/⌥⇧⌘/);
    getEditorCommandShortcutLabel('bold' as any, { editorBold: '' }, {}, 'Win32');
    getEditorCommandShortcutLabel('bold' as any, undefined, { editorBold: true }, 'Win32');
    expect(getEditorFontSizeShortcutLabel('nope' as any)).toBeUndefined();
    getEditorFontSizeShortcutLabel('increase', { editorFontSizeIncrease: '' }, {}, 'Win32');
  });
});

describe('editor preference storage', () => {
  it('reads and writes word wrap and font size, tolerating storage errors', () => {
    localStorage.setItem(EDITOR_WORD_WRAP_STORAGE_KEY, 'false');
    expect(getInitialEditorWordWrap()).toBe(false);
    persistEditorWordWrap(true);
    expect(localStorage.getItem(EDITOR_WORD_WRAP_STORAGE_KEY)).toBe('true');
    localStorage.setItem(EDITOR_FONT_SIZE_STORAGE_KEY, 'abc');
    expect(getInitialEditorFontSize()).toBe(14);
    persistEditorFontSize(99);
    expect(Number(localStorage.getItem(EDITOR_FONT_SIZE_STORAGE_KEY))).toBeLessThanOrEqual(32);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied'); });
    expect(getInitialEditorWordWrap()).toBe(true);
    expect(getInitialEditorFontSize()).toBe(14);
    expect(() => persistEditorWordWrap(false)).not.toThrow();
    expect(() => persistEditorFontSize(12)).not.toThrow();
  });
});
