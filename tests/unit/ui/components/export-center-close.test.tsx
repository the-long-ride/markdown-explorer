import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { MdFile } from '../../../../ui/src/types/files';

const fixtures = vi.hoisted(() => ({
  file: {
    fsPath: '/docs/readme.md',
    relativePath: 'readme.md',
    parts: ['readme.md'],
    fileName: 'readme.md',
    title: 'Readme',
    extension: '.md',
    documentKind: 'markdown',
  } as MdFile,
}));

const mocks = vi.hoisted(() => ({
  loadDocumentSnapshot: vi.fn(),
  saveBlobAsFile: vi.fn(async () => true),
}));

vi.mock('../../../../ui/src/contexts/AppStateContext', () => ({
  useAppState: () => ({
    state: {
      currentFile: '/docs/readme.md',
      fileList: [fixtures.file],
      workspaceName: 'Docs',
      appRuntime: 'desktop',
      settings: { language: 'en' },
    },
  }),
}));

vi.mock('../../../../ui/src/contexts/PlatformContext', () => ({
  usePlatform: () => ({
    postMessage: vi.fn(),
    onMessage: () => () => {},
    getState: () => undefined,
    setState: () => {},
    copyToClipboard: () => {},
  }),
}));

vi.mock('../../../../ui/src/dom/copyImage', () => ({ saveBlobAsFile: mocks.saveBlobAsFile }));
vi.mock('../../../../ui/src/export/documentSnapshot', () => ({
  loadDocumentSnapshot: mocks.loadDocumentSnapshot,
}));

import { ExportCenterModal } from '../../../../ui/src/components/Export/ExportCenterModal';

describe('ExportCenterModal close and PDF options', () => {
  it('keeps close and Escape available while an export is running and has no footer Cancel button', async () => {
    let resolveSnapshot!: (value: unknown) => void;
    mocks.loadDocumentSnapshot.mockReturnValue(new Promise((resolve) => { resolveSnapshot = resolve; }));
    const onClose = vi.fn();

    render(<ExportCenterModal isOpen onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));

    const close = screen.getByRole('button', { name: 'Close Export Center' });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Exporting…' })).toBeDisabled());
    expect(close).not.toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();

    fireEvent.click(close);
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);

    resolveSnapshot({ file: fixtures.file, markdownSource: '# Readme', html: '<h1>Readme</h1>' });
    await waitFor(() => expect(mocks.saveBlobAsFile).toHaveBeenCalledTimes(1));
  });

  it('offers an enabled-by-default PDF footer toggle with the exact footer text', () => {
    mocks.loadDocumentSnapshot.mockResolvedValue({ file: fixtures.file, markdownSource: '# Readme', html: '<h1>Readme</h1>' });
    render(<ExportCenterModal isOpen onClose={() => {}} />);

    fireEvent.click(screen.getByRole('radio', { name: /^PDF/ }));
    expect(screen.getByRole('checkbox', { name: 'Include PDF footer' })).toBeChecked();
    expect(screen.getByText('Markdown Explorer - @the-long-ride')).toBeTruthy();
    expect(screen.queryByText(/system print/i)).toBeNull();
  });
});
