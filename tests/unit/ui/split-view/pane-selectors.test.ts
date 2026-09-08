import { describe, expect, it } from 'vitest';
import { initialState } from '../../../../ui/src/contexts/appStateModel';
import { createEditableDocumentSession, documentSessionKey } from '../../../../ui/src/editor/documentSession';
import { createSplitViewState } from '../../../../ui/src/split-view/paneState';
import { selectPaneDocument } from '../../../../ui/src/split-view/paneSelectors';

const tabA = {
  filePath: '/docs/a.md',
  relativePath: 'a.md',
  fileName: 'a.md',
  title: 'A',
  contentHtml: '<h1>A</h1>',
  markdownSource: '# A',
  sourceDocumentText: '# A',
  frontmatter: {},
  toc: [],
  previewInfo: null,
  documentWrite: { supported: true, revision: '1:3' },
} as const;

const tabB = {
  ...tabA,
  filePath: '/docs/b.md',
  relativePath: 'b.md',
  fileName: 'b.md',
  title: 'B',
  contentHtml: '<h1>B</h1>',
  markdownSource: '# B',
  sourceDocumentText: '# B',
} as const;

describe('pane document selectors', () => {
  it('projects each pane from the matching cached tab', () => {
    const state = {
      ...initialState,
      contentTabs: [tabA, tabB],
      splitView: {
        ...createSplitViewState(),
        enabled: true,
        primary: { ...createSplitViewState().primary, filePath: '/docs/a.md' },
        secondary: { ...createSplitViewState().secondary, filePath: '/docs/b.md', mode: 'plain' as const },
      },
    };

    expect(selectPaneDocument(state, 'primary')).toMatchObject({
      filePath: '/docs/a.md',
      relativePath: 'a.md',
      contentHtml: '<h1>A</h1>',
      source: '# A',
      mode: 'rendered',
    });
    expect(selectPaneDocument(state, 'secondary')).toMatchObject({
      filePath: '/docs/b.md',
      relativePath: 'b.md',
      contentHtml: '<h1>B</h1>',
      source: '# B',
      mode: 'plain',
    });
  });

  it('uses one shared editable session when both panes show the same file', () => {
    const session = createEditableDocumentSession('/docs/a.md', '# A', '1:3');
    const dirtySession = { ...session, source: '# edited' };
    const state = {
      ...initialState,
      contentTabs: [tabA],
      documentSessions: { [documentSessionKey('/docs/a.md')]: dirtySession },
      splitView: {
        ...createSplitViewState(),
        enabled: true,
        primary: { ...createSplitViewState().primary, filePath: '/docs/a.md' },
        secondary: { ...createSplitViewState().secondary, filePath: '/docs/a.md', mode: 'plain' as const },
      },
    };

    const primary = selectPaneDocument(state, 'primary');
    const secondary = selectPaneDocument(state, 'secondary');
    expect(primary?.source).toBe('# edited');
    expect(secondary?.source).toBe('# edited');
    expect(primary?.session).toBe(dirtySession);
    expect(secondary?.session).toBe(dirtySession);
  });
});
