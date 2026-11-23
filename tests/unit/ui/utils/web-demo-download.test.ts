import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const zip = vi.hoisted(() => ({
  createZipBlob: vi.fn((entries: unknown[]) => ({ entries })),
  triggerBrowserDownload: vi.fn(),
}));
const support = vi.hoisted(() => ({ triggerSupportModalAndResetCounters: vi.fn() }));
vi.mock('../../../../ui/src/utils/zipBuilder', () => zip);
vi.mock('../../../../ui/src/utils/supportPromptStore', () => support);

import {
  downloadWebDemoFile,
  downloadWebDemoFolderZip,
  downloadWebDemoWorkspaceZip,
  resolveFileContent,
  shouldShowWorkspaceZipButton,
} from '../../../../ui/src/utils/webDemoDownload';

const file = (relativePath: string, extra: Record<string, unknown> = {}) => ({
  relativePath, fsPath: `/ws/${relativePath}`, fileName: relativePath.split('/').pop()!, ...extra,
}) as any;

function installBus(reply: (detail: any) => any) {
  const bus = new EventTarget();
  bus.addEventListener('webview-message', (event) => {
    const detail = (event as CustomEvent).detail;
    const response = reply(detail);
    if (response) bus.dispatchEvent(new CustomEvent('host-message', { detail: { requestId: detail.requestId, ...response } }));
  });
  (window as any).__webBus = bus;
  return bus;
}

beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); });
afterEach(() => { delete (window as any).__webBus; vi.useRealTimers(); });

describe('resolveFileContent', () => {
  it('prefers document session drafts by fsPath and relativePath', async () => {
    const state: any = { documentSessions: { '/ws/a.md': { draftText: 'fs draft' }, 'b.md': { draftText: 'rel draft' } } };
    expect(await resolveFileContent(file('a.md'), state)).toBe('fs draft');
    expect(await resolveFileContent(file('b.md'), state)).toBe('rel draft');
  });

  it('uses the current document source and matching tabs', async () => {
    expect(await resolveFileContent(file('a.md'), { currentFile: '/ws/a.md', sourceDocumentText: 'current' } as any)).toBe('current');
    expect(await resolveFileContent(file('a.md'), { relativePath: 'a.md', sourceDocumentText: 'by rel' } as any)).toBe('by rel');
    const tabs = [
      { filePath: '/ws/d.md', draftText: 'tab draft' },
      { relativePath: 's.md', sourceDocumentText: 'tab source' },
      { relativePath: 'm.md', markdownSource: 'tab markdown' },
      { relativePath: 'n.md' },
    ];
    const state: any = { contentTabs: tabs, documentSessions: {} };
    expect(await resolveFileContent(file('d.md'), state)).toBe('tab draft');
    expect(await resolveFileContent(file('s.md', { fsPath: '' }), state)).toBe('tab source');
    expect(await resolveFileContent(file('m.md'), state)).toBe('tab markdown');
    expect(await resolveFileContent(file('n.md'), state)).toBe('');
  });

  it('reads virtual workspace content from localStorage and tolerates corrupt entries', async () => {
    localStorage.setItem('unrelated', 'x');
    localStorage.setItem('markdown-explorer:virtual-workspace:v1:empty', '');
    localStorage.setItem('markdown-explorer:virtual-workspace:v1:null', 'null');
    localStorage.setItem('markdown-explorer.virtual-ws-content.v1.a', JSON.stringify({ 'a.md': 'stored rel', '/ws/b.md': 'stored fs' }));
    expect(await resolveFileContent(file('a.md'), {} as any)).toBe('stored rel');
    expect(await resolveFileContent(file('b.md'), {} as any)).toBe('stored fs');
    localStorage.setItem('markdown-explorer.virtual-ws-content.v1.bad', '{not json');
    expect(await resolveFileContent(file('zzz.md', { fsPath: '' }), {} as any)).toBe('');
  });

  it('returns the welcome document and falls back to the web demo bus', async () => {
    expect(await resolveFileContent(file('Welcome.md'), {} as any)).toContain('# Welcome to your Virtual Workspace');
    expect(await resolveFileContent(file('x/Welcome.md', { fileName: 'Other.md', relativePath: 'Welcome.md' }), {} as any)).toContain('Welcome');
    installBus((detail) => {
      if (detail.filePath.includes('ok')) return { command: 'searchPreviewResult', ok: true, markdownSource: 'from bus' };
      if (detail.filePath.includes('fail')) return { command: 'searchPreviewResult', ok: false };
      return { command: 'otherCommand' };
    });
    expect(await resolveFileContent(file('ok.md'), {} as any)).toBe('from bus');
    expect(await resolveFileContent(file('fail.md'), {} as any)).toBe('');
    vi.useFakeTimers();
    const pending = resolveFileContent(file('silent.md'), {} as any);
    await vi.advanceTimersByTimeAsync(2100);
    expect(await pending).toBe('');
  });
});

describe('web demo downloads', () => {
  it('downloads a single file and appends a markdown extension', async () => {
    await downloadWebDemoFile(file('notes.txt'), {} as any);
    expect(zip.triggerBrowserDownload).toHaveBeenLastCalledWith(expect.any(Blob), 'notes.txt.md');
    await downloadWebDemoFile(file('dir/readme.mdx', { fileName: '' }), {} as any);
    expect(zip.triggerBrowserDownload).toHaveBeenLastCalledWith(expect.any(Blob), 'readme.mdx');
    await downloadWebDemoFile(file('', { fileName: '' }), {} as any);
    expect(zip.triggerBrowserDownload).toHaveBeenLastCalledWith(expect.any(Blob), 'document.md');
  });

  it('zips a folder with paths relative to the folder', async () => {
    const state: any = { fileList: [
      file('docs/a.md'),
      file('docs/sub/b.md'),
      file('docs', { fileName: 'docs.md' }),
      file('other/c.md', { fsPath: 'docs/c.md' }),
      file('outside.md'),
    ] };
    await downloadWebDemoFolderZip('\\docs\\', 'docs.zip', state);
    expect(zip.createZipBlob.mock.calls[0][0].map((e: any) => e.path)).toEqual(['a.md', 'sub/b.md', 'docs.md', 'c.md']);
    expect(zip.triggerBrowserDownload).toHaveBeenLastCalledWith(expect.anything(), 'docs.zip');
    expect(support.triggerSupportModalAndResetCounters).toHaveBeenCalled();
    await downloadWebDemoFolderZip('none', '', {} as any);
    expect(zip.triggerBrowserDownload).toHaveBeenLastCalledWith(expect.anything(), 'folder.zip');
  });

  it('zips the whole workspace with a derived archive name', async () => {
    await downloadWebDemoWorkspaceZip({ fileList: [file('/a.md'), file('', { fileName: 'b.md' })], workspaceName: 'Mine.zip' } as any);
    expect(zip.createZipBlob.mock.calls[0][0].map((e: any) => e.path)).toEqual(['a.md', 'b.md']);
    expect(zip.triggerBrowserDownload).toHaveBeenLastCalledWith(expect.anything(), 'Mine.zip');
    await downloadWebDemoWorkspaceZip({ workspacePath: '/home/me/project/' } as any);
    expect(zip.triggerBrowserDownload).toHaveBeenLastCalledWith(expect.anything(), 'project.zip');
    await downloadWebDemoWorkspaceZip({} as any);
    expect(zip.triggerBrowserDownload).toHaveBeenLastCalledWith(expect.anything(), 'workspace.zip');
  });

  it('decides when to show the workspace zip button', () => {
    expect(shouldShowWorkspaceZipButton(false, [file('a.md')])).toBe(false);
    expect(shouldShowWorkspaceZipButton(true, null)).toBe(false);
    expect(shouldShowWorkspaceZipButton(true, [])).toBe(false);
    expect(shouldShowWorkspaceZipButton(true, [file('a.md'), file('b.md')])).toBe(true);
    expect(shouldShowWorkspaceZipButton(true, [file('Welcome.md')])).toBe(false);
    expect(shouldShowWorkspaceZipButton(true, [file('a.md')])).toBe(true);
  });
});
