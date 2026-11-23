import { afterEach, expect, it, vi } from 'vitest';
import { disposeBrowserInsightsHost } from '../../../website-app/src/insights-host-router';
import { readContainerDocument, buildMdFileFromName, readAndConvertFile } from '../../../website-app/src/web-file-content';
import { handleWebInsightsHostCommand, type WebInsightsHostContext } from '../../../website-app/src/web-insights-host';
import { buildVirtualMdFile } from '../../../website-app/src/user-virtual-workspaces';
import { asFileHandle, memoryFile, MemoryFolder } from './memory-file-system';

afterEach(disposeBrowserInsightsHost);

function connect(context: Partial<WebInsightsHostContext>) {
  const send = vi.fn();
  return async (message: Record<string, unknown>, expected: Record<string, unknown>[]) => {
    send.mockClear();
    const handled = await handleWebInsightsHostCommand(message, { getFlatList: () => [], ...context, send });
    expect(send.mock.calls.flat()).toEqual(expected.map((reply) => expect.objectContaining(reply)));
    return handled;
  };
}

it('routes workspace insights requests to the active folder and reports browser capabilities', async () => {
  const root = new MemoryFolder('root');
  root.children.set('notes.md', memoryFile('notes.md', '# Notes'));
  const dispatch = connect({ activeHandle: root.asHandle() });
  expect(await dispatch({ command: 'scanInsightsWorkspace' }, [
    { command: 'insightsScanBatch', entries: [expect.objectContaining({ relativePath: 'notes.md', sizeBytes: 7 })] },
    { command: 'insightsScanComplete', totalEntries: 1 },
  ])).toBe(true);
  expect(await dispatch({ command: 'cancelInsightsScan', requestId: 'scan' }, [])).toBe(true);
  await dispatch({ command: 'readInsightsDocumentSource', relativePath: 'notes.md' }, [
    { command: 'insightsDocumentSourceResult', source: '# Notes', status: 'ok' },
  ]);
  await dispatch({ command: 'probeWorkspaceResource', resourcePath: '/notes.md' }, [
    { command: 'workspaceResourceProbeResult', status: 'exists' },
  ]);
  await dispatch({ command: 'setInsightsWatchState', active: true, visible: false }, [
    { command: 'insightsRuntimeCapabilities', capabilities: expect.objectContaining({ fileChanges: 'polling' }) },
  ]);
  await dispatch({ command: 'checkExternalLinks', requestId: 'links', urls: ['https://example.test/'] }, [
    { command: 'externalLinkCheckResult', status: 'unsupported', url: 'https://example.test/' },
    { command: 'externalLinkCheckComplete', cancelled: false },
  ]);
  await dispatch({ command: 'checkExternalLinks', urls: false }, [{ command: 'externalLinkCheckComplete', cancelled: false }]);
  await dispatch({ command: 'cancelExternalLinkChecks', requestId: 'links' }, [
    { command: 'externalLinkCheckComplete', requestId: 'links', cancelled: true },
  ]);
  expect(await dispatch({ command: 'other' }, [])).toBe(false);
});

it('uses a picked file for single-file metadata and falls back when it disappears', async () => {
  const file = memoryFile('notes.md', '# Single');
  const dispatch = connect({
    singleFileHandle: asFileHandle(file),
    getFlatList: () => [
      { ...buildVirtualMdFile('notes.md', ''), extension: '', modifiedAt: undefined },
      { ...buildVirtualMdFile('README', ''), extension: '' },
    ],
  });
  const scan = { command: 'scanInsightsWorkspace' };
  const entries = (sizeBytes: number) => [
    { command: 'insightsScanBatch', entries: [
      expect.objectContaining({ relativePath: 'notes.md', sizeBytes, extension: '.md', mtimeMs: expect.any(Number) }),
      expect.objectContaining({ relativePath: 'README', sizeBytes: 0, extension: undefined }),
    ] },
    { command: 'insightsScanComplete', totalEntries: 2 },
  ];
  await dispatch(scan, entries(8));
  const read = { command: 'readInsightsDocumentSource', relativePath: '/single/notes.md' };
  const digest = vi.fn().mockResolvedValueOnce(new Uint8Array([255]).buffer).mockRejectedValue(new Error('Unavailable'));
  vi.stubGlobal('crypto', { subtle: { digest } });
  await dispatch(read, [{ status: 'ok', source: '# Single', contentHash: 'ff', mtimeMs: 1 }]);
  await dispatch(read, [{ status: 'ok', source: '# Single', contentHash: undefined }]);
  vi.spyOn(file, 'getFile').mockRejectedValue(new DOMException('File removed', 'NotFoundError'));
  await dispatch(scan, entries(0));
  await dispatch(read, [{ status: 'missing' }]);
  await dispatch({ command: 'probeWorkspaceResource', resourcePath: 'https://example.test/no' }, [{ status: 'missing' }]);
  await dispatch({ command: 'probeWorkspaceResource', resourcePath: '/notes.md#example' }, [{ status: 'exists', kind: 'file' }]);
});

it('resolves virtual resources and reports unsupported external checks without a native folder', async () => {
  const dispatch = connect({
    getFlatList: () => [buildVirtualMdFile('assets/picture.png', '')],
    getFileContent: (path) => path === 'note.md' ? '# Virtual' : null,
  });
  vi.stubGlobal('crypto', undefined);
  await dispatch({ command: 'readInsightsDocumentSource', relativePath: 'note.md' }, [
    { status: 'ok', source: '# Virtual', contentHash: undefined },
  ]);
  await dispatch({ command: 'readInsightsDocumentSource' }, [{ status: 'missing', relativePath: '' }]);
  await dispatch({ command: 'probeWorkspaceResource' }, [{ status: 'missing' }]);
  await dispatch({ command: 'probeWorkspaceResource', resourcePath: 'picture.png' }, [{ status: 'exists' }]);
  await dispatch({ command: 'probeWorkspaceResource', documentPath: 'assets/note.md', resourcePath: 'picture.png' }, [
    { status: 'exists', relativePath: 'assets/picture.png' },
  ]);
  expect(await dispatch({ command: 'cancelInsightsScan' }, [])).toBe(true);
  await dispatch({ command: 'checkExternalLinks', urls: ['https://example.test/'] }, [
    { command: 'externalLinkCheckResult', status: 'unsupported', url: 'https://example.test/' },
    { command: 'externalLinkCheckComplete', cancelled: false },
  ]);
  await dispatch({ command: 'checkExternalLinks' }, [{ command: 'externalLinkCheckComplete', cancelled: false }]);
  await dispatch({ command: 'cancelExternalLinkChecks', requestId: 'links' }, [
    { command: 'externalLinkCheckComplete', requestId: 'links', cancelled: true },
  ]);
});

it('reads plain and Markdown container files with distinct write permissions', async () => {
  const root = new MemoryFolder('root');
  root.children.set('note.txt', memoryFile('note.txt', 'Plain text'));
  root.children.set('legacy.markdown', memoryFile('legacy.markdown', '# Legacy'));
  root.children.set('private.md', memoryFile('private.md', '# Restricted', 'denied'));
  await expect(readContainerDocument(root.asHandle(), 'note.txt')).resolves.toMatchObject({
    markdownSource: 'Plain text', previewInfo: { sourceExtension: '.txt', readOnly: false }, documentWrite: { supported: true },
  });
  await expect(readContainerDocument(root.asHandle(), 'legacy.markdown')).resolves.toMatchObject({
    markdownSource: '# Legacy', previewInfo: null, documentWrite: undefined,
  });
  await expect(readContainerDocument(root.asHandle(), 'private.md')).resolves.toMatchObject({
    markdownSource: '# Restricted', documentWrite: { supported: false, reason: 'permission-required' },
  });
  await expect(readContainerDocument(root.asHandle(), 'missing.md')).rejects.toThrow('File not found: missing.md');
});

it('previews dropped documents and reports missing write permissions for individual files', async () => {
  expect(buildMdFileFromName('README')).toMatchObject({ title: 'README', extension: '' });
  expect(buildMdFileFromName('.md')).toMatchObject({ title: '.md', extension: '.md' });
  await expect(readAndConvertFile(new File(['Plain text'], 'note.txt'), 'note.txt')).resolves.toMatchObject({
    markdownSource: 'Plain text', documentWrite: { supported: false, reason: 'permission-required' },
  });
  await expect(readAndConvertFile(asFileHandle(memoryFile('private.md', '# Single', 'denied')), 'private.md'))
    .resolves.toMatchObject({
      markdownSource: '# Single', documentWrite: { supported: false, reason: 'permission-required' },
    });
});
