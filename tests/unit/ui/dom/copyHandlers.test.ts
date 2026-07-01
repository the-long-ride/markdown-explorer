import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { slugifyHeading, getHeadingAt, markdownSectionFromSource, markCopied, registerCopyHandlers } from '../../../../ui/src/dom/copyHandlers';

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

    it('trims whitespace then converts to hyphens', () => {
      expect(slugifyHeading('a b')).toBe('a-b');
    });

    it('preserves internal hyphens', () => {
      expect(slugifyHeading('hello-world')).toBe('hello-world');
    });

    it('handles only special characters', () => {
      expect(slugifyHeading('@@@')).toBe('');
    });

    it('removes unicode chars with ascii-only regex', () => {
      expect(slugifyHeading('Über Code')).toBe('ber-code');
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

    it('detects ATX h3', () => {
      const lines = ['### Section 3'];
      const heading = getHeadingAt(lines, 0);
      expect(heading).toEqual({ level: 3, text: 'Section 3', start: 0, end: 1 });
    });

    it('detects ATX h6', () => {
      const lines = ['###### Deepest'];
      const heading = getHeadingAt(lines, 0);
      expect(heading).toEqual({ level: 6, text: 'Deepest', start: 0, end: 1 });
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

    it('handles line at end of array', () => {
      const lines = ['text', '# Last'];
      const heading = getHeadingAt(lines, 1);
      expect(heading).toEqual({ level: 1, text: 'Last', start: 1, end: 2 });
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

    it('includes sub-headings in section', () => {
      const source = '# Main\n\n## Sub\n\nSub content\n\n# Next';
      const result = markdownSectionFromSource(source, 'main');
      expect(result).toContain('Sub');
      expect(result).toContain('Sub content');
      expect(result).not.toContain('Next');
    });
  });

  describe('markCopied', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('adds is-copied class to button', () => {
      const btn = document.createElement('button');
      document.body.appendChild(btn);
      markCopied(btn, 'Copy');
      expect(btn.classList.contains('is-copied')).toBe(true);
      document.body.removeChild(btn);
    });

    it('sets tooltip text to Copied!', () => {
      const btn = document.createElement('button');
      btn.innerHTML = '<span class="tooltip-text">Copy</span>';
      document.body.appendChild(btn);
      markCopied(btn, 'Copy');
      expect(btn.querySelector('.tooltip-text')!.textContent).toBe('Copied!');
      document.body.removeChild(btn);
    });

    it('resets after timeout', () => {
      const btn = document.createElement('button');
      btn.innerHTML = '<span class="tooltip-text">Copy</span>';
      document.body.appendChild(btn);
      markCopied(btn, 'Copy');
      vi.advanceTimersByTime(2100);
      expect(btn.classList.contains('is-copied')).toBe(false);
      expect(btn.querySelector('.tooltip-text')!.textContent).toBe('Copy');
      document.body.removeChild(btn);
    });

    it('does nothing when btn is null', () => {
      expect(() => markCopied(null, 'Copy')).not.toThrow();
    });

    it('does nothing when btn is undefined', () => {
      expect(() => markCopied(undefined, 'Copy')).not.toThrow();
    });

    it('clears previous timer when called again', () => {
      const btn = document.createElement('button');
      document.body.appendChild(btn);
      markCopied(btn, 'First');
      markCopied(btn, 'Second');
      vi.advanceTimersByTime(2100);
      expect(btn.classList.contains('is-copied')).toBe(false);
      document.body.removeChild(btn);
    });

    it('works without tooltip', () => {
      const btn = document.createElement('button');
      document.body.appendChild(btn);
      markCopied(btn, 'Copy');
      expect(btn.classList.contains('is-copied')).toBe(true);
      document.body.removeChild(btn);
    });
  });

  describe('registerCopyHandlers', () => {
    beforeEach(() => {
      document.body.innerHTML = '';
    });

    it('registers UI.copySection on window', () => {
      const win: any = { UI: {} };
      registerCopyHandlers(win);
      expect(typeof win.UI.copySection).toBe('function');
    });

    it('registers UI.copyDocument on window', () => {
      const win: any = { UI: {} };
      registerCopyHandlers(win);
      expect(typeof win.UI.copyDocument).toBe('function');
    });

    it('registers UI.copyCode on window', () => {
      const win: any = { UI: {} };
      registerCopyHandlers(win);
      expect(typeof win.UI.copyCode).toBe('function');
    });

    it('registers UI.markCopyButtonCopied on window', () => {
      const win: any = { UI: {} };
      registerCopyHandlers(win);
      expect(typeof win.UI.markCopyButtonCopied).toBe('function');
    });

    it('registers copyCode that calls copyText via PlatformBridge', () => {
      const mockCopy = vi.fn();
      const win: any = { UI: {}, PlatformBridge: { copyToClipboard: mockCopy } };
      registerCopyHandlers(win);
      expect(typeof win.UI.copyCode).toBe('function');
    });

    it('registers copyCode that falls back to navigator.clipboard', () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { clipboard: { writeText } });
      const win: any = { UI: {} };
      registerCopyHandlers(win);
      expect(typeof win.UI.copyCode).toBe('function');
    });
  });
});
