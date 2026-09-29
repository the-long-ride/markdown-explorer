import { describe, expect, it } from 'vitest';
import {
  countWords,
  editorModKeyLabel,
  fillTemplate,
  formatCommandForChord,
  formatShortcutLabel,
  isApplePlatform,
  isInlineMarkdownEditorTarget,
  isMarkdownEditorTarget,
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

  it('maps only plain Mod+B/I/K/E chords to formatting commands', () => {
    expect(formatCommandForChord(chord('b', { ctrlKey: true }))).toBe('bold');
    expect(formatCommandForChord(chord('I', { metaKey: true }))).toBe('italic');
    expect(formatCommandForChord(chord('k', { ctrlKey: true }))).toBe('link');
    expect(formatCommandForChord(chord('e', { ctrlKey: true }))).toBe('inline-code');
    expect(formatCommandForChord(chord('b'))).toBeNull();
    expect(formatCommandForChord(chord('b', { ctrlKey: true, shiftKey: true }))).toBeNull();
    expect(formatCommandForChord(chord('b', { ctrlKey: true, altKey: true }))).toBeNull();
    expect(formatCommandForChord(chord('s', { ctrlKey: true }))).toBeNull();
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
});
