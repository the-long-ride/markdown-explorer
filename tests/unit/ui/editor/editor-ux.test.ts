import { describe, expect, it } from 'vitest';
import {
  clampEditorFontSize,
  countWords,
  DEFAULT_EDITOR_FONT_SIZE,
  editorModKeyLabel,
  fillTemplate,
  fontSizeActionForChord,
  formatCommandForChord,
  formatShortcutLabel,
  getEditorCommandShortcutLabel,
  getEditorFontSizeShortcutLabel,
  getInitialEditorFontSize,
  isApplePlatform,
  isInlineMarkdownEditorTarget,
  isMarkdownEditorTarget,
  MAX_EDITOR_FONT_SIZE,
  MIN_EDITOR_FONT_SIZE,
  persistEditorFontSize,
} from '../../../../ui/src/editor/editorUx';

function chord(key: string, extra: Partial<{ ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean }> = {}) {
  return { key, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...extra };
}

describe('editorUx', () => {
  it('labels the modifier and shortcuts per platform', () => {
    expect(isApplePlatform('MacIntel')).toBe(true);
    expect(isApplePlatform('Win32')).toBe(false);
    expect(editorModKeyLabel('MacIntel')).toBe('⌘');
    expect(editorModKeyLabel('Linux x86_64')).toBe('Ctrl');
    expect(formatShortcutLabel('B', { platform: 'Win32' })).toBe('Ctrl+B');
    expect(formatShortcutLabel('Z', { platform: 'Win32', shift: true })).toBe('Ctrl+Shift+Z');
    expect(formatShortcutLabel('B', { platform: 'MacIntel' })).toBe('⌘B');
    expect(formatShortcutLabel('Z', { platform: 'iPad', shift: true })).toBe('⇧⌘Z');
  });

  it('maps only plain Mod+B/I/K/` chords to formatting commands', () => {
    expect(formatCommandForChord(chord('b', { ctrlKey: true }))).toBe('bold');
    expect(formatCommandForChord(chord('I', { metaKey: true }))).toBe('italic');
    expect(formatCommandForChord(chord('k', { ctrlKey: true }))).toBe('link');
    expect(formatCommandForChord(chord('`', { ctrlKey: true }))).toBe('inline-code');
    expect(formatCommandForChord(chord('b'))).toBeNull();
    expect(formatCommandForChord(chord('b', { ctrlKey: true, shiftKey: true }))).toBeNull();
    expect(formatCommandForChord(chord('b', { ctrlKey: true, altKey: true }))).toBeNull();
    expect(formatCommandForChord(chord('s', { ctrlKey: true }))).toBeNull();
  });

  it('respects custom keybindings and skips disabled bindings in formatCommandForChord', () => {
    // Custom keybinding
    expect(formatCommandForChord(chord('l', { ctrlKey: true }), { editorBold: 'Ctrl+L' })).toBe('bold');
    expect(formatCommandForChord(chord('q', { ctrlKey: true, shiftKey: true }), { editorQuote: 'Ctrl+Shift+Q' })).toBe('quote');

    // Default bindings still work if not overridden
    expect(formatCommandForChord(chord('i', { ctrlKey: true }), { editorBold: 'Ctrl+L' })).toBe('italic');

    // Skipped when disabled
    expect(formatCommandForChord(chord('b', { ctrlKey: true }), undefined, { editorBold: true })).toBeNull();
    expect(formatCommandForChord(chord('l', { ctrlKey: true }), { editorBold: 'Ctrl+L' }, { editorBold: true })).toBeNull();
    expect(formatCommandForChord(chord('q', { ctrlKey: true, shiftKey: true }), { editorQuote: 'Ctrl+Shift+Q' }, { editorQuote: true })).toBeNull();
  });

  it('formats editor shortcut labels and returns undefined when disabled', () => {
    // Default shortcut label
    expect(getEditorCommandShortcutLabel('bold', undefined, undefined, 'Win32')).toBe('Ctrl+B');
    expect(getEditorCommandShortcutLabel('bold', undefined, undefined, 'MacIntel')).toBe('⌘B');

    // Custom shortcut label
    expect(getEditorCommandShortcutLabel('bold', { editorBold: 'Ctrl+L' }, undefined, 'Win32')).toBe('Ctrl+L');
    expect(getEditorCommandShortcutLabel('bold', { editorBold: 'Ctrl+L' }, undefined, 'MacIntel')).toBe('⌘L');
    expect(getEditorCommandShortcutLabel('quote', { editorQuote: 'Ctrl+Shift+Q' }, undefined, 'Win32')).toBe('Ctrl+Shift+Q');
    expect(getEditorCommandShortcutLabel('quote', { editorQuote: 'Ctrl+Shift+Q' }, undefined, 'MacIntel')).toBe('⇧⌘Q');

    // Disabled shortcut returns undefined
    expect(getEditorCommandShortcutLabel('bold', undefined, { editorBold: true })).toBeUndefined();
    expect(getEditorCommandShortcutLabel('bold', { editorBold: 'Ctrl+L' }, { editorBold: true })).toBeUndefined();
    expect(getEditorCommandShortcutLabel('quote', { editorQuote: 'Ctrl+Shift+Q' }, { editorQuote: true })).toBeUndefined();

    // Unknown command returns undefined
    expect(getEditorCommandShortcutLabel('nonexistent-cmd' as any)).toBeUndefined();
  });

  it('detects targets inside the Markdown editors', () => {
    const plain = document.createElement('div');
    plain.className = 'markdown-source-editor';
    const plainChild = document.createElement('span');
    plain.appendChild(plainChild);
    const inline = document.createElement('div');
    inline.className = 'markdown-inline-editor';
    const textarea = document.createElement('textarea');
    inline.appendChild(textarea);

    expect(isMarkdownEditorTarget(plainChild)).toBe(true);
    expect(isInlineMarkdownEditorTarget(plainChild)).toBe(false);
    expect(isMarkdownEditorTarget(textarea)).toBe(true);
    expect(isInlineMarkdownEditorTarget(textarea)).toBe(true);
    expect(isMarkdownEditorTarget(document.createElement('input'))).toBe(false);
    expect(isMarkdownEditorTarget(null)).toBe(false);
  });

  it('counts words and fills templates', () => {
    expect(countWords('')).toBe(0);
    expect(countWords('# Hello, **world**!\n- it’s 42')).toBe(4);
    expect(countWords('Xin chào các bạn')).toBe(4);
    expect(fillTemplate('Ln {line}, Col {column}', { line: 3, column: 7 })).toBe('Ln 3, Col 7');
    expect(fillTemplate('{count} words {missing}', { count: 2 })).toBe('2 words {missing}');
  });

  it('clamps and persists editor font size between 8px and 32px', () => {
    expect(MIN_EDITOR_FONT_SIZE).toBe(8);
    expect(MAX_EDITOR_FONT_SIZE).toBe(32);
    expect(clampEditorFontSize(14)).toBe(14);
    expect(clampEditorFontSize(5)).toBe(8);
    expect(clampEditorFontSize(50)).toBe(32);
    expect(clampEditorFontSize(NaN)).toBe(DEFAULT_EDITOR_FONT_SIZE);

    persistEditorFontSize(20);
    expect(getInitialEditorFontSize()).toBe(20);
    persistEditorFontSize(DEFAULT_EDITOR_FONT_SIZE);
  });

  it('detects font-size shortcut chords and formats labels', () => {
    expect(fontSizeActionForChord(chord('-', { ctrlKey: true }))).toBe('decrease');
    expect(fontSizeActionForChord(chord('=', { ctrlKey: true }))).toBe('increase');
    // On keyboards where + or _ are reported
    expect(fontSizeActionForChord(chord('+', { ctrlKey: true }))).toBe('increase');
    expect(fontSizeActionForChord(chord('_', { ctrlKey: true }))).toBe('decrease');
    expect(fontSizeActionForChord(chord('a', { ctrlKey: true }))).toBeNull();

    expect(getEditorFontSizeShortcutLabel('decrease', undefined, undefined, 'Win32')).toBe('Ctrl+-');
    expect(getEditorFontSizeShortcutLabel('increase', undefined, undefined, 'Win32')).toBe('Ctrl+=');
    expect(getEditorFontSizeShortcutLabel('decrease', undefined, undefined, 'MacIntel')).toBe('⌘-');
    expect(getEditorFontSizeShortcutLabel('increase', undefined, undefined, 'MacIntel')).toBe('⌘=');

    // Disabled
    expect(getEditorFontSizeShortcutLabel('decrease', undefined, { editorDecreaseFontSize: true })).toBeUndefined();
    expect(fontSizeActionForChord(chord('-', { ctrlKey: true }), undefined, { editorDecreaseFontSize: true })).toBeNull();
  });
});
