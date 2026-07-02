import { describe, it, expect } from 'vitest';
import {
  slugifyHeading,
  getHeadingAt,
  markdownSectionFromSource,
  cleanClonedText,
  computeSectionOccurrence,
} from '../../../../ui/src/dom/copyHandlers';

describe('copyHandlers pure utilities', () => {
  describe('slugifyHeading', () => {
    it('lowercases text', () => {
      expect(slugifyHeading('Hello World')).toBe('hello-world');
    });

    it('replaces spaces with hyphens', () => {
      expect(slugifyHeading('Some Title Here')).toBe('some-title-here');
    });

    it('removes special characters', () => {
      expect(slugifyHeading('Foo & Bar!')).toBe('foo-bar');
    });

    it('collapses multiple hyphens', () => {
      expect(slugifyHeading('a -- b')).toBe('a-b');
    });

    it('trims whitespace but hyphens remain', () => {
      expect(slugifyHeading('  hello  ')).toBe('-hello-');
    });
  });

  describe('getHeadingAt', () => {
    it('detects ATX heading', () => {
      const lines = ['## Hello World'];
      const result = getHeadingAt(lines, 0);
      expect(result).toEqual({ level: 2, text: 'Hello World', start: 0, end: 1 });
    });

    it('detects level 1 setext heading', () => {
      const lines = ['Hello', '==='];
      const result = getHeadingAt(lines, 0);
      expect(result).toEqual({ level: 1, text: 'Hello', start: 0, end: 2 });
    });

    it('detects level 2 setext heading', () => {
      const lines = ['Hello', '---'];
      const result = getHeadingAt(lines, 0);
      expect(result).toEqual({ level: 2, text: 'Hello', start: 0, end: 2 });
    });

    it('returns null for non-heading', () => {
      expect(getHeadingAt(['just text'], 0)).toBeNull();
    });

    it('returns null when line is empty', () => {
      expect(getHeadingAt(['', '---'], 0)).toBeNull();
    });

    it('does not confuse list with setext', () => {
      const lines = ['- item', '---'];
      expect(getHeadingAt(lines, 0)).toBeNull();
    });
  });

  describe('markdownSectionFromSource', () => {
    it('returns empty for empty source', () => {
      expect(markdownSectionFromSource('', 'hello')).toBe('');
      expect(markdownSectionFromSource(null, 'hello')).toBe('');
    });

    it('returns empty for missing section', () => {
      const source = '# Foo\nFoo content\n# Bar\nBar content';
      expect(markdownSectionFromSource(source, 'baz')).toBe('');
    });

    it('extracts section by heading', () => {
      const source = '# Foo\nFoo content\n# Bar\nBar content\n# Baz\nBaz content';
      expect(markdownSectionFromSource(source, 'bar')).toBe('# Bar\nBar content');
    });

    it('extracts section with trailing content', () => {
      const source = '# Intro\nIntro text\n# Main\nMain text\nMore main\n# Outro\nOutro text';
      expect(markdownSectionFromSource(source, 'main')).toBe('# Main\nMain text\nMore main');
    });

    it('supports occurrence parameter', () => {
      const source = '# Dupe\nFirst dupe\n# Dupe\nSecond\n# Other\nOther text';
      expect(markdownSectionFromSource(source, 'dupe', 0)).toBe('# Dupe\nFirst dupe');
      expect(markdownSectionFromSource(source, 'dupe', 1)).toBe('# Dupe\nSecond');
    });

    it('handles crlf line endings', () => {
      const source = '# Foo\r\nFoo content\r\n# Bar\r\nBar content';
      expect(markdownSectionFromSource(source, 'bar')).toBe('# Bar\nBar content');
    });
  });

  describe('cleanClonedText', () => {
    it('removes excessive blank lines', () => {
      expect(cleanClonedText('a\n\n\n\nb')).toBe('a\n\nb');
    });

    it('trims whitespace', () => {
      expect(cleanClonedText('  hello  ')).toBe('hello');
    });

    it('preserves normal line breaks', () => {
      expect(cleanClonedText('a\n\nb')).toBe('a\n\nb');
    });
  });

  describe('computeSectionOccurrence', () => {
    it('returns 0-based index', () => {
      const sections = [{}, {}, {}] as Element[];
      expect(computeSectionOccurrence(sections, sections[0])).toBe(0);
      expect(computeSectionOccurrence(sections, sections[2])).toBe(2);
    });

    it('returns 0 for first occurrence', () => {
      expect(computeSectionOccurrence([{}] as Element[], {} as Element)).toBe(0);
    });
  });
});
