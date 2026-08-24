import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { MdFile } from '../../../../ui/src/types/files';

const fixtures = vi.hoisted(() => {
  const file = { fsPath: '/docs/readme.md', relativePath: 'readme.md', parts: ['readme.md'], fileName: 'readme.md', title: 'Readme', extension: '.md', documentKind: 'markdown' } as MdFile;
  return { file, files: [file] as MdFile[] };
});
const mocks = vi.hoisted(() => ({ runExportJob: vi.fn() }));
vi.mock('../../../../ui/src/contexts/AppStateContext', () => ({ useAppState: () => ({ state: { currentFile: '/docs/readme.md', fileList: fixtures.files, workspaceName: 'Docs', appRuntime: 'desktop', settings: { language: 'en' } } }) }));
vi.mock('../../../../ui/src/contexts/PlatformContext', () => ({ usePlatform: () => ({ postMessage: vi.fn(), onMessage: () => () => {}, getState: () => undefined, setState: () => {}, copyToClipboard: () => {} }) }));
vi.mock('../../../../ui/src/export/exportJobRunner', () => ({ runExportJob: mocks.runExportJob }));

import { ExportCenterModal } from '../../../../ui/src/components/Export/ExportCenterModal';

describe('ExportCenterModal close and PDF options', () => {
  it('keeps close and Escape available while an export is running and has no footer Cancel button', async () => {
    mocks.runExportJob.mockReturnValue(new Promise(() => {}));
    const onClose = vi.fn();
    const { unmount } = render(<ExportCenterModal isOpen onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    const close = screen.getByRole('button', { name: 'Close Export Center' });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Exporting…' })).toBeDisabled());
    expect(close).not.toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
    fireEvent.click(close);
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
    unmount();
  });

  it('does not expose the removed PDF footer option or branding text', () => {
    mocks.runExportJob.mockResolvedValue({ savedPaths: [], successCount: 0, failureCount: 0, warningCount: 0, cancelled: false });
    render(<ExportCenterModal isOpen onClose={() => {}} />);
    fireEvent.click(screen.getByRole('radio', { name: /^PDF/ }));
    expect(screen.queryByRole('checkbox', { name: 'Include PDF footer' })).toBeNull();
    expect(screen.queryByText('Markdown Explorer - @the-long-ride')).toBeNull();
    expect(screen.queryByText(/system print/i)).toBeNull();
  });
});
