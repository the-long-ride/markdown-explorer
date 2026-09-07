import * as path from 'path';

type FileStatLike = { mtime: number; size: number };
type UriLike = { fsPath: string };

export interface PanelDocumentWriteCapability {
  readonly supported: boolean;
  readonly revision: string | null;
  readonly reason?: 'read-only-runtime' | 'permission-required' | 'unsupported-document';
}

export interface PanelSaveDocumentMessage {
  readonly command: 'saveDocument';
  readonly requestId: string;
  readonly filePath: string;
  readonly source: string;
  readonly expectedRevision: string | null;
  readonly force?: boolean;
}

export interface PanelSaveDocumentResultMessage {
  readonly command: 'saveDocumentResult';
  readonly requestId: string;
  readonly filePath: string;
  readonly ok: boolean;
  readonly revision?: string;
  readonly diskSource?: string;
  readonly diskRevision?: string;
  readonly reason?: 'conflict' | 'permission-denied' | 'missing' | 'outside-workspace' | 'read-only' | 'write-failed';
  readonly error?: string;
}

export interface PanelDocumentWriteDeps {
  readonly workspace: {
    readonly workspaceFolders?: readonly { uri: UriLike }[];
    readonly fs: {
      stat(uri: UriLike): PromiseLike<FileStatLike>;
      readFile(uri: UriLike): PromiseLike<Uint8Array>;
      writeFile(uri: UriLike, content: Uint8Array): PromiseLike<void>;
    };
  };
  readonly Uri: {
    file(fsPath: string): UriLike;
  };
}

function isSameOrInsidePath(basePath: string, targetPath: string): boolean {
  const relative = path.relative(path.resolve(basePath), path.resolve(targetPath));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function workspaceRootFor(filePath: string, deps: PanelDocumentWriteDeps): string | null {
  for (const folder of deps.workspace.workspaceFolders ?? []) {
    if (isSameOrInsidePath(folder.uri.fsPath, filePath)) return folder.uri.fsPath;
  }
  return null;
}

function revisionFromStat(stat: FileStatLike): string {
  return `${Math.trunc(stat.mtime)}:${stat.size}`;
}

function isMissingError(error: unknown): boolean {
  const value = error as { code?: string; name?: string; message?: string } | null;
  return value?.code === 'ENOENT'
    || value?.code === 'FileNotFound'
    || value?.name === 'FileNotFound'
    || /not\s*found|missing/i.test(value?.message ?? '');
}

function baseResult(message: PanelSaveDocumentMessage) {
  return {
    command: 'saveDocumentResult' as const,
    requestId: message.requestId,
    filePath: message.filePath,
  };
}

export async function panelDocumentRevision(
  filePath: string,
  deps: PanelDocumentWriteDeps,
): Promise<string> {
  const stat = await deps.workspace.fs.stat(deps.Uri.file(filePath));
  return revisionFromStat(stat);
}

export async function panelDocumentWriteCapability(
  filePath: string,
  deps: PanelDocumentWriteDeps,
): Promise<PanelDocumentWriteCapability> {
  if (!/\.mdx?$/i.test(filePath)) {
    return { supported: false, revision: null, reason: 'unsupported-document' };
  }
  if (!workspaceRootFor(filePath, deps)) {
    return { supported: false, revision: null, reason: 'read-only-runtime' };
  }
  try {
    return { supported: true, revision: await panelDocumentRevision(filePath, deps) };
  } catch {
    return { supported: false, revision: null, reason: 'read-only-runtime' };
  }
}

export async function handlePanelDocumentWrite(
  message: PanelSaveDocumentMessage,
  deps: PanelDocumentWriteDeps,
): Promise<PanelSaveDocumentResultMessage> {
  const base = baseResult(message);
  if (!workspaceRootFor(message.filePath, deps)) {
    return { ...base, ok: false, reason: 'outside-workspace' };
  }

  const uri = deps.Uri.file(message.filePath);
  let currentRevision: string;
  let diskBytes: Uint8Array;
  try {
    const [stat, bytes] = await Promise.all([
      deps.workspace.fs.stat(uri),
      deps.workspace.fs.readFile(uri),
    ]);
    currentRevision = revisionFromStat(stat);
    diskBytes = bytes;
  } catch (error) {
    const missing = isMissingError(error);
    return {
      ...base,
      ok: false,
      reason: missing ? 'missing' : 'write-failed',
      ...(!missing ? { error: String((error as Error)?.message || error) } : {}),
    };
  }

  if (!message.force && message.expectedRevision !== null && message.expectedRevision !== currentRevision) {
    return {
      ...base,
      ok: false,
      reason: 'conflict',
      diskSource: new TextDecoder().decode(diskBytes),
      diskRevision: currentRevision,
    };
  }

  try {
    await deps.workspace.fs.writeFile(uri, new TextEncoder().encode(message.source));
    return {
      ...base,
      ok: true,
      revision: await panelDocumentRevision(message.filePath, deps),
    };
  } catch (error) {
    const missing = isMissingError(error);
    return {
      ...base,
      ok: false,
      reason: missing ? 'missing' : 'write-failed',
      ...(!missing ? { error: String((error as Error)?.message || error) } : {}),
    };
  }
}
