import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createPdf: vi.fn(),
  addVirtualFileSystem: vi.fn(),
  vfs: { 'Roboto-Regular.ttf': 'base64' },
}));

vi.mock('pdfmake/build/pdfmake', () => ({
  default: { createPdf: mocks.createPdf, addVirtualFileSystem: mocks.addVirtualFileSystem },
}));
vi.mock('pdfmake/build/vfs_fonts', () => ({ default: mocks.vfs }));

import { loadPdfMakeRuntime } from '../../../../ui/src/export/pdf/pdfMakeLoader';

describe('loadPdfMakeRuntime', () => {
  beforeEach(() => vi.clearAllMocks());

  it('loads pdfmake and the default Roboto VFS only when requested', async () => {
    const runtime = await loadPdfMakeRuntime();
    expect(runtime.defaultVfs).toBe(mocks.vfs);
    expect(runtime.pdfMake.createPdf).toBe(mocks.createPdf);
    expect(runtime.pdfMake.addVirtualFileSystem).toBe(mocks.addVirtualFileSystem);
  });
});
