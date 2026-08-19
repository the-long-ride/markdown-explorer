import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MdFile } from '../../../../ui/src/types/files';

const fixtures = vi.hoisted(() => ({
  files: [
    { fsPath: '/docs/readme.md', relativePath: 'readme.md', parts: ['readme.md'], fileName: 'readme.md', title: 'Readme', extension: '.md', documentKind: 'markdown' },
    { fsPath: '/docs/guide/a.md', relativePath: 'guide/a.md', parts: ['guide', 'a.md'], fileName: 'a.md', title: 'A', extension: '.md', documentKind: 'markdown' },
    { fsPath: '/docs/guide/deep/b.md', relativePath: 'guide/deep/b.md', parts: ['guide', 'deep', 'b.md'], fileName: 'b.md', title: 'B', extension: '.md', documentKind: 'markdown' },
  ] as MdFile[],
}));

const mocks = vi.hoisted(() => ({
  saveBlobAsFile: vi.fn(async () => true),
  loadDocumentSnapshot: vi.fn(),
}));

vi.mock('../../../../ui/src/contexts/AppStateContext', () => ({
  useAppState: () => ({
    state: {
      currentFile: '/docs/readme.md',
      fileList: fixtures.files,
      workspaceName: 'Docs',
      appRuntime: 'desktop',
      settings: { language: 'en' },
    },
  }),
}));

vi.mock('../../../../ui/src/contexts/PlatformContext', () => ({
  usePlatform: () => ({ postMessage: vi.fn(), onMessage: () => () => {}, getState: () => undefined, setState: () => {}, copyToClipboard: () => {} }),
}));

vi.mock('../../../../ui/src/dom/copyImage', () => ({ saveBlobAsFile: mocks.saveBlobAsFile }));
vi.mock('../../../../ui/src/export/documentSnapshot', () => ({
  loadDocumentSnapshot: mocks.loadDocumentSnapshot,
}));

import { ExportCenterModal } from '../../../../ui/src/components/Export/ExportCenterModal';

describe('ExportCenterModal', () => {
  beforeEach(() => {
    mocks.saveBlobAsFile.mockClear();
    mocks.loadDocumentSnapshot.mockReset();
    mocks.loadDocumentSnapshot.mockImplementation(async (_bridge: unknown, file: MdFile) => ({
      file,
      markdownSource: `# ${file.title}`,
      html: `<h1>${file.title}</h1>`,
    }));
  });

  it('defaults to current document, HTML, separate, and Document only layout', () => {
    render(<ExportCenterModal isOpen onClose={() => {}} />);

    expect(screen.getByRole('dialog', { name: 'Export Center' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Current document' })).toBeChecked();
    expect(screen.getByRole('radio', { name: /^HTML/ })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Separate outputs' })).toBeChecked();
    expect(screen.getByRole('radio', { name: /^Document only/ })).toBeChecked();
    expect(screen.getByRole('radio', { name: /^Full Explorer layout/ })).not.toBeChecked();
  });

  it('offers exactly HTML, PDF, and Static Website formats', () => {
    render(<ExportCenterModal isOpen onClose={() => {}} />);
    const group = screen.getByRole('group', { name: 'Format' });
    expect(Array.from(group.querySelectorAll('input[type="radio"]')).map((input) => (input as HTMLInputElement).value))
      .toEqual(['html', 'pdf', 'site']);
    expect(screen.queryByText('DOCX')).toBeNull();
    expect(screen.queryByText('EPUB')).toBeNull();
  });

  it('supports selected documents and recursive folder selection', () => {
    render(<ExportCenterModal isOpen onClose={() => {}} />);

    fireEvent.click(screen.getByRole('radio', { name: 'Selected documents' }));
    expect(screen.getByLabelText('guide/a.md')).toBeTruthy();
    expect(screen.getByLabelText('guide/deep/b.md')).toBeTruthy();

    fireEvent.click(screen.getByRole('radio', { name: 'Folder' }));
    const folder = screen.getByLabelText('Folder to export') as HTMLSelectElement;
    expect(Array.from(folder.options).map((option) => option.value)).toContain('guide');
    expect(Array.from(folder.options).map((option) => option.value)).toContain('guide/deep');
  });
});
