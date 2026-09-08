import { describe, expect, it } from 'vitest';
import {
  initialState,
  reducer,
  type AppState,
} from '../../../../ui/src/contexts/appStateReducer';
import type { RenderContentMessage } from '../../../../ui/src/types';

function makeState(overrides: Partial<AppState> = {}): AppState {
  return {
    ...initialState,
    isLoading: false,
    settings: { ...initialState.settings, fileTabs: true },
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

describe('content tab editable working copies', () => {
  it('creates one shared session when writable markdown first renders', () => {
    const next = reducer(makeState(), { type: 'RENDER_CONTENT', msg: renderMessage() });
    expect(next.documentSessions['/docs/a.md']?.source).toBe('# A');
    expect(next.documentSessions['/docs/a.md']?.revision).toBe('10:3');
    expect(next.contentTabs[0]?.documentWrite?.supported).toBe(true);
  });

  it('creates an editable session before browser write permission has been granted', () => {
    const msg = {
      ...renderMessage('# A', null as any),
      documentWrite: { supported: false, revision: null, reason: 'permission-required' as const },
    };
    const next = reducer(makeState(), { type: 'RENDER_CONTENT', msg });
    expect(next.documentSessions['/docs/a.md']?.source).toBe('# A');
    expect(next.documentSessions['/docs/a.md']?.revision).toBeNull();
    expect(next.contentTabs[0]?.documentWrite?.reason).toBe('permission-required');
  });

  it('re-renders the active document from unsaved working source', () => {
    const loaded = reducer(makeState(), { type: 'RENDER_CONTENT', msg: renderMessage() });
    const next = reducer(loaded, {
      type: 'SET_WORKING_DOCUMENT_SOURCE',
      filePath: '/docs/a.md',
      source: '# B',
    } as any);
    expect(next.documentSessions['/docs/a.md']?.source).toBe('# B');
    expect(next.documentSessions['/docs/a.md']?.persistedSource).toBe('# A');
    expect(next.contentHtml).toContain('B');
    expect(next.contentTabs[0]?.markdownSource).toBe('# B');
  });

  it('changes only the requested document mode without losing unsaved source', () => {
    const loaded = reducer(makeState(), { type: 'RENDER_CONTENT', msg: renderMessage() });
    const edited = reducer(loaded, {
      type: 'SET_WORKING_DOCUMENT_SOURCE',
      filePath: '/docs/a.md',
      source: '# Mine',
    } as any);
    const next = reducer(edited, {
      type: 'SET_DOCUMENT_EDIT_MODE',
      filePath: '/docs/a.md',
      mode: 'plain',
    } as any);

    expect(next.documentSessions['/docs/a.md']?.mode).toBe('plain');
    expect(next.documentSessions['/docs/a.md']?.source).toBe('# Mine');
    expect(next.documentSessions['/docs/a.md']?.persistedSource).toBe('# A');
  });

  it('does not replace dirty working source when the host renders a newer disk version', () => {
    const loaded = reducer(makeState(), { type: 'RENDER_CONTENT', msg: renderMessage() });
    const edited = reducer(loaded, {
      type: 'SET_WORKING_DOCUMENT_SOURCE',
      filePath: '/docs/a.md',
      source: '# Mine',
    } as any);
    const next = reducer(edited, {
      type: 'RENDER_CONTENT',
      msg: renderMessage('# Disk', '20:6'),
    });
    expect(next.documentSessions['/docs/a.md']?.source).toBe('# Mine');
    expect(next.documentSessions['/docs/a.md']?.persistedSource).toBe('# A');
    expect(next.contentHtml).toContain('Mine');
  });

  it('discard restores persisted source and rendered output', () => {
    const loaded = reducer(makeState(), { type: 'RENDER_CONTENT', msg: renderMessage() });
    const edited = reducer(loaded, {
      type: 'SET_WORKING_DOCUMENT_SOURCE',
      filePath: '/docs/a.md',
      source: '# Mine',
    } as any);
    const next = reducer(edited, {
      type: 'DISCARD_DOCUMENT_CHANGES',
      filePath: '/docs/a.md',
    } as any);
    expect(next.documentSessions['/docs/a.md']?.source).toBe('# A');
    expect(next.contentHtml).toContain('A');
  });
});