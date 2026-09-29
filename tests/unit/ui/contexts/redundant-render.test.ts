import { describe, expect, it } from 'vitest';
import { initialState, type AppState } from '../../../../ui/src/contexts/appStateModel';
import { reducer } from '../../../../ui/src/contexts/appStateReducer';
import { documentSessionKey } from '../../../../ui/src/editor/documentSession';
import type { MdFile, RenderContentMessage } from '../../../../ui/src/types';

const fileA: MdFile = { fsPath: '/docs/a.md', relativePath: 'a.md', parts: ['a.md'], fileName: 'a.md', title: 'A', modifiedAt: 1 };
const fileB: MdFile = { fsPath: '/docs/b.md', relativePath: 'b.md', parts: ['b.md'], fileName: 'b.md', title: 'B', modifiedAt: 1 };

function message(overrides: Partial<RenderContentMessage> = {}): RenderContentMessage {
  return {
    command: 'renderContent',
    html: '<p>a</p>',
    markdownSource: '# A\n\nalpha',
    frontmatter: {},
    toc: [],
    filePath: '/docs/a.md',
    relativePath: 'a.md',
    title: 'A',
    fileList: [{ ...fileA }, { ...fileB }],
    previewInfo: null,
    ...overrides,
  };
}

function render(state: AppState, msg: RenderContentMessage, htmlPreviewOverride?: boolean): AppState {
  return reducer(state, { type: 'RENDER_CONTENT', msg, htmlPreviewOverride });
}

function rendered(settings: Partial<AppState['settings']> = { fileTabs: true }, msg = message()): AppState {
  const base: AppState = { ...initialState, settings: { ...initialState.settings, ...settings } };
  return render(base, msg);
}

describe('redundant RENDER_CONTENT', () => {
  it('returns the same state when the cached current tab is re-sent unchanged', () => {
    const state = rendered();
    expect(state.contentTabs).toHaveLength(1);
    const next = render(state, message());
    expect(next).toBe(state);
  });

  it('returns the same state for an unchanged host-html render (no markdown source)', () => {
    const msg = message({ markdownSource: null, html: '<p>doc</p>', toc: [{ level: 1, text: 'Doc', id: 'doc' }] as never });
    const state = rendered({ fileTabs: true }, msg);
    expect(render(state, message({ markdownSource: null, html: '<p>doc</p>', toc: [{ level: 1, text: 'Doc', id: 'doc' }] as never }))).toBe(state);
  });

  it('still applies a render whose markdown source changed', () => {
    const state = rendered();
    const next = render(state, message({ markdownSource: '# A\n\nbeta' }));
    expect(next).not.toBe(state);
    expect(next.renderVersion).toBe(state.renderVersion + 1);
    expect(next.contentHtml).toContain('beta');
  });

  it('still applies a host-html render whose html changed', () => {
    const state = rendered({ fileTabs: true }, message({ markdownSource: null, html: '<p>a</p>' }));
    const next = render(state, message({ markdownSource: null, html: '<p>b</p>' }));
    expect(next).not.toBe(state);
    expect(next.renderVersion).toBe(state.renderVersion + 1);
  });

  it('still applies a host-html render whose toc changed with identical html', () => {
    const state = rendered({ fileTabs: true }, message({ markdownSource: null }));
    const next = render(state, message({ markdownSource: null, toc: [{ level: 1, text: 'X', id: 'x' }] as never }));
    expect(next).not.toBe(state);
  });

  it('still applies a render when the file list changed', () => {
    const state = rendered();
    const fileC: MdFile = { fsPath: '/docs/c.md', relativePath: 'c.md', parts: ['c.md'], fileName: 'c.md', title: 'C' };
    expect(render(state, message({ fileList: [fileA, fileB, fileC] }))).not.toBe(state);
    expect(render(state, message({ fileList: [fileA, { ...fileB, title: 'B2' }] }))).not.toBe(state);
    expect(render(state, message({ fileList: [fileA, { ...fileB, modifiedAt: 2 }] }))).not.toBe(state);
  });

  it('still applies a render that clears a stale / loading / not-found flag', () => {
    const state = rendered();
    for (const flagged of [
      { ...state, staleContentFilePath: '/docs/a.md' },
      { ...state, isLoading: true },
      { ...state, notFoundHref: 'missing.md' },
      { ...state, workspaceUnavailablePath: '/docs' },
    ]) {
      const next = render(flagged, message());
      expect(next).not.toBe(flagged);
      expect(next.renderVersion).toBe(flagged.renderVersion + 1);
    }
  });

  it('applies a manual refresh (SET_LOADING then an identical render)', () => {
    const state = rendered();
    const loading = reducer(state, { type: 'SET_LOADING' });
    const next = render(loading, message());
    expect(next.isLoading).toBe(false);
    expect(next.renderVersion).toBe(state.renderVersion + 1);
  });

  it('applies a render carrying a new html preview override or metadata', () => {
    const state = rendered();
    expect(render(state, message(), true)).not.toBe(state);
    expect(render(state, message({ title: 'Renamed' }))).not.toBe(state);
    expect(render(state, message({ relativePath: 'docs/a.md' }))).not.toBe(state);
    expect(render(state, message({ previewInfo: { kind: 'text', sourceExtension: '.md' } as never }))).not.toBe(state);
    expect(render(state, message({ documentWrite: { supported: false, revision: null, reason: 'read-only-runtime' } }))).not.toBe(state);
  });

  it('applies a render for a different file', () => {
    const state = rendered();
    const next = render(state, message({ filePath: '/docs/b.md', relativePath: 'b.md', title: 'B' }));
    expect(next).not.toBe(state);
    expect(next.currentFile).toBe('/docs/b.md');
  });

  it('keeps state for an editable document whose clean session would be recreated identically', () => {
    const writable = { supported: true, revision: { mtimeMs: 1, size: 10 } as never };
    const state = rendered({ fileTabs: true }, message({ documentWrite: writable }));
    expect(state.documentSessions[documentSessionKey('/docs/a.md')]).toBeDefined();
    expect(render(state, message({ documentWrite: { ...writable } }))).toBe(state);
  });

  it('keeps state for an unchanged render of a clean document in an edit mode', () => {
    const writable = { supported: true, revision: null };
    const state = rendered({ fileTabs: true, markdownEditingEnabled: true }, message({ documentWrite: writable }));
    const key = documentSessionKey('/docs/a.md');
    const inPlain: AppState = {
      ...state,
      documentSessions: { ...state.documentSessions, [key]: { ...state.documentSessions[key], mode: 'plain' } },
    };
    expect(render(inPlain, message({ documentWrite: writable }))).toBe(inPlain);
  });

  it('applies changed disk content to a clean session without leaving its edit mode', () => {
    const writable = { supported: true, revision: null };
    const state = rendered({ fileTabs: true, markdownEditingEnabled: true }, message({ documentWrite: writable }));
    const key = documentSessionKey('/docs/a.md');
    const inPlain: AppState = {
      ...state,
      documentSessions: { ...state.documentSessions, [key]: { ...state.documentSessions[key], mode: 'plain' } },
    };
    const next = render(inPlain, message({ markdownSource: 'changed on disk', documentWrite: writable }));
    expect(next).not.toBe(inPlain);
    expect(next.documentSessions[key].mode).toBe('plain');
    expect(next.documentSessions[key].source).toBe('changed on disk');
  });

  it('keeps state for an unchanged render with file tabs off and split view open', () => {
    const opened = reducer(rendered({ fileTabs: false }), { type: 'OPEN_SPLIT_VIEW', filePath: '/docs/b.md' });
    const withB = render(opened, message({ filePath: '/docs/b.md', relativePath: 'b.md', title: 'B', markdownSource: 'b' }));
    expect(withB.contentTabs.map((tab) => tab.filePath)).toContain('/docs/b.md');
    expect(render(withB, message({ filePath: '/docs/b.md', relativePath: 'b.md', title: 'B', markdownSource: 'b' }))).toBe(withB);
  });

  it('keeps state for an unchanged render with file tabs off and no split view', () => {
    const state = rendered({ fileTabs: false });
    expect(state.contentTabs).toEqual([]);
    expect(render(state, message())).toBe(state);
  });
});
