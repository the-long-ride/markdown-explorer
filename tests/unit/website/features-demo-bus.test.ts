import { afterEach, expect, it, vi } from 'vitest';
import type { HostMessage, WebviewMessage } from '../../../ui/src/types';
import { installDemoBusHost } from '../../../website-app/src/features/demoBusHost';
import { DEMO_REPO_COMMITS } from '../../../website-app/src/features/demoGitFixtures';

const architecture = 'docs/architecture-overview.md';
const metrics = 'docs/metrics-benchmarks.md';
const release = 'docs/release-playbook.md';

let host: ReturnType<typeof installDemoBusHost>;

function connect(options?: Parameters<typeof installDemoBusHost>[0]) {
  host = installDemoBusHost(options);
  const bus = (window as Window & { __webBus: EventTarget }).__webBus;
  const messages: HostMessage[] = [];
  bus.addEventListener('host-message', (event) => messages.push((event as CustomEvent<HostMessage>).detail));
  return {
    bus,
    send(message: WebviewMessage) {
      messages.length = 0;
      bus.dispatchEvent(new CustomEvent('webview-message', { detail: message }));
      return messages.slice();
    },
  };
}

afterEach(() => {
  host?.dispose();
  Reflect.deleteProperty(window, '__webBus');
});

it('opens seeded workspaces and navigates fixture documents using host messages', () => {
  const { send } = connect();
  expect(send({ command: 'ready' })).toMatchObject([
    { command: 'readyAck', appRuntime: 'web', theme: 'dark' },
    { command: 'renderContent', relativePath: architecture },
  ]);
  expect(send({ command: 'openRecentWorkspace', path: '/workspace/Benchmarks' })).toMatchObject([
    { command: 'workspaceFilesChanged', workspaceName: 'Benchmarks' },
    { command: 'recentWorkspacesChanged' },
    { command: 'renderContent', relativePath: metrics },
  ]);
  expect(send({ command: 'openRecentWorkspace', path: 'demo\\Release' }).at(-1)).toMatchObject({ relativePath: release });
  expect(send({ command: 'openRecentWorkspace', path: '/' }).at(-1)).toMatchObject({ relativePath: architecture });
  expect(send({ command: 'deleteRecentWorkspace', path: '/' })).toEqual([
    expect.objectContaining({ recentWorkspaces: expect.not.arrayContaining([expect.objectContaining({ path: '/' })]) }),
  ]);
  expect(send({ command: 'createVirtualWorkspace', type: 'createVirtualWorkspace', name: '' })[0]).toMatchObject({ workspaceName: 'virtual-scratchpad' });
  expect(send({ command: 'openFile' })).toMatchObject([{ relativePath: architecture }]);
  expect(send({ command: 'updateAppearance', theme: 'light' })).toMatchObject([{ relativePath: architecture }]);
  expect(send({ command: 'updateAppearance' })).toEqual([]);
  expect(send({ command: 'refresh' })).toMatchObject([{ relativePath: architecture }]);
});

it('searches, saves and previews edited fixture sources without writing a user file', () => {
  const { send } = connect({ initialSlug: 'tables-charts' });
  expect(send({ command: 'ready' }).at(-1)).toMatchObject({ relativePath: metrics });
  const source = '# New Title\nRare Terms\nrare terms';
  expect(send({ command: 'saveDocument', requestId: 'edit', filePath: metrics, source })).toMatchObject([
    { command: 'saveDocumentResult', requestId: 'edit', ok: true, revision: String(source.length) },
    { command: 'renderContent', markdownSource: source },
  ]);
  expect(send({ command: 'saveDocument', requestId: 'offscreen', filePath: release, source: '# Draft' })).toHaveLength(1);
  expect(send({ command: 'searchWorkspace', requestId: 'search', query: 'rare terms' })[0]).toMatchObject({
    done: true, results: [{ relativePath: metrics, lineNumber: 2 }, { relativePath: metrics, lineNumber: 3 }],
  });
  expect(send({ command: 'searchWorkspace', requestId: 'search', query: 'rare terms', matchCase: true })[0]).toMatchObject({
    results: [{ relativePath: metrics, lineNumber: 3 }],
  });
  expect(send({ command: 'searchWorkspace', requestId: 'search', query: '' })[0]).toMatchObject({ results: [] });
  expect(send({ command: 'loadSearchPreview', requestId: 'preview', filePath: 'metrics-benchmarks.md' })[0]).toMatchObject({ ok: true, markdownSource: source });
  expect(send({ command: 'readWorkspaceTextResource', requestId: 'preview', resourcePath: release })[0]).toMatchObject({ ok: true, content: '# Draft' });
});

it('serves history, clipboard, fonts, and download requests', async () => {
  vi.useFakeTimers();
  const { send } = connect();
  const oid = DEMO_REPO_COMMITS[0]!.oid;
  expect(send({ command: 'listDocumentHistory', requestId: 'list', filePath: release, limit: 1 })[0]).toMatchObject({
    command: 'documentHistoryResult', revisions: [expect.objectContaining({ oid })],
  });
  expect(send({ command: 'readGitRevision', requestId: 'read', oid, path: release })[0]).toMatchObject({
    command: 'gitRevisionResult', snapshot: { source: expect.any(String) },
  });
  expect(send({ command: 'listRepositoryHistory', requestId: 'repo', offset: 1, limit: 1 })[0]).toMatchObject({
    command: 'repositoryHistoryResult', commits: [{ oid: DEMO_REPO_COMMITS[1]!.oid }],
  });
  expect(send({ command: 'listRevisionFiles', requestId: 'files', oid })[0]).toMatchObject({
    command: 'revisionFilesResult', files: expect.arrayContaining([expect.objectContaining({ path: release })]),
  });
  expect(send({ command: 'readRevisionFile', requestId: 'file', oid, path: metrics })[0]).toMatchObject({
    command: 'revisionFileResult', snapshot: { source: expect.any(String) },
  });
  expect(send({
    command: 'compareGitRevisions', requestId: 'diff',
    left: { kind: 'current', path: release }, right: { kind: 'commit', path: release, oid },
  })[0]).toMatchObject({ command: 'gitComparisonResult', ok: true, leftLabel: 'Working Tree (Current)' });
  expect(send({ command: 'listDesktopFonts', requestId: 'fonts' })[0]).toMatchObject({ fonts: [] });

  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    expect(this.download).toBe('notes.md');
    expect(this.href).toMatch(/^blob:/);
  });
  const revoke = vi.spyOn(URL, 'revokeObjectURL');
  send({ command: 'saveExportFile', fileName: 'notes.md', mimeType: 'text/markdown', dataBase64: btoa('# Notes') });
  expect(click).toHaveBeenCalledOnce();
  await vi.advanceTimersByTimeAsync(1000);
  expect(revoke).toHaveBeenCalledOnce();

  const writeText = vi.fn().mockRejectedValue(new Error('Clipboard denied'));
  vi.spyOn(window, 'navigator', 'get').mockReturnValue({ clipboard: { writeText } } as unknown as Navigator);
  send({ command: 'copyCode', text: 'example' });
  expect(writeText).toHaveBeenCalledWith('example');
});

it('accepts matching parent messages and detaches the event listeners on dispose', () => {
  const onSlugChange = vi.fn();
  const { bus, send } = connect({ onSlugChange });
  const parentMessage = (data: unknown) => window.dispatchEvent(new MessageEvent('message', { data }));
  bus.dispatchEvent(new Event('webview-message'));
  parentMessage(null);
  parentMessage({ type: 'other', feature: 'charts' });
  parentMessage({ type: 'mde-demo-select', feature: 1 });
  expect(onSlugChange).not.toHaveBeenCalled();
  parentMessage({ type: 'mde-demo-select', feature: 'charts' });
  expect(onSlugChange).toHaveBeenLastCalledWith('tables-charts');
  expect(send({ command: 'refresh' }).at(-1)).toMatchObject({ relativePath: metrics });
  host.dispose();
  expect(send({ command: 'navigate', path: architecture })).toEqual([]);
  parentMessage({ type: 'mde-demo-select', feature: 'workspace' });
  expect(onSlugChange).toHaveBeenCalledOnce();
});

it('compares document history snapshots and paginates repository commits', () => {
  const { send } = connect();
  const themes = 'docs/design-system-themes.md';
  const [head, middle, earlier, oldest] = DEMO_REPO_COMMITS;
  const compare = (path: string, oid: string) => {
    const [response] = send({
      command: 'compareGitRevisions', requestId: 'compare',
      left: { kind: 'commit', path, oid },
      right: { kind: 'current', path },
    });
    expect(response).toMatchObject({ command: 'gitComparisonResult', ok: true });
    return response as Extract<HostMessage, { command: 'gitComparisonResult' }>;
  };

  for (const path of [architecture, metrics, release, themes]) {
    const pair = compare(path, oldest.oid);
    expect(pair.leftSource).not.toBe(pair.rightSource);
    const unchanged = compare(path, head.oid);
    expect(unchanged.leftSource).toBe(unchanged.rightSource);
  }
  expect(compare(themes, earlier.oid).leftSource).not.toContain('Cozy Apricot');
  expect(compare(release, middle.oid).leftSource).toContain('Validate cross-platform Tauri preview builds.');
  expect(compare('missing.md', 'unknown-revision')).toMatchObject({
    leftLabel: 'unknown', leftSource: expect.stringContaining('Architecture Overview'),
  });

  expect(send({ command: 'listDocumentHistory', requestId: 'all', filePath: themes })[0]).toMatchObject({
    revisions: DEMO_REPO_COMMITS.map(({ oid }) => expect.objectContaining({ oid, path: themes })),
  });
  expect(send({ command: 'listRepositoryHistory', requestId: 'page', before: middle.oid })[0]).toMatchObject({
    commits: [expect.objectContaining({ oid: earlier.oid }), expect.objectContaining({ oid: oldest.oid })],
  });
});
