import { describe, expect, it } from 'vitest';
import { reducer } from '../../../../ui/src/contexts/appStateReducer';
import { initialState } from '../../../../ui/src/contexts/appStateModel';
import { selectPaneDocument } from '../../../../ui/src/split-view/paneSelectors';

describe('main app reducer split routing', () => {
  it('routes split actions through the shared reducer', () => {
    const base = { ...initialState, currentFile: '/docs/a.md' };
    const opened = reducer(base, { type: 'OPEN_SPLIT_VIEW', filePath: '/docs/b.md' } as any);
    expect(opened.splitView.enabled).toBe(true);
    expect(opened.splitView.primary.filePath).toBe('/docs/a.md');
    expect(opened.splitView.secondary.filePath).toBe('/docs/b.md');

    const resized = reducer(opened, { type: 'SET_SPLIT_RATIO', ratio: 0.64 } as any);
    expect(resized.splitView.ratio).toBe(0.64);
  });

  it('keeps both pane documents rendered when file tabs are disabled', () => {
    const base = {
      ...initialState,
      settings: { ...initialState.settings, fileTabs: false },
      currentFile: '/docs/a.md',
      relativePath: 'a.md',
      contentHtml: '<p>A</p>',
      markdownSource: 'A',
    };
    const opened = reducer(base, { type: 'OPEN_SPLIT_VIEW', filePath: '/docs/b.md' } as any);
    const rendered = reducer(opened, {
      type: 'RENDER_CONTENT',
      msg: { command: 'renderContent', filePath: '/docs/b.md', relativePath: 'b.md', html: '<p>B</p>', markdownSource: 'B' },
    } as any);
    expect(selectPaneDocument(rendered, 'primary')?.contentHtml).toBe('<p>A</p>');
    expect(selectPaneDocument(rendered, 'secondary')?.contentHtml).toContain('B');

    const closed = reducer(rendered, { type: 'CLOSE_SPLIT_VIEW' } as any);
    expect(closed.contentTabs).toEqual([]);
  });

  it('keeps the other pane as the normal document view when a pane loses its last tab', () => {
    const tab = (filePath: string, html: string) => ({
      filePath, relativePath: filePath.slice(1), fileName: filePath.slice(1), title: filePath,
      contentHtml: html, markdownSource: html, sourceDocumentText: html, frontmatter: {}, toc: [], previewInfo: null,
    });
    const base = {
      ...initialState,
      settings: { ...initialState.settings, fileTabs: true },
      currentFile: '/c.md',
      contentTabs: [tab('/a.md', '<p>A</p>'), tab('/b.md', '<p>B</p>'), tab('/c.md', '<p>C</p>')],
      splitView: {
        ...initialState.splitView,
        enabled: true,
        activePane: 'secondary' as const,
        primary: { ...initialState.splitView.primary, tabs: ['/a.md', '/b.md'], activeTabPath: '/b.md', filePath: '/b.md' },
        secondary: { ...initialState.splitView.secondary, tabs: ['/c.md'], activeTabPath: '/c.md', filePath: '/c.md' },
      },
    };

    const closed = reducer(base as any, { type: 'CLOSE_SPLIT_PANE_TAB', paneId: 'secondary', filePath: '/c.md' } as any);

    expect(closed.splitView.enabled).toBe(false);
    expect(closed.splitView.primary.tabs).toEqual(['/a.md', '/b.md']);
    expect(closed.contentTabs.map((item) => item.filePath)).toEqual(['/a.md', '/b.md']);
    expect(closed.currentFile).toBe('/b.md');
    expect(closed.contentHtml).toBe('<p>B</p>');
    expect(closed.activeContentTabPath).toBe('/b.md');
  });
});
