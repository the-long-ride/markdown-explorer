import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { AppRuntime } from '../../../../ui/src/types/settings';
import type { MdFile } from '../../../../ui/src/types/files';

const fixtures = vi.hoisted(() => ({
  runtime: 'desktop' as AppRuntime,
  files: [
    { fsPath: '/docs/readme.md', relativePath: 'readme.md', parts: ['readme.md'], fileName: 'readme.md', title: 'Readme', extension: '.md', documentKind: 'markdown' },
    { fsPath: '/docs/guide/a.md', relativePath: 'guide/a.md', parts: ['guide', 'a.md'], fileName: 'a.md', title: 'A', extension: '.md', documentKind: 'markdown' },
    { fsPath: '/docs/guide/deep/b.md', relativePath: 'guide/deep/b.md', parts: ['guide', 'deep', 'b.md'], fileName: 'b.md', title: 'B', extension: '.md', documentKind: 'markdown' },
  ] as MdFile[],
}));
const mocks = vi.hoisted(() => ({ runExportJob: vi.fn(async () => ({ savedPaths: ['export.html'], successCount: 1, failureCount: 0, warningCount: 0, cancelled: false })) }));
vi.mock('../../../../ui/src/contexts/AppStateContext', () => ({ useAppState: () => ({ state: { currentFile: '/docs/readme.md', fileList: fixtures.files, workspaceName: 'Docs', appRuntime: fixtures.runtime, settings: { language: 'en' } } }) }));
vi.mock('../../../../ui/src/contexts/PlatformContext', () => ({ usePlatform: () => ({ postMessage: vi.fn(), onMessage: () => () => {}, getState: () => undefined, setState: () => {}, copyToClipboard: () => {} }) }));
vi.mock('../../../../ui/src/export/exportJobRunner', () => ({ runExportJob: mocks.runExportJob }));
vi.mock('../../../../ui/src/export/exportResources', () => ({ listWorkspaceExportResources: vi.fn(async () => [{ relativePath: 'data/config.json', size: 10 }]) }));

import { ExportCenterModal } from '../../../../ui/src/components/Export/ExportCenterModal';

describe('ExportCenterModal', () => {
  it('defaults to current document, HTML, separate, and Document only layout', () => {
    render(<ExportCenterModal isOpen onClose={() => {}} />);
    expect(screen.getByRole('radio', { name: 'Current document' })).toBeChecked();
    expect(screen.getByRole('radio', { name: /^HTML/ })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Separate outputs' })).toBeChecked();
    expect(screen.getByRole('radio', { name: /^Document only/ })).toBeChecked();
  });

  it('offers exactly HTML, PDF, and Static Website formats', () => {
    render(<ExportCenterModal isOpen onClose={() => {}} />);
    const group = screen.getByRole('group', { name: 'Format' });
    expect(Array.from(group.querySelectorAll('input[type="radio"]')).map((input) => (input as HTMLInputElement).value)).toEqual(['html', 'pdf', 'site']);
  });

  it('keeps PDF selectable for every runtime variant', () => {
    for (const runtime of ['desktop', 'tauri', 'vscode', 'chrome'] as AppRuntime[]) {
      fixtures.runtime = runtime;
      const view = render(<ExportCenterModal isOpen onClose={() => {}} />);
      fireEvent.click(screen.getByRole('radio', { name: /^PDF/ }));
      expect(screen.getByRole('radio', { name: /^PDF/ })).toBeChecked();
      view.unmount();
    }
  });

  it('sends the full file list for Whole workspace and excludes extras from PDF jobs', async () => {
    mocks.runExportJob.mockClear();
    render(<ExportCenterModal isOpen onClose={() => {}} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Whole workspace' }));
    fireEvent.click(screen.getByRole('radio', { name: /^PDF/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    await waitFor(() => expect(mocks.runExportJob).toHaveBeenCalled());
    const args = mocks.runExportJob.mock.calls.at(-1)?.[0];
    expect(args.job.files.map((item: MdFile) => item.fsPath)).toEqual(fixtures.files.map((item) => item.fsPath));
    expect(args.job.extraResourcePaths).toEqual([]);
  });
});
