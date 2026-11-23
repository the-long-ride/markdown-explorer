import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useBookmarkNavigation } from '../../../../ui/src/hooks/useBookmarkNavigation';
import { createTextBookmarkRecord } from '../../../../ui/src/bookmarks/bookmarkModel';

const source = '# Title\n\nHello bookmark world.\n';
const bookmark = createTextBookmarkRecord({
  name: 'b', workspaceName: 'W', workspacePath: '/w', filePath: '/w/a.md', source,
  sourceStart: source.indexOf('bookmark'), sourceEnd: source.indexOf('bookmark') + 8, renderedText: 'bookmark',
} as any)!;
const t = { workspaceUnavailable: 'ws', fileUnavailable: 'file', targetUnavailable: 'target' } as any;
const files = [{ fsPath: '/w/a.md' }];

function setup(overrides: Record<string, unknown> = {}) {
  const notices: string[] = [];
  const listener = (e: Event) => notices.push((e as CustomEvent).detail);
  window.addEventListener('markdown-explorer-action-notice', listener);
  const args = {
    state: { workspacePath: '/w', workspaceName: 'W', fileList: files, currentFile: '/w/a.md', markdownSource: source, sourceDocumentText: undefined },
    tabs: [],
    isTabView: false,
    translations: t,
    activateTab: vi.fn(),
    navigate: vi.fn(),
    queueBookmarkJump: vi.fn(),
    ...overrides,
  } as any;
  const { result } = renderHook(() => useBookmarkNavigation(args));
  return { result, args, notices, done: () => window.removeEventListener('markdown-explorer-action-notice', listener) };
}

afterEach(() => vi.restoreAllMocks());

describe('useBookmarkNavigation', () => {
  it('lists focus workspaces and navigates in focus mode', () => {
    const { result, args, notices, done } = setup();
    expect(result.current.bookmarkWorkspaces).toEqual([{ id: 'focus', workspaceKey: '/w', workspaceName: 'W', workspacePath: '/w' }]);
    result.current.handleBookmarkNavigate(bookmark);
    expect(args.queueBookmarkJump).toHaveBeenCalledWith('/w/a.md', bookmark, 'target');
    expect(args.navigate).toHaveBeenCalledWith('/w/a.md');
    expect(notices).toEqual([]);
    done();
  });

  it('reports unavailable workspaces, files and changed targets', () => {
    const empty = setup({ state: { workspacePath: '', workspaceName: '', fileList: [], currentFile: null } });
    expect(empty.result.current.bookmarkWorkspaces).toEqual([]);
    empty.result.current.handleBookmarkNavigate(bookmark);
    expect(empty.notices).toEqual(['ws']);
    empty.done();
    const noFile = setup({ state: { workspacePath: '/w', workspaceName: 'W', fileList: [], currentFile: null } });
    noFile.result.current.handleBookmarkNavigate(bookmark);
    expect(noFile.notices).toEqual(['file']);
    noFile.done();
    const changed = setup({ state: { workspacePath: '/w', workspaceName: 'W', fileList: files, currentFile: '/w/a.md', markdownSource: 'totally different' } });
    changed.result.current.handleBookmarkNavigate(bookmark);
    expect(changed.notices).toEqual(['target']);
    expect(changed.args.navigate).not.toHaveBeenCalled();
    changed.done();
    const other = setup({ state: { workspacePath: '/w', workspaceName: 'W', fileList: files, currentFile: '/w/other.md', sourceDocumentText: 'x' } });
    other.result.current.handleBookmarkNavigate(bookmark);
    expect(other.args.navigate).toHaveBeenCalled();
    other.done();
  });

  it('activates matching workspace tabs in tab view', () => {
    const tabs = [
      { id: 't1', kind: 'workspace', workspaceName: 'W', workspacePath: '/w', alias: 'Alias', fileList: files, currentFile: '/w/a.md', sourceDocumentText: source },
      { id: 't2', kind: 'workspace', workspaceName: 'Other', workspacePath: '/o', fileList: [], currentFile: '/o/x.md' },
      { id: 't3', kind: 'file' },
      { id: 't4', kind: 'workspace' },
    ];
    const { result, args, notices, done } = setup({ isTabView: true, tabs });
    expect(result.current.bookmarkWorkspaces.map((w: any) => w.workspaceName)).toEqual(['Alias', 'Other']);
    result.current.handleBookmarkNavigate(bookmark);
    expect(args.activateTab).toHaveBeenCalledWith('t1', '/w/a.md');
    result.current.handleBookmarkNavigate({ ...bookmark, workspaceKey: '/missing' });
    expect(notices).toEqual(['ws']);
    done();
    const notCurrent = setup({ isTabView: true, tabs: [{ ...tabs[0], currentFile: '/w/b.md' }] });
    notCurrent.result.current.handleBookmarkNavigate(bookmark);
    expect(notCurrent.args.activateTab).toHaveBeenCalled();
    notCurrent.done();
    const md = setup({ isTabView: true, tabs: [{ ...tabs[0], markdownSource: 'changed text' }] });
    md.result.current.handleBookmarkNavigate(bookmark);
    expect(md.notices).toEqual(['target']);
    md.done();
  });
});
