import { describe, expect, it } from 'vitest';
import { initialState, reducer, type AppState } from '../../../../ui/src/contexts/appStateReducer';
import type { RenderContentMessage } from '../../../../ui/src/types';

function makeState(overrides: Partial<AppState> = {}): AppState {
  return {
    ...initialState,
    isLoading: false,
    settings: { ...initialState.settings, fileTabs: true, markdownEditingEnabled: true },
    ...overrides,
  };
}

function renderMessage(source = '# A', revision = '10:3'): RenderContentMessage {
  return {
    command: 'renderContent',
    html: '<h1>A</h1>',
    markdownSource: source,
    frontmatter: {},
    toc: [],
    filePath: '/docs/a.md',
    relativePath: 'a.md',
    title: 'A',
    fileList: [],
    previewInfo: null,
    documentWrite: { supported: true, revision },
  };
}

describe('re-rendering a clean editable document', () => {
  it.each(['inline-edit', 'plain'] as const)('keeps the %s edit mode on refresh / tab switch', (mode) => {
    const loaded = reducer(makeState(), { type: 'RENDER_CONTENT', msg: renderMessage() });
    const editing = reducer(loaded, { type: 'SET_DOCUMENT_EDIT_MODE', filePath: '/docs/a.md', mode });
    expect(editing.documentSessions['/docs/a.md']?.mode).toBe(mode);

    const refreshed = reducer(editing, { type: 'RENDER_CONTENT', msg: renderMessage('# A from disk\r\n', '20:15') });
    const session = refreshed.documentSessions['/docs/a.md'];
    expect(session?.mode).toBe(mode);
    expect(session).toMatchObject({
      source: '# A from disk\n',
      persistedSource: '# A from disk\n',
      revision: '20:15',
      lineEnding: '\r\n',
      saveState: 'idle',
      pendingSaveSource: null,
      conflict: null,
    });
  });

  it('keeps unresolved conflict-free state but drops a stale conflict/saving marker on refresh', () => {
    const loaded = reducer(makeState(), { type: 'RENDER_CONTENT', msg: renderMessage() });
    const refreshed = reducer(loaded, { type: 'RENDER_CONTENT', msg: renderMessage('# New', '30:5') });
    expect(refreshed.documentSessions['/docs/a.md']).toMatchObject({ mode: 'rendered', source: '# New', revision: '30:5' });
  });

  it('starts new documents in rendered mode', () => {
    const loaded = reducer(makeState(), { type: 'RENDER_CONTENT', msg: renderMessage() });
    expect(loaded.documentSessions['/docs/a.md']?.mode).toBe('rendered');
  });
});
