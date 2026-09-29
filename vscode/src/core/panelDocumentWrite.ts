import { realpath as nodeRealpath } from 'node:fs/promises';
import * as path from 'path';

type FileStatLike = { mtime: number; size: number };
type UriLike = { fsPath: string; scheme?: string };
type TextDocumentLike = { uri: UriLike; isDirty: boolean; getText(): string };
type RealpathImpl = (filePath: string) => Promise<string>;

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
    readonly textDocuments?: readonly TextDocumentLike[];
    readonly fs: {
      stat(uri: UriLike): PromiseLike<FileStatLike>;
      readFile(uri: UriLike): PromiseLike<Uint8Array>;
      writeFile(uri: UriLike, content: Uint8Array): PromiseLike<void>;
      rename?(source: UriLike, target: UriLike, options: { overwrite: boolean }): PromiseLike<void>;
      delete?(uri: UriLike): PromiseLike<void>;
    };
  };
  readonly Uri: {
    file(fsPath: string): UriLike;
  };
}

interface PanelDocumentWriteOptions {
  readonly realpathImpl?: RealpathImpl;
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

async function canonicalTargetInsideWorkspace(
  workspaceRoot: string,
  filePath: string,
  realpathImpl: RealpathImpl,
): Promise<boolean> {
  const [canonicalRoot, canonicalTarget] = await Promise.all([
    realpathImpl(workspaceRoot),
    realpathImpl(filePath),
  ]);
  return isSameOrInsidePath(canonicalRoot, canonicalTarget);
}

const MARKDOWN_DOCUMENT = /\.mdx?$/i;

function isWritableDocumentPath(filePath: string): boolean {
  if (!MARKDOWN_DOCUMENT.test(filePath)) return false;
  return !path.resolve(filePath).split(/[\\/]+/).some((segment) => segment.toLowerCase() === '.git');
}

function samePath(left: string, right: string): boolean {
  const a = path.resolve(left);
  const b = path.resolve(right);
  return process.platform === 'win32' || process.platform === 'darwin'
    ? a.toLowerCase() === b.toLowerCase()
    : a === b;
}

function openTextDocumentFor(filePaths: readonly string[], deps: PanelDocumentWriteDeps): TextDocumentLike | undefined {
  return (deps.workspace.textDocuments ?? []).find((document) =>
    (document.uri.scheme ?? 'file') === 'file'
    && filePaths.some((filePath) => samePath(document.uri.fsPath, filePath)));
}

async function writeDocumentBytes(
  uri: UriLike,
  canonicalPath: string,
  bytes: Uint8Array,
  deps: PanelDocumentWriteDeps,
): Promise<void> {
  const fs = deps.workspace.fs;
  if (uri.scheme !== 'file' || typeof fs.rename !== 'function') {
    // Virtual file systems have no same-directory rename guarantee; keep a plain write.
    await fs.writeFile(uri, bytes);
    return;
  }
  // Write a sibling temp file and rename it over the canonical target so a crash never truncates it.
  const target = deps.Uri.file(canonicalPath);
  const temp = deps.Uri.file(path.join(
    path.dirname(canonicalPath),
    `.${path.basename(canonicalPath)}.${process.pid}.${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}.tmp`,
  ));
  try {
    await fs.writeFile(temp, bytes);
    await fs.rename(temp, target, { overwrite: true });
  } catch (error) {
    try { await fs.delete?.(temp); } catch { /* best effort cleanup */ }
    throw error;
  }
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
  options: PanelDocumentWriteOptions = {},
): Promise<PanelDocumentWriteCapability> {
  if (!isWritableDocumentPath(filePath)) {
    return { supported: false, revision: null, reason: 'unsupported-document' };
  }
  const workspaceRoot = workspaceRootFor(filePath, deps);
  if (!workspaceRoot) {
    return { supported: false, revision: null, reason: 'read-only-runtime' };
  }
  try {
    const realpathImpl = options.realpathImpl ?? nodeRealpath;
    if (!(await canonicalTargetInsideWorkspace(workspaceRoot, filePath, realpathImpl))) {
      return { supported: false, revision: null, reason: 'read-only-runtime' };
    }
    return { supported: true, revision: await panelDocumentRevision(filePath, deps) };
  } catch {
    return { supported: false, revision: null, reason: 'read-only-runtime' };
  }
}

export async function handlePanelDocumentWrite(
  message: PanelSaveDocumentMessage,
  deps: PanelDocumentWriteDeps,
  options: PanelDocumentWriteOptions = {},
): Promise<PanelSaveDocumentResultMessage> {
  const base = baseResult(message);
  if (typeof message.filePath !== 'string' || !isWritableDocumentPath(message.filePath)) {
    return { ...base, ok: false, reason: 'read-only', error: 'Only Markdown documents outside .git can be saved.' };
  }
  const workspaceRoot = workspaceRootFor(message.filePath, deps);
  if (!workspaceRoot) {
    return { ...base, ok: false, reason: 'outside-workspace' };
  }

  const realpathImpl = options.realpathImpl ?? nodeRealpath;
  let canonicalPath: string;
  try {
    const [canonicalRoot, canonicalTarget] = await Promise.all([
      realpathImpl(workspaceRoot),
      realpathImpl(message.filePath),
    ]);
    if (!isSameOrInsidePath(canonicalRoot, canonicalTarget)) {
      return { ...base, ok: false, reason: 'outside-workspace' };
    }
    if (!isWritableDocumentPath(canonicalTarget)) {
      return { ...base, ok: false, reason: 'read-only', error: 'Only Markdown documents outside .git can be saved.' };
    }
    canonicalPath = canonicalTarget;
  } catch (error) {
    const missing = isMissingError(error);
    return {
      ...base,
      ok: false,
      reason: missing ? 'missing' : 'write-failed',
      ...(!missing ? { error: String((error as Error)?.message || error) } : {}),
    };
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

  // A null expected revision means the caller never saw this file: treat it as a conflict (matches the browser host).
  if (!message.force && (message.expectedRevision === null || message.expectedRevision !== currentRevision)) {
    return {
      ...base,
      ok: false,
      reason: 'conflict',
      // ignoreBOM keeps a leading U+FEFF so the source matches what Electron reports.
      diskSource: new TextDecoder('utf-8', { ignoreBOM: true }).decode(diskBytes),
      diskRevision: currentRevision,
    };
  }

  // Never write behind unsaved VS Code editor changes; surface them as a conflict instead.
  const openDocument = openTextDocumentFor([message.filePath, canonicalPath], deps);
  if (!message.force && openDocument?.isDirty) {
    return {
      ...base,
      ok: false,
      reason: 'conflict',
      diskSource: openDocument.getText(),
      diskRevision: currentRevision,
    };
  }

  try {
    await writeDocumentBytes(uri, canonicalPath, new TextEncoder().encode(message.source), deps);
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
