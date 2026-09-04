import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearBookmarkJumpMarks,
  scrollToBookmarkTarget,
  sourceRangeToRenderedOffsets,
} from '../../../../ui/src/utils/bookmarkJump.ts';
import type { BookmarkRecord, BookmarkResolution } from '../../../../ui/src/bookmarks/types.ts';

describe('bookmarkJump', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    clearBookmarkJumpMarks();
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  describe('sourceRangeToRenderedOffsets', () => {
    it('maps markdown source range to rendered text offsets accurately', () => {
      const source = '# Heading\n\nSome **bold** text here.';
      const boldOffset = source.indexOf('bold');
      const offsets = sourceRangeToRenderedOffsets(source, boldOffset, boldOffset + 4);
      expect(offsets.start).toBeGreaterThan(0);
      expect(offsets.end).toBeGreaterThanOrEqual(offsets.start);
    });

    it('handles negative or boundary-exceeding offsets gracefully', () => {
      const source = 'Simple text';
      const underflow = sourceRangeToRenderedOffsets(source, -10, -5);
      expect(underflow.start).toBe(0);
      expect(underflow.end).toBe(0);

      const overflow = sourceRangeToRenderedOffsets(source, 100, 200);
      expect(overflow.start).toBeGreaterThanOrEqual(0);
      expect(overflow.end).toBeGreaterThanOrEqual(overflow.start);
    });
  });

  describe('clearBookmarkJumpMarks', () => {
    it('clears active target classes and unrolls mark elements', () => {
      const root = document.createElement('div');
      root.id = 'mdBody';
      root.innerHTML = `
        <p class="mdn-bookmark-jump-target">Target paragraph</p>
        <p>Text before <mark class="mdn-bookmark-jump-mark">highlighted text</mark> text after</p>
      `;
      document.body.appendChild(root);

      clearBookmarkJumpMarks(root);

      expect(root.querySelector('.mdn-bookmark-jump-target')).toBeNull();
      expect(root.querySelector('mark.mdn-bookmark-jump-mark')).toBeNull();
      expect(root.textContent).toContain('Text before highlighted text text after');
    });

    it('handles null root or highlights deletion safely', () => {
      expect(() => clearBookmarkJumpMarks(null)).not.toThrow();

      // Test with CSS.highlights mock
      const deleteMock = vi.fn();
      const mockCss = { highlights: { delete: deleteMock } };
      const originalCss = (globalThis as any).CSS;
      (globalThis as any).CSS = mockCss;

      try {
        clearBookmarkJumpMarks(null);
        expect(deleteMock).toHaveBeenCalledWith('mdn-bookmark-jump');
      } finally {
        (globalThis as any).CSS = originalCss;
      }
    });
  });

  describe('scrollToBookmarkTarget', () => {
    const baseBookmark: BookmarkRecord = {
      id: 'bm-1',
      name: 'Sample Bookmark',
      workspaceKey: '/work/ws',
      workspaceName: 'Workspace',
      workspacePath: '/work/ws',
      filePath: '/work/ws/doc.md',
      targetKind: 'text',
      selectedText: 'Target content',
      matchOrdinal: 0,
      matchIndex: 12,
      prefix: 'Leading ',
      suffix: ' trailing',
      createdAt: 1000,
      updatedAt: 1000,
    };

    const resolved: BookmarkResolution = {
      status: 'resolved',
      sourceStart: 12,
      sourceEnd: 26,
      occurrence: 0,
      kind: 'text',
    };

    it('returns false if root is missing or resolution is not resolved', () => {
      expect(scrollToBookmarkTarget(baseBookmark, { status: 'unresolved' }, '', null)).toBe(false);
      expect(scrollToBookmarkTarget(baseBookmark, resolved, '', null)).toBe(false);

      const root = document.createElement('div');
      root.id = 'mdBody';
      document.body.appendChild(root);
      expect(scrollToBookmarkTarget(baseBookmark, { status: 'unresolved' }, '', root)).toBe(false);
    });

    it('scrolls to and highlights text bookmarks in DOM', () => {
      const root = document.createElement('div');
      root.id = 'mdBody';
      const source = 'Leading text Target content trailing text';

      const p = document.createElement('p');
      p.setAttribute('data-mdn-source-start', '0');
      p.setAttribute('data-mdn-source-end', String(source.length));
      p.textContent = source;
      root.appendChild(p);
      document.body.appendChild(root);

      const scrollIntoView = vi.fn();
      window.HTMLElement.prototype.scrollIntoView = scrollIntoView;

      const success = scrollToBookmarkTarget(baseBookmark, resolved, source, root);
      expect(success).toBe(true);
      expect(scrollIntoView).toHaveBeenCalled();

      const mark = root.querySelector('mark.mdn-bookmark-jump-mark');
      expect(mark).not.toBeNull();

      // Fast-forward clear timer
      vi.advanceTimersByTime(2500);
      expect(root.querySelector('mark.mdn-bookmark-jump-mark')).toBeNull();
    });

    it('falls back to element active class if range surroundContents throws', () => {
      const root = document.createElement('div');
      root.id = 'mdBody';
      const source = 'Leading text Target content trailing text';

      const container = document.createElement('div');
      container.setAttribute('data-mdn-source-start', '0');
      container.setAttribute('data-mdn-source-end', String(source.length));

      const span1 = document.createElement('span');
      span1.textContent = 'Leading text ';
      const span2 = document.createElement('span');
      span2.textContent = 'Target content trailing text';
      container.appendChild(span1);
      container.appendChild(span2);
      root.appendChild(container);
      document.body.appendChild(root);

      const scrollIntoView = vi.fn();
      window.HTMLElement.prototype.scrollIntoView = scrollIntoView;

      const HighlightMock = vi.fn();
      const setMock = vi.fn();
      (globalThis as any).Highlight = HighlightMock;
      (globalThis as any).CSS = { highlights: { set: setMock, delete: vi.fn() } };

      try {
        const success = scrollToBookmarkTarget(baseBookmark, resolved, source, root);
        expect(success).toBe(true);
        expect(container.classList.contains('mdn-bookmark-jump-target')).toBe(true);
      } finally {
        delete (globalThis as any).Highlight;
        delete (globalThis as any).CSS;
      }
    });

    it('returns false when text target element cannot be found or text nodes are missing', () => {
      const root = document.createElement('div');
      root.id = 'mdBody';
      document.body.appendChild(root);

      // No matching source range element
      expect(scrollToBookmarkTarget(baseBookmark, resolved, 'some text', root)).toBe(false);

      // Element with no text nodes
      const emptyEl = document.createElement('div');
      emptyEl.setAttribute('data-mdn-source-start', '0');
      emptyEl.setAttribute('data-mdn-source-end', '50');
      root.appendChild(emptyEl);
      expect(scrollToBookmarkTarget(baseBookmark, resolved, 'some text', root)).toBe(false);
    });

    it('scrolls to exact object target for non-text kinds', () => {
      const root = document.createElement('div');
      root.id = 'mdBody';
      const imgBookmark: BookmarkRecord = {
        ...baseBookmark,
        targetKind: 'image',
      };
      const imgResolved: BookmarkResolution = {
        status: 'resolved',
        sourceStart: 10,
        sourceEnd: 30,
        occurrence: 0,
        kind: 'image',
      };

      const img = document.createElement('img');
      img.setAttribute('data-mdn-bookmark-kind', 'image');
      img.setAttribute('data-mdn-source-start', '10');
      img.setAttribute('data-mdn-source-end', '30');
      root.appendChild(img);
      document.body.appendChild(root);

      const scrollIntoView = vi.fn();
      img.scrollIntoView = scrollIntoView;

      const success = scrollToBookmarkTarget(imgBookmark, imgResolved, '', root);
      expect(success).toBe(true);
      expect(img.classList.contains('mdn-bookmark-jump-target')).toBe(true);
      expect(scrollIntoView).toHaveBeenCalled();
    });

    it('falls back to candidate search in parent source element for non-text kinds', () => {
      const root = document.createElement('div');
      root.id = 'mdBody';
      const mermaidBookmark: BookmarkRecord = {
        ...baseBookmark,
        targetKind: 'mermaid',
      };
      const mermaidResolved: BookmarkResolution = {
        status: 'resolved',
        sourceStart: 10,
        sourceEnd: 50,
        occurrence: 1,
        kind: 'mermaid',
      };

      const section = document.createElement('div');
      section.setAttribute('data-mdn-source-start', '5');
      section.setAttribute('data-mdn-source-end', '60');

      const diagram0 = document.createElement('div');
      diagram0.setAttribute('data-mdn-bookmark-kind', 'mermaid');
      const diagram1 = document.createElement('div');
      diagram1.setAttribute('data-mdn-bookmark-kind', 'mermaid');

      section.appendChild(diagram0);
      section.appendChild(diagram1);
      root.appendChild(section);
      document.body.appendChild(root);

      const scrollIntoView = vi.fn();
      diagram1.scrollIntoView = scrollIntoView;

      const success = scrollToBookmarkTarget(mermaidBookmark, mermaidResolved, '', root);
      expect(success).toBe(true);
      expect(diagram1.classList.contains('mdn-bookmark-jump-target')).toBe(true);
      expect(scrollIntoView).toHaveBeenCalled();
    });

    it('returns false for non-text kinds if no matching candidate or source element found', () => {
      const root = document.createElement('div');
      root.id = 'mdBody';
      document.body.appendChild(root);

      const mathBookmark: BookmarkRecord = {
        ...baseBookmark,
        targetKind: 'math',
      };
      const mathResolved: BookmarkResolution = {
        status: 'resolved',
        sourceStart: 100,
        sourceEnd: 150,
        occurrence: 0,
        kind: 'math',
      };

      expect(scrollToBookmarkTarget(mathBookmark, mathResolved, '', root)).toBe(false);
    });
  });
});
