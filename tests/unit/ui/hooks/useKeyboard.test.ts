import { describe, it, expect } from 'vitest';
import { matchesShortcut, isEditableTarget } from '../../../../ui/src/hooks/useKeyboard';

function mockKeyboardEvent(opts: Partial<KeyboardEventInit> & { key: string }): KeyboardEvent {
  return new KeyboardEvent('keydown', opts);
}

describe('useKeyboard pure functions', () => {
  describe('matchesShortcut', () => {
    it('matches simple key', () => {
      const e = mockKeyboardEvent({ key: 'Escape' });
      expect(matchesShortcut(e, 'escape')).toBe(true);
    });

    it('matches with ctrl modifier', () => {
      const e = mockKeyboardEvent({ key: 'f', ctrlKey: true });
      expect(matchesShortcut(e, 'ctrl+f')).toBe(true);
    });

    it('does not match without required ctrl', () => {
      const e = mockKeyboardEvent({ key: 'f' });
      expect(matchesShortcut(e, 'ctrl+f')).toBe(false);
    });

    it('matches with cmd modifier (maps to meta)', () => {
      const e = mockKeyboardEvent({ key: 'f', metaKey: true });
      expect(matchesShortcut(e, 'cmd+f')).toBe(true);
    });

    it('matches ctrl as cmd', () => {
      const e = mockKeyboardEvent({ key: 'p', ctrlKey: true });
      expect(matchesShortcut(e, 'cmd+p')).toBe(true);
    });

    it('matches with shift modifier', () => {
      const e = mockKeyboardEvent({ key: 'f', ctrlKey: true, shiftKey: true });
      expect(matchesShortcut(e, 'ctrl+shift+f')).toBe(true);
    });

    it('does not match when extra modifier is present', () => {
      const e = mockKeyboardEvent({ key: 'f', ctrlKey: true, shiftKey: true });
      expect(matchesShortcut(e, 'ctrl+f')).toBe(false);
    });

    it('matches with alt modifier', () => {
      const e = mockKeyboardEvent({ key: 's', altKey: true });
      expect(matchesShortcut(e, 'alt+s')).toBe(true);
    });

    it('matches arrow left with <- alias', () => {
      const e = mockKeyboardEvent({ key: 'ArrowLeft', altKey: true });
      expect(matchesShortcut(e, 'alt+<-')).toBe(true);
    });

    it('matches arrow right with -> alias', () => {
      const e = mockKeyboardEvent({ key: 'ArrowRight', altKey: true });
      expect(matchesShortcut(e, 'alt+->')).toBe(true);
    });

    it('matches arrow left with left alias', () => {
      const e = mockKeyboardEvent({ key: 'ArrowLeft', altKey: true });
      expect(matchesShortcut(e, 'alt+left')).toBe(true);
    });

    it('matches arrow right with right alias', () => {
      const e = mockKeyboardEvent({ key: 'ArrowRight' });
      expect(matchesShortcut(e, 'right')).toBe(true);
    });

    it('returns false for empty shortcut', () => {
      const e = mockKeyboardEvent({ key: 'a' });
      expect(matchesShortcut(e, '')).toBe(false);
    });

    it('is case-insensitive', () => {
      const e = mockKeyboardEvent({ key: 'F', ctrlKey: true });
      expect(matchesShortcut(e, 'Ctrl+F')).toBe(true);
    });

    it('matches multi-modifier shortcut', () => {
      const e = mockKeyboardEvent({ key: 'k', ctrlKey: true, shiftKey: true, altKey: true });
      expect(matchesShortcut(e, 'ctrl+shift+alt+k')).toBe(true);
    });
  });

  describe('isEditableTarget', () => {
    it('returns false for null target', () => {
      expect(isEditableTarget(null)).toBe(false);
    });

    it('returns true for contentEditable element', () => {
      const el = document.createElement('div');
      el.setAttribute('contenteditable', 'true');
      Object.defineProperty(el, 'isContentEditable', { value: true });
      expect(isEditableTarget(el)).toBe(true);
    });

    it('returns true for input element', () => {
      const el = document.createElement('input');
      expect(isEditableTarget(el)).toBe(true);
    });

    it('returns true for textarea element', () => {
      const el = document.createElement('textarea');
      expect(isEditableTarget(el)).toBe(true);
    });

    it('returns true for select element', () => {
      const el = document.createElement('select');
      expect(isEditableTarget(el)).toBe(true);
    });

    it('returns false for div element', () => {
      const el = document.createElement('div');
      expect(isEditableTarget(el)).toBe(false);
    });

    it('returns false for button element', () => {
      const el = document.createElement('button');
      expect(isEditableTarget(el)).toBe(false);
    });
  });
});
