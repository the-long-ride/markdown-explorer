// =============================================================================
// utils/webDemoDownload.ts — Browser file, folder ZIP, and workspace ZIP downloads
// =============================================================================

import type { AppState } from '../contexts/appStateModel';
import type { MdFile } from '../types';
import { triggerSupportModalAndResetCounters } from './supportPromptStore';
import { createZipBlob, triggerBrowserDownload } from './zipBuilder';

const DEFAULT_WELCOME_MARKDOWN = `# Welcome to your Virtual Workspace

You can create, edit, and organize Markdown documents directly in your browser.

- **Create files & folders**: Use the sidebar action buttons to add new files and folders.
- **Instant editing**: Click on any document to view or edit it.
- **Saved locally**: Your files and edits are stored right in your browser's local storage.

## Open Local Files & Folders

- **Workspace Selection**: Click the **Close Workspace** button in the top-left bar (next to the navigation arrows) to open the Workspace Selection page and open a local folder or file.
- **Drag & Drop Anywhere**: Drag and drop any \`.md\` file, supported document, or local folder right into anywhere in this app to open it immediately.

## Enable Local Folder Support (Chromium Browsers)

To open or drop local folders directly in Chrome, Edge, or Brave, enable the File System Access API flag:

1. Open a new browser tab and visit \`chrome://flags\` (or \`brave://flags\` / \`edge://flags\`).
2. Search for **File System Access API**.
3. Set it to **Enabled** and relaunch your browser.
`;

async function requestContentFromWebDemoBus(filePath: string): Promise<string | null> {
  if (typeof window === 'undefined' || !(window as any).__webBus) return null;
  const bus = (window as any).__webBus as EventTarget;
  const requestId = `dl_${Math.random().toString(36).slice(2, 9)}_${Date.now()}`;

  return new Promise((resolve) => {
    let finished = false;
    const cleanup = () => {
      clearTimeout(timer);
      bus.removeEventListener('host-message', handler);
    };
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail && detail.command === 'searchPreviewResult' && detail.requestId === requestId) {
        if (!finished) {
          finished = true;
          cleanup();
          resolve(detail.ok && typeof detail.markdownSource === 'string' ? detail.markdownSource : null);
        }
      }
    };
    const timer = setTimeout(() => {
      if (!finished) {
        finished = true;
        cleanup();
        resolve(null);
      }
    }, 2000);

    bus.addEventListener('host-message', handler);
    bus.dispatchEvent(
      new CustomEvent('webview-message', {
        detail: { command: 'loadSearchPreview', requestId, filePath },
      }),
    );
  });
}

export async function resolveFileContent(file: MdFile, state: AppState): Promise<string> {
  const sessions = (state as any).documentSessions;
  if (sessions) {
    if (file.fsPath && typeof sessions[file.fsPath]?.draftText === 'string') {
      return sessions[file.fsPath].draftText;
    }
    if (file.relativePath && typeof sessions[file.relativePath]?.draftText === 'string') {
      return sessions[file.relativePath].draftText;
    }
  }

  const isCurrent =
    state.currentFile === file.fsPath ||
    (file.relativePath && (state as any).relativePath === file.relativePath);
  if (isCurrent && typeof state.sourceDocumentText === 'string' && state.sourceDocumentText.length > 0) {
    return state.sourceDocumentText;
  }

  const matchingTab = state.contentTabs?.find(
    (t) =>
      (file.fsPath && t.filePath === file.fsPath) ||
      (file.relativePath && t.relativePath === file.relativePath),
  );
  if (matchingTab) {
    if (typeof (matchingTab as any).draftText === 'string') return (matchingTab as any).draftText;
    if (typeof (matchingTab as any).sourceDocumentText === 'string') return (matchingTab as any).sourceDocumentText;
    if (typeof (matchingTab as any).markdownSource === 'string') return (matchingTab as any).markdownSource;
  }

  try {
    if (typeof localStorage !== 'undefined') {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (
          key &&
          (key.startsWith('markdown-explorer.virtual-ws-content.v1.') ||
            key.startsWith('markdown-explorer:virtual-workspace:v1'))
        ) {
          const raw = localStorage.getItem(key);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') {
              if (file.relativePath && typeof parsed[file.relativePath] === 'string') {
                return parsed[file.relativePath];
              }
              if (file.fsPath && typeof parsed[file.fsPath] === 'string') {
                return parsed[file.fsPath];
              }
            }
          }
        }
      }
    }
  } catch {}

  if (file.fileName === 'Welcome.md' || file.relativePath === 'Welcome.md') {
    return DEFAULT_WELCOME_MARKDOWN;
  }

  const busContent = await requestContentFromWebDemoBus(file.fsPath || file.relativePath);
  if (typeof busContent === 'string') {
    return busContent;
  }

  return '';
}

export async function downloadWebDemoFile(file: MdFile, state: AppState): Promise<void> {
  const content = await resolveFileContent(file, state);
  let fileName = file.fileName || file.relativePath.split(/[\/\\]/).pop() || 'document.md';
  if (!/\.(md|markdown|mdx)$/i.test(fileName)) {
    fileName = `${fileName}.md`;
  }
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  triggerBrowserDownload(blob, fileName);
}

export async function downloadWebDemoFolderZip(
  folderPath: string,
  folderName: string,
  state: AppState,
): Promise<void> {
  const normalized = folderPath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  const files = (state.fileList || []).filter((f) => {
    const rel = f.relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
    const fs = f.fsPath.replace(/\\/g, '/').replace(/^\/+/, '');
    return rel.startsWith(normalized + '/') || fs.startsWith(normalized + '/') || rel === normalized || fs === normalized;
  });

  const entries: Array<{ path: string; content: string }> = [];
  for (const file of files) {
    const content = await resolveFileContent(file, state);
    const rel = file.relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
    let innerPath = rel;
    if (innerPath.startsWith(normalized + '/')) {
      innerPath = innerPath.slice(normalized.length + 1);
    } else {
      innerPath = file.fileName;
    }
    entries.push({ path: innerPath || file.fileName, content });
  }

  const zipBlob = createZipBlob(entries);
  const zipName = `${(folderName || 'folder').replace(/\.zip$/i, '')}.zip`;
  triggerBrowserDownload(zipBlob, zipName);
  triggerSupportModalAndResetCounters();
}

export async function downloadWebDemoWorkspaceZip(state: AppState): Promise<void> {
  const entries: Array<{ path: string; content: string }> = [];
  for (const file of state.fileList || []) {
    const content = await resolveFileContent(file, state);
    const path = file.relativePath.replace(/\\/g, '/').replace(/^\/+/, '') || file.fileName;
    entries.push({ path, content });
  }

  const zipBlob = createZipBlob(entries);
  const rawName =
    state.workspaceName ||
    (state.workspacePath ? state.workspacePath.split(/[\/\\]/).filter(Boolean).pop() : '') ||
    'workspace';
  const zipName = `${rawName.replace(/\.zip$/i, '')}.zip`;
  triggerBrowserDownload(zipBlob, zipName);
  triggerSupportModalAndResetCounters();
}

export function shouldShowWorkspaceZipButton(
  isWebDemo: boolean,
  fileList?: readonly MdFile[] | null,
  _workspacePath?: string,
): boolean {
  if (!isWebDemo || !fileList || fileList.length === 0) return false;
  if (fileList.length > 1) return true;
  const single = fileList[0];
  return single.fileName !== 'Welcome.md' && single.relativePath !== 'Welcome.md';
}
