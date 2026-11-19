import type { MdFile } from '../../ui/src/types';
import { handleBrowserInsightsHostCommand } from './insights-host-router';

export interface WebInsightsHostContext {
  activeHandle?: FileSystemDirectoryHandle | null;
  singleFileHandle?: FileSystemFileHandle | null;
  activeWorkspacePath?: string;
  getFlatList: () => MdFile[];
  getFileContent?: (path: string) => string | null | Promise<string | null>;
  send: (message: any) => void;
}

async function sha256(text: string): Promise<string | undefined> {
  try {
    if (!globalThis.crypto?.subtle) return undefined;
    const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(digest), v => v.toString(16).padStart(2, '0')).join('');
  } catch {
    return undefined;
  }
}

function resolveReference(documentPath: string, resourcePath: string): string | null {
  const raw = String(resourcePath || '').split(/[?#]/, 1)[0];
  if (!raw || /^(?:https?:|data:|blob:|javascript:|file:\/\/)/i.test(raw)) return null;
  if (raw.startsWith('/')) return raw.slice(1);
  const base = String(documentPath || '').replace(/\\/g, '/').split('/').slice(0, -1).join('/');
  return base ? `${base}/${raw}` : raw;
}

export async function handleWebInsightsHostCommand(
  message: any,
  context: WebInsightsHostContext,
): Promise<boolean> {
  if (context.activeHandle) {
    const handled = await handleBrowserInsightsHostCommand(message, {
      activeHandle: context.activeHandle,
      send: context.send,
    });
    if (handled) return true;
  }

  const requestId = String(message?.requestId || '');

  switch (message?.command) {
    case 'scanInsightsWorkspace': {
      const flatList = context.getFlatList();
      const entries: any[] = [];
      for (const item of flatList) {
        let sizeBytes = 0;
        if (context.getFileContent) {
          const content = await context.getFileContent(item.relativePath);
          if (content !== null && content !== undefined) sizeBytes = content.length;
        } else if (context.singleFileHandle && context.singleFileHandle.name === item.fileName) {
          try {
            sizeBytes = (await context.singleFileHandle.getFile()).size;
          } catch {}
        }
        entries.push({
          relativePath: item.relativePath,
          canonicalRelativePath: item.relativePath,
          kind: 'file',
          sizeBytes,
          mtimeMs: item.modifiedAt ?? Date.now(),
          extension: item.extension || (item.relativePath.includes('.') ? item.relativePath.slice(item.relativePath.lastIndexOf('.')) : undefined),
          isSymlink: false,
        });
      }
      context.send({
        command: 'insightsScanBatch',
        requestId,
        entries,
        scannedEntries: entries.length,
        excludedEntries: 0,
      });
      context.send({
        command: 'insightsScanComplete',
        requestId,
        totalEntries: entries.length,
        excludedEntries: 0,
        skippedEntries: 0,
        truncated: false,
      });
      return true;
    }

    case 'cancelInsightsScan':
      return true;

    case 'readInsightsDocumentSource': {
      const relPath = String(message?.relativePath || '');
      let source: string | null = null;
      let sizeBytes = 0;
      let mtimeMs = Date.now();

      if (context.singleFileHandle && (context.singleFileHandle.name === relPath || relPath.endsWith(context.singleFileHandle.name))) {
        try {
          const file = await context.singleFileHandle.getFile();
          source = await file.text();
          sizeBytes = file.size;
          mtimeMs = file.lastModified || mtimeMs;
        } catch {}
      } else if (context.getFileContent) {
        source = await context.getFileContent(relPath);
        if (source !== null) sizeBytes = source.length;
      }

      if (source !== null) {
        context.send({
          command: 'insightsDocumentSourceResult',
          requestId,
          relativePath: relPath,
          status: 'ok',
          source,
          sizeBytes,
          mtimeMs,
          contentHash: await sha256(source),
        });
      } else {
        context.send({
          command: 'insightsDocumentSourceResult',
          requestId,
          relativePath: relPath,
          status: 'missing',
        });
      }
      return true;
    }

    case 'probeWorkspaceResource': {
      const resolved = resolveReference(String(message.documentPath || ''), String(message.resourcePath || ''));
      const flatList = context.getFlatList();
      const match = flatList.find(f => f.relativePath === resolved || f.fileName === resolved);
      if (match) {
        context.send({
          command: 'workspaceResourceProbeResult',
          requestId,
          status: 'exists',
          relativePath: match.relativePath,
          kind: 'file',
        });
      } else {
        context.send({
          command: 'workspaceResourceProbeResult',
          requestId,
          status: 'missing',
        });
      }
      return true;
    }

    case 'setInsightsWatchState': {
      context.send({
        command: 'insightsRuntimeCapabilities',
        requestId,
        capabilities: {
          fileChanges: 'unsupported',
          externalLinkChecking: false,
          documentPreviewReuse: true,
        },
      });
      return true;
    }

    case 'checkExternalLinks': {
      for (const url of Array.isArray(message.urls) ? message.urls : []) {
        context.send({
          command: 'externalLinkCheckResult',
          requestId,
          url,
          status: 'unsupported',
          reason: 'Browser runtime cannot provide DNS/IP-pinned HTTP status checks.',
        });
      }
      context.send({ command: 'externalLinkCheckComplete', requestId, cancelled: false });
      return true;
    }

    case 'cancelExternalLinkChecks':
      context.send({ command: 'externalLinkCheckComplete', requestId, cancelled: true });
      return true;

    default:
      return false;
  }
}
