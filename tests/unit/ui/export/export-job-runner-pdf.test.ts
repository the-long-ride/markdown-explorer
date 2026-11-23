import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PlatformBridge } from '../../../../ui/src/platform/bridge';
import type { MdFile } from '../../../../ui/src/types/files';
import { runExportJob, type ExportJobRunnerDependencies } from '../../../../ui/src/export/exportJobRunner';
import type { ExportJob } from '../../../../ui/src/export/exportModel';
import type { ExportDocumentSnapshot } from '../../../../ui/src/export/exportSnapshot';

const bridge = { postMessage: vi.fn(), onMessage: () => () => {} } as unknown as PlatformBridge;
const theme = { rootAttributes: {}, cssVariables: {}, cssText: '', fontFaceCss: '' };
const file = (name: string, title = name): MdFile => ({ fsPath: `/d/${name}.md`, relativePath: `${name}.md`, parts: [`${name}.md`], fileName: `${name}.md`, title, extension: '.md', documentKind: 'markdown' } as MdFile);
const snapshot = (target: MdFile): ExportDocumentSnapshot => ({ file: target, markdownSource: '# x', html: '<p>x</p>', features: new Set(['core']), visualBlocks: [], warnings: [] } as any);
const job = (format: ExportJob['format'], files: MdFile[], batchMode: ExportJob['batchMode'] = 'separate'): ExportJob => ({ format, layout: 'document', batchMode, files } as ExportJob);
const deps = (overrides: Partial<ExportJobRunnerDependencies> = {}): Partial<ExportJobRunnerDependencies> => ({
  loadSnapshot: vi.fn(async (_b, target) => snapshot(target)),
  captureTheme: () => theme as any,
  loadRuntimeAssets: async () => [],
  composeHtml: vi.fn(() => ({ kind: 'html', fileName: 'export.html', bytes: new Uint8Array([1]) })) as any,
  composeSite: vi.fn(() => ({ kind: 'zip', fileName: 'site.zip', bytes: new Uint8Array([2]), entries: [] })) as any,
  saveArtifact: vi.fn(async (_b, _r, artifact) => ({ ok: true, path: artifact.fileName })) as any,
  readResource: vi.fn(async () => ({ ok: false as const, reason: 'missing' as const })) as any,
  loadPdfMake: vi.fn(async () => ({})) as any,
  composePdf: vi.fn(async ({ documents }) => documents.map((d: any) => ({ fileName: `${d.file.title}.pdf`, bytes: new Uint8Array([1]), warnings: [] }))) as any,
  ...overrides,
});
const args = { bridge, settings: { language: 'en' } as any, workspaceName: '' };

afterEach(() => { delete document.documentElement.dataset.theme; });

describe('runExportJob pdf and save outcomes', () => {
  it('saves separate and merged PDFs and reports failures', async () => {
    const files = [file('A'), file('B')];
    expect((await runExportJob({ ...args, runtime: 'desktop', job: job('pdf', files) } as any, deps())).successCount).toBe(2);
    expect((await runExportJob({ ...args, runtime: 'desktop', workspaceName: 'W', job: job('pdf', files, 'merged') } as any, deps())).successCount).toBeGreaterThan(0);
    const failing = await runExportJob({ ...args, runtime: 'desktop', job: job('pdf', files) } as any, deps({
      saveArtifact: vi.fn(async () => ({ ok: false })) as any,
    }));
    expect(failing.failureCount).toBe(2);
    const thrown = await runExportJob({ ...args, runtime: 'desktop', job: job('pdf', files, 'merged') } as any, deps({
      composePdf: vi.fn(async () => { throw 'boom'; }) as any,
    }));
    expect(thrown.failureCount).toBe(1);
    const noPath = await runExportJob({ ...args, runtime: 'desktop', job: job('pdf', [file('C')]) } as any, deps({
      saveArtifact: vi.fn(async () => ({ ok: true })) as any,
    }));
    expect(noPath.savedPaths).toEqual(['C.pdf']);
  });

  it('stops on cancellation during PDF and web saves', async () => {
    const files = [file('A'), file('B')];
    const cancelledSave = await runExportJob({ ...args, runtime: 'desktop', job: job('pdf', files) } as any, deps({
      saveArtifact: vi.fn(async () => ({ ok: false, cancelled: true })) as any,
    }));
    expect(cancelledSave.cancelled).toBe(true);
    let calls = 0;
    const midway = await runExportJob({ ...args, runtime: 'desktop', job: job('pdf', files), isCancelled: () => ++calls > 3 } as any, deps());
    expect(midway.cancelled).toBe(true);
    const webCancel = await runExportJob({ ...args, runtime: 'desktop', job: job('html', [file('A')]) } as any, deps({
      saveArtifact: vi.fn(async () => ({ ok: false, cancelled: true })) as any,
    }));
    expect(webCancel.cancelled).toBe(true);
    const webFail = await runExportJob({ ...args, runtime: 'desktop', job: job('site', files, 'merged') } as any, deps({
      saveArtifact: vi.fn(async () => ({ ok: false, error: 'disk full' })) as any,
    }));
    expect(webFail.failureCount).toBe(1);
    const webThrow = await runExportJob({ ...args, runtime: 'desktop', job: job('site', files) } as any, deps({
      composeSite: vi.fn(() => { throw new Error('zip'); }) as any,
    }));
    expect(webThrow.failureCount).toBe(1);
    const empty = await runExportJob({ ...args, runtime: 'desktop', job: job('html', []) } as any, deps());
    expect(empty.successCount).toBe(0);
  });

  it('derives dark mode from the document theme', async () => {
    document.documentElement.dataset.theme = 'auto';
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    const composeHtml = vi.fn(() => ({ kind: 'html', fileName: 'e.html', bytes: new Uint8Array() })) as any;
    await runExportJob({ ...args, runtime: 'web', job: job('html', [file('A', '')]) } as any, deps({ composeHtml }));
    document.documentElement.dataset.theme = 'dark';
    await runExportJob({ ...args, runtime: 'web', job: job('html', [file('A')]) } as any, deps({ composeHtml }));
    await runExportJob({ ...args, runtime: 'web', isDark: false, job: job('html', [file('A')]) } as any, deps({ composeHtml }));
    expect(composeHtml).toHaveBeenCalledTimes(3);
    vi.unstubAllGlobals();
  });
});
