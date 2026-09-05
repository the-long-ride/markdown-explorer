import { describe, expect, it } from 'vitest';
import {
  captureBookmarkSelection,
  createBookmarkRecord,
  createObjectBookmarkRecord,
  createTextBookmarkRecord,
  filterAndSortBookmarks,
  getBookmarkWorkspaceKey,
  getOccurrenceIndex,
  groupBookmarksByOpenWorkspace,
  normalizeBookmarkDocument,
  normalizeBookmarkRecord,
  resolveBookmarkTarget,
} from '../../../../ui/src/bookmarks/bookmarkModel';
import type { BookmarkRecord } from '../../../../ui/src/bookmarks/types';

describe('bookmarkModel', () => {
  describe('getBookmarkWorkspaceKey', () => {
    it('returns trimmed workspace path if present', () => {
      expect(getBookmarkWorkspaceKey('/path/to/project', 'My Project')).toBe('/path/to/project');
      expect(getBookmarkWorkspaceKey('   /trimmed   ', 'Name')).toBe('/trimmed');
    });

    it('falls back to workspace name when path is missing or empty', () => {
      expect(getBookmarkWorkspaceKey(undefined, 'Fallback Name')).toBe('Fallback Name');
      expect(getBookmarkWorkspaceKey('', '  Trimmed Name  ')).toBe('Trimmed Name');
    });
  });

  describe('captureBookmarkSelection', () => {
    it('returns null for empty or whitespace selection', () => {
      expect(captureBookmarkSelection('some text', '', 0)).toBeNull();
      expect(captureBookmarkSelection('some text', '   \n  ', 0)).toBeNull();
    });

    it('captures selection with prefix, suffix, and match details', () => {
      const doc = 'Intro prefix. Selected paragraph content. Suffix end.';
      const capture = captureBookmarkSelection(doc, 'Selected paragraph', 14);
      expect(capture).not.toBeNull();
      expect(capture?.selectedText).toBe('Selected paragraph');
      expect(capture?.matchOrdinal).toBe(0);
      expect(capture?.matchIndex).toBe(14);
      expect(capture?.prefix).toBe('Intro prefix. ');
      expect(capture?.suffix).toBe(' content. Suffix end.');
    });

    it('finds subsequent occurrence when requestedStart is between occurrences', () => {
      const doc = 'item target here. Other text. item target here again.';
      const capture = captureBookmarkSelection(doc, 'item target', 10);
      expect(capture).not.toBeNull();
      expect(capture?.matchOrdinal).toBe(1);
      expect(capture?.matchIndex).toBe(30);
    });

    it('returns null if selection is not found in document', () => {
      expect(captureBookmarkSelection('Hello world', 'nonexistent', 0)).toBeNull();
    });
  });

  describe('create and resolve bookmark records', () => {
    it('creates text bookmark record with valid source anchor', () => {
      const record = createTextBookmarkRecord({
        name: 'My Bookmark',
        workspaceName: 'Work',
        workspacePath: '/work',
        filePath: 'guide.md',
        source: '# Heading\n\nParagraph text to bookmark.\n',
        sourceStart: 11,
        sourceEnd: 38,
        renderedText: 'Paragraph text to bookmark.',
        now: 1000,
      });
      expect(record).not.toBeNull();
      expect(record?.id).toBeDefined();
      expect(record?.name).toBe('My Bookmark');
      expect(record?.targetKind).toBe('text');
      expect(record?.sourceAnchor.fragment).toBe('Paragraph text to bookmark.');
      expect(record?.createdAt).toBe(1000);
      expect(record?.updatedAt).toBe(1000);
    });

    it('returns null if required fields or sourceAnchor are invalid', () => {
      expect(createTextBookmarkRecord({
        name: '',
        workspaceName: 'Work',
        filePath: 'doc.md',
        source: 'text',
        sourceStart: 0,
        sourceEnd: 4,
        renderedText: 'text',
      })).toBeNull();

      expect(createTextBookmarkRecord({
        name: 'Test',
        workspaceName: 'Work',
        filePath: 'doc.md',
        source: 'text',
        sourceStart: 10,
        sourceEnd: 5,
        renderedText: 'text',
      })).toBeNull();
    });

    it('creates object bookmark record with objectIdentity', () => {
      const record = createObjectBookmarkRecord({
        name: 'Math Formula',
        workspaceName: 'Work',
        filePath: 'math.md',
        source: 'Let $$E = mc^2$$ be energy.',
        sourceStart: 4,
        sourceEnd: 16,
        renderedText: 'E = mc^2',
        targetKind: 'math',
        objectIdentity: { mathSource: 'E = mc^2' },
      });
      expect(record).not.toBeNull();
      expect(record?.targetKind).toBe('math');
      expect(record?.objectIdentity?.mathSource).toBe('E = mc^2');
    });

    it('createBookmarkRecord legacy creator wraps selection and start', () => {
      const record = createBookmarkRecord({
        id: 'bm-1',
        name: 'Legacy Bookmark',
        workspaceName: 'Workspace',
        workspacePath: '/work',
        filePath: 'readme.md',
        documentText: 'First section.\nSecond section.\n',
        selectedText: 'Second section.',
        selectedStart: 15,
        now: 5000,
      });
      expect(record).not.toBeNull();
      expect(record?.id).toBe('bm-1');
      expect(record?.name).toBe('Legacy Bookmark');
      expect(record?.matchIndex).toBe(15);
    });

    it('resolves exact match when document content has not changed', () => {
      const source = 'Heading.\nTarget content to find.\nFooter.';
      const record = createTextBookmarkRecord({
        name: 'Test',
        workspaceName: 'W',
        filePath: 'test.md',
        source,
        sourceStart: 9,
        sourceEnd: 32,
        renderedText: 'Target content to find.',
      })!;

      const res = resolveBookmarkTarget(record, source);
      expect(res.status).toBe('resolved');
      expect(res.sourceStart).toBe(9);
      expect(res.sourceEnd).toBe(32);
    });

    it('resolves single occurrence when content moved in document', () => {
      const initial = 'Prefix context.\nTarget content to find.\nSuffix context.';
      const record = createTextBookmarkRecord({
        name: 'Test',
        workspaceName: 'W',
        filePath: 'test.md',
        source: initial,
        sourceStart: 16,
        sourceEnd: 39,
        renderedText: 'Target content to find.',
      })!;

      const moved = 'New lines added.\nPrefix context.\nTarget content to find.\nSuffix context.';
      const res = resolveBookmarkTarget(record, moved);
      expect(res.status).toBe('resolved');
      expect(res.sourceStart).toBe(33);
    });

    it('returns targetChanged when target is completely removed', () => {
      const source = 'Some document text.';
      const record = createTextBookmarkRecord({
        name: 'Test',
        workspaceName: 'W',
        filePath: 'test.md',
        source: 'Target to remove',
        sourceStart: 0,
        sourceEnd: 16,
        renderedText: 'Target to remove',
      })!;

      const res = resolveBookmarkTarget(record, source);
      expect(res.status).toBe('targetChanged');
    });

    it('disambiguates multiple occurrences using surrounding context score', () => {
      const initial = 'Unique header.\nRepeated target.\nUnique footer.';
      const record = createTextBookmarkRecord({
        name: 'Test',
        workspaceName: 'W',
        filePath: 'test.md',
        source: initial,
        sourceStart: 15,
        sourceEnd: 31,
        renderedText: 'Repeated target.',
      })!;

      const multiple = 'Unrelated section.\nRepeated target.\nDifferent footer.\n\nUnique header.\nRepeated target.\nUnique footer.';
      const res = resolveBookmarkTarget(record, multiple);
      expect(res.status).toBe('resolved');
      expect(res.sourceStart).toBe(70);
    });
  });

  describe('filterAndSortBookmarks', () => {
    const b1: BookmarkRecord = {
      id: '1',
      name: 'Beta feature',
      workspaceKey: '/work',
      workspaceName: 'Work',
      filePath: 'b.md',
      targetKind: 'text',
      sourceAnchor: { start: 0, end: 4, fragment: 'text', fingerprint: 'f', occurrence: 0, prefix: '', suffix: '' },
      renderedText: 'alpha keyword',
      selectedText: 'alpha keyword',
      matchOrdinal: 0,
      matchIndex: 0,
      prefix: '',
      suffix: '',
      createdAt: 100,
      updatedAt: 100,
    };
    const b2: BookmarkRecord = {
      id: '2',
      name: 'Alpha feature',
      workspaceKey: '/work',
      workspaceName: 'Work',
      filePath: 'a.md',
      targetKind: 'text',
      sourceAnchor: { start: 0, end: 4, fragment: 'text', fingerprint: 'f', occurrence: 0, prefix: '', suffix: '' },
      renderedText: 'gamma keyword',
      selectedText: 'gamma keyword',
      matchOrdinal: 0,
      matchIndex: 0,
      prefix: '',
      suffix: '',
      createdAt: 200,
      updatedAt: 200,
    };

    it('filters by name or text', () => {
      expect(filterAndSortBookmarks([b1, b2], 'Beta', 'name-asc')).toEqual([b1]);
      expect(filterAndSortBookmarks([b1, b2], 'gamma', 'name-asc')).toEqual([b2]);
      expect(filterAndSortBookmarks([b1, b2], 'nonexistent', 'name-asc')).toEqual([]);
    });

    it('sorts by name ascending and descending', () => {
      expect(filterAndSortBookmarks([b1, b2], '', 'name-asc').map(b => b.name)).toEqual(['Alpha feature', 'Beta feature']);
      expect(filterAndSortBookmarks([b1, b2], '', 'name-desc').map(b => b.name)).toEqual(['Beta feature', 'Alpha feature']);
    });

    it('sorts by created time ascending and descending', () => {
      expect(filterAndSortBookmarks([b1, b2], '', 'created-asc').map(b => b.id)).toEqual(['1', '2']);
      expect(filterAndSortBookmarks([b1, b2], '', 'created-desc').map(b => b.id)).toEqual(['2', '1']);
    });
  });

  describe('groupBookmarksByOpenWorkspace', () => {
    it('groups bookmarks and marks active workspace', () => {
      const items: BookmarkRecord[] = [
        {
          id: 'b1', name: 'B1', workspaceKey: '/w1', workspaceName: 'W1', filePath: 'a.md', targetKind: 'text',
          sourceAnchor: { start: 0, end: 1, fragment: 'a', fingerprint: 'f', occurrence: 0, prefix: '', suffix: '' },
          renderedText: 'a', selectedText: 'a', matchOrdinal: 0, matchIndex: 0, prefix: '', suffix: '', createdAt: 1, updatedAt: 1,
        },
      ];
      const workspaces = [
        { id: 'tab1', workspaceKey: '/w1', workspaceName: 'W1' },
        { id: 'tab2', workspaceKey: '/w2', workspaceName: 'W2' },
      ];
      const groups = groupBookmarksByOpenWorkspace(items, workspaces, '/w1');
      expect(groups).toHaveLength(2);
      expect(groups[0].active).toBe(true);
      expect(groups[0].bookmarks).toHaveLength(1);
      expect(groups[1].active).toBe(false);
      expect(groups[1].bookmarks).toHaveLength(0);
    });
  });

  describe('normalizeBookmarkRecord and normalizeBookmarkDocument', () => {
    it('normalizes valid raw bookmark document', () => {
      const doc = {
        version: 2,
        items: [
          {
            id: 'valid-1',
            name: 'Item 1',
            workspaceKey: '/w',
            workspaceName: 'W',
            filePath: 'doc.md',
            renderedText: 'Hello',
            createdAt: 100,
            updatedAt: 100,
            sourceAnchor: {
              start: 0, end: 5, fragment: 'Hello', fingerprint: 'f', occurrence: 0, prefix: '', suffix: '',
            },
          },
          {
            id: 'valid-1', // Duplicate ID
            name: 'Item 1 duplicate',
            workspaceKey: '/w',
            workspaceName: 'W',
            filePath: 'doc.md',
            renderedText: 'Hello',
            createdAt: 100,
            updatedAt: 100,
          },
        ],
      };
      const normalized = normalizeBookmarkDocument(doc);
      expect(normalized.version).toBe(2);
      expect(normalized.items).toHaveLength(1);
      expect(normalized.items[0].id).toBe('valid-1');
    });

    it('returns empty document for invalid document inputs', () => {
      expect(normalizeBookmarkDocument(null)).toEqual({ version: 2, items: [] });
      expect(normalizeBookmarkDocument({ version: 999 })).toEqual({ version: 2, items: [] });
      expect(normalizeBookmarkDocument({ version: 2, items: 'not an array' })).toEqual({ version: 2, items: [] });
    });

    it('normalizes targetKind and objectIdentity', () => {
      const raw = {
        id: 'b-math',
        name: 'Math',
        workspaceKey: '/w',
        workspaceName: 'W',
        filePath: 'f.md',
        renderedText: 'x^2',
        createdAt: 10,
        updatedAt: 10,
        targetKind: 'math',
        objectIdentity: { mathSource: 'x^2', url: '', invalid: 123 },
        sourceAnchor: { start: 0, end: 3, fragment: 'x^2', fingerprint: 'f', occurrence: 0, prefix: '', suffix: '' },
      };
      const record = normalizeBookmarkRecord(raw);
      expect(record?.targetKind).toBe('math');
      expect(record?.objectIdentity?.mathSource).toBe('x^2');
      expect(record?.objectIdentity?.url).toBeUndefined();
    });
  });

  describe('getOccurrenceIndex', () => {
    it('returns start index for ordinal occurrence or -1 when out of range', () => {
      const text = 'foo bar foo baz foo';
      expect(getOccurrenceIndex(text, 'foo', 0)).toBe(0);
      expect(getOccurrenceIndex(text, 'foo', 1)).toBe(8);
      expect(getOccurrenceIndex(text, 'foo', 2)).toBe(16);
      expect(getOccurrenceIndex(text, 'foo', 3)).toBe(-1);
      expect(getOccurrenceIndex(text, 'missing', 0)).toBe(-1);
    });
  });
});
