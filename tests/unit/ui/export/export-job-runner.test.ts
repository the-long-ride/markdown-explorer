import { describe, expect, it, vi } from 'vitest';
import type { PlatformBridge } from '../../../../ui/src/platform/bridge';
import type { AppRuntime } from '../../../../ui/src/types/settings';
import type { MdFile } from '../../../../ui/src/types/files';
import { runExportJob, type ExportActivityEvent, type ExportJobRunnerDependencies } from '../../../../ui/src/export/exportJobRunner';
import { exportArtifactLabel, type ExportJob } from '../../../../ui/src/export/exportModel';
import type { ExportDocumentSnapshot } from '../../../../ui/src/export/exportSnapshot';

const bridge = { postMessage: vi.fn(), onMessage: () => () => {}, getState: () => undefined, setState: () => {}, copyToClipboard: () => {} } as unknown as PlatformBridge;
const theme = { rootAttributes: {}, cssVariables: {}, cssText: '', fontFaceCss: '' };

function file(name: string): MdFile {
  return { fsPath: `/docs/${name}.md`, relativePath: `${name}.md`, parts: [`${name}.md`], fileName: `${name}.md`, title: name, extension: '.md', documentKind: 'markdown' };
}
function snapshot(target: MdFile, html = `<p>${target.title}</p>`): ExportDocumentSnapshot {
  return { file: target, markdownSource: `# ${target.title}`, html, features: new Set(['core']), visualBlocks: [], warnings: [] };
}
function job(format: ExportJob['format'], files: MdFile[], batchMode: ExportJob['batchMode'] = 'separate'): ExportJob {
  return { format, layout: 'document', batchMode, files };
}
function dependencies(overrides: Partial<ExportJobRunnerDependencies> = {}): Partial<ExportJobRunnerDependencies> {
  return {
    captureTheme: () => theme,
    loadRuntimeAssets: async () => [{ name: 'core', fileName: 'core.js', code: 'core' }],
    composeHtml: vi.fn(() => ({ kind: 'html', fileName: 'export.html', bytes: new Uint8Array([1]) })),
    composeSite: vi.fn(() => ({ kind: 'zip', fileName: 'export-site.zip', bytes: new Uint8Array([2]), entries: [] })),
    saveArtifact: vi.fn(async (_bridge, _runtime, artifact) => ({ ok: true, path: artifact.fileName })),
    readResource: vi.fn(async () => ({ ok: false as const, reason: 'missing' as const })),
    loadPdfMake: vi.fn(),
    composePdf: vi.fn(async ({ documents }) => documents.map((document) => ({ fileName: `${document.file.title}.pdf`, bytes: new Uint8Array([37, 80, 68, 70]), warnings: [] }))),
    ...overrides,
  };
}
const baseArgs = { bridge, settings: { language: 'en' } as any, workspaceName: 'Docs' };

describe('runExportJob', () => {
  it('keeps successful separate outputs when another document render fails', async () => {
    const good = file('Good');
    const bad = file('Bad');
    const events: ExportActivityEvent[] = [];
    const save = vi.fn(async (_bridge, _runtime, artifact) => ({ ok: true, path: artifact.fileName }));
    const result = await runExportJob({ ...baseArgs, runtime: 'desktop', job: job('html', [good, bad]), onEvent: (event) => events.push(event) }, dependencies({
      loadSnapshot: vi.fn(async (_bridge, target) => { if (target.fsPath === bad.fsPath) throw new Error('render failed'); return snapshot(target); }),
      saveArtifact: save,
    }));
    expect(result.successCount).toBe(1);
    expect(result.failureCount).toBe(1);
    expect(save).toHaveBeenCalledTimes(1);
    expect(events).toEqual(expect.arrayContaining([expect.objectContaining({ stage: 'failed', path: 'Bad.md' }), expect.objectContaining({ stage: 'saved' })]));
  });

  it('does not save merged output when any required document fails', async () => {
    const good = file('Good');
    const bad = file('Bad');
    const save = vi.fn();
    const result = await runExportJob({ ...baseArgs, runtime: 'tauri', job: job('site', [good, bad], 'merged') }, dependencies({
      loadSnapshot: vi.fn(async (_bridge, target) => { if (target.fsPath === bad.fsPath) throw new Error('render failed'); return snapshot(target); }),
      saveArtifact: save,
    }));
    expect(result.failureCount).toBe(1);
    expect(save).not.toHaveBeenCalled();
  });

  it('warns for an automatic missing asset but still saves', async () => {
    const target = file('Guide');
    const events: ExportActivityEvent[] = [];
    const result = await runExportJob({ ...baseArgs, runtime: 'vscode', job: job('html', [target]), onEvent: (event) => events.push(event) }, dependencies({
      loadSnapshot: vi.fn(async () => snapshot(target, '<img src="./missing.png">')),
    }));
    expect(result.successCount).toBe(1);
    expect(result.warningCount).toBe(1);
    expect(events.some((event) => event.stage === 'warning' && event.message?.includes('missing.png'))).toBe(true);
  });

  it('generates and saves PDFs through the same facade for every runtime', async () => {
    const target = file('Guide');
    for (const runtime of ['desktop', 'tauri', 'vscode', 'chrome'] as AppRuntime[]) {
      const save = vi.fn(async (_bridge, receivedRuntime, artifact) => ({ ok: true, path: `${receivedRuntime}:${artifact.fileName}` }));
      const result = await runExportJob({ ...baseArgs, runtime, job: job('pdf', [target]) }, dependencies({
        loadSnapshot: vi.fn(async () => snapshot(target)), saveArtifact: save,
      }));
      expect(result.successCount).toBe(1);
      expect(save).toHaveBeenCalledWith(bridge, runtime, expect.objectContaining({ mimeType: 'application/pdf' }));
    }
  });

  it('finishes safe rendering but skips packaging/save after the caller generation becomes stale', async () => {
    const target = file('Guide');
    let stale = false;
    const save = vi.fn();
    const result = await runExportJob({ ...baseArgs, runtime: 'desktop', job: job('html', [target]), isCancelled: () => stale }, dependencies({
      loadSnapshot: vi.fn(async () => { stale = true; return snapshot(target); }), saveArtifact: save,
    }));
    expect(result.cancelled).toBe(true);
    expect(save).not.toHaveBeenCalled();
  });
});

describe('exportArtifactLabel', () => {
  it('predicts package/file shape before export', () => {
    expect(exportArtifactLabel({ format: 'html', batchMode: 'separate', documentCount: 1 })).toBe('HTML (.html)');
    expect(exportArtifactLabel({ format: 'html', batchMode: 'separate', documentCount: 2 })).toBe('HTML package (.zip)');
    expect(exportArtifactLabel({ format: 'html', batchMode: 'merged', documentCount: 1 })).toBe('HTML (.html)');
    expect(exportArtifactLabel({ format: 'site', batchMode: 'merged', documentCount: 2 })).toBe('Static Website (.zip)');
    expect(exportArtifactLabel({ format: 'pdf', batchMode: 'separate', documentCount: 2 })).toBe('PDF files');
    expect(exportArtifactLabel({ format: 'pdf', batchMode: 'merged', documentCount: 2 })).toBe('PDF (.pdf)');
  });
});
