import { describe, it, expect } from 'vitest';
import { slugifyHeading, getHeadingAt, markdownSectionFromSource } from '../../../../ui/src/dom/copyHandlers';

describe('dom/copyHandlers pure functions', () => {
  describe('slugifyHeading', () => {
    it('lowercases text', () => {
      expect(slugifyHeading('Hello')).toBe('hello');
    });

    it('replaces spaces with hyphens', () => {
      expect(slugifyHeading('hello world')).toBe('hello-world');
    });

    it('removes special characters', () => {
      expect(slugifyHeading('hello @world!')).toBe('hello-world');
    });

    it('deduplicates hyphens', () => {
      expect(slugifyHeading('a - b')).toBe('a-b');
    });
  });

  describe('getHeadingAt', () => {
    it('detects ATX h1', () => {
      const lines = ['# Title', 'text'];
      const heading = getHeadingAt(lines, 0);
      expect(heading).toEqual({ level: 1, text: 'Title', start: 0, end: 1 });
    });

    it('detects ATX h2', () => {
      const lines = ['## Sub-heading'];
      const heading = getHeadingAt(lines, 0);
      expect(heading).toEqual({ level: 2, text: 'Sub-heading', start: 0, end: 1 });
    });

    it('strips trailing # from heading', () => {
      const lines = ['# Title ##'];
      const heading = getHeadingAt(lines, 0);
      expect(heading?.text).toBe('Title');
    });

    it('detects setext h1 with = underline', () => {
      const lines = ['Title', '===', 'text'];
      const heading = getHeadingAt(lines, 0);
      expect(heading).toEqual({ level: 1, text: 'Title', start: 0, end: 2 });
    });

    it('detects setext h2 with - underline', () => {
      const lines = ['Subtitle', '---', 'text'];
      const heading = getHeadingAt(lines, 0);
      expect(heading).toEqual({ level: 2, text: 'Subtitle', start: 0, end: 2 });
    });

    it('does not match list item as setext h2', () => {
      const lines = ['- item', '---'];
      const heading = getHeadingAt(lines, 0);
      expect(heading).toBeNull();
    });

    it('returns null for non-heading line', () => {
      const lines = ['Just a paragraph'];
      const heading = getHeadingAt(lines, 0);
      expect(heading).toBeNull();
    });

    it('returns null for blank line before underline', () => {
      const lines = ['', '==='];
      const heading = getHeadingAt(lines, 0);
      expect(heading).toBeNull();
    });

    it('returns null when out of bounds for setext', () => {
      const lines = ['Title'];
      const heading = getHeadingAt(lines, 0);
      expect(heading).toBeNull();
    });
  });

  describe('markdownSectionFromSource', () => {
    it('extracts section from heading to next same-level heading', () => {
      const source = '# First\n\nContent A\n\n# Second\n\nContent B';
      const result = markdownSectionFromSource(source, 'first');
      expect(result).toContain('First');
      expect(result).toContain('Content A');
      expect(result).not.toContain('Second');
    });

    it('extracts section bounded by higher-level heading', () => {
      const source = '## Details\n\nSome detail\n\n# New Topic';
      const result = markdownSectionFromSource(source, 'details');
      expect(result).toContain('Some detail');
      expect(result).not.toContain('New Topic');
    });

    it('handles occurrence for duplicate heading IDs', () => {
      const source = '# Intro\n\nFirst intro\n\n# Intro\n\nSecond intro';
      const first = markdownSectionFromSource(source, 'intro', 0);
      const second = markdownSectionFromSource(source, 'intro', 1);
      expect(first).toContain('First intro');
      expect(second).toContain('Second intro');
    });

    it('returns empty string for null source', () => {
      expect(markdownSectionFromSource(null, 'some-id')).toBe('');
    });

    it('returns empty string for empty sectionId', () => {
      expect(markdownSectionFromSource('# Title\nContent', '')).toBe('');
    });

    it('returns empty string when heading not found', () => {
      expect(markdownSectionFromSource('# Title\nContent', 'nonexistent')).toBe('');
    });

    it('handles CRLF line endings', () => {
      const source = '# Title\r\n\r\nContent\r\n';
      const result = markdownSectionFromSource(source, 'title');
      expect(result).toContain('Content');
    });

    it('accepts DI getHeadingAt and slugifyHeading', () => {
      const source = '# Custom\nContent';
      const customSlugify = (text: string) => text.toLowerCase().replace(/\s+/g, '-');
      const result = markdownSectionFromSource(source, 'custom', 0, getHeadingAt, customSlugify);
      expect(result).toContain('Content');
    });

    it('extracts full document when heading is last', () => {
      const source = '# Final\n\nLast content';
      const result = markdownSectionFromSource(source, 'final');
      expect(result).toContain('Last content');
    });
  });
});
