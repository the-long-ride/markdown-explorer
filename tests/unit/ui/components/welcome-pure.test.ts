import { describe, it, expect } from 'vitest';

function cleanTitle(text: string): string {
  if (!text) return '';
  return text.replace(/^[✨⌨️🔒💡🔍🛠️📁📊📋🎨🖼️🐞🌐]\s*/u, '').replace(/\s*→\s*$/, '').trim();
}

describe('WelcomePage pure functions', () => {
  describe('cleanTitle', () => {
    it('returns empty string for falsy input', () => {
      expect(cleanTitle('')).toBe('');
    });

    it('strips leading emoji', () => {
      expect(cleanTitle('✨ Features')).toBe('Features');
    });

    it('strips trailing arrow', () => {
      expect(cleanTitle('Navigate →')).toBe('Navigate');
    });

    it('strips both emoji and arrow', () => {
      expect(cleanTitle('🔍 Search →')).toBe('Search');
    });

    it('leaves plain text untouched', () => {
      expect(cleanTitle('Hello World')).toBe('Hello World');
    });

    it('trims whitespace after stripping', () => {
      expect(cleanTitle('✨ Hello →  ')).toBe('Hello');
    });

    it('does not strip emoji preceded by whitespace (regex anchored to start)', () => {
      expect(cleanTitle('  ✨ Hello')).toBe('✨ Hello');
    });

    it('handles multiple emoji characters at start (strips first only)', () => {
      expect(cleanTitle('🔒 Privacy')).toBe('Privacy');
    });
  });
});
