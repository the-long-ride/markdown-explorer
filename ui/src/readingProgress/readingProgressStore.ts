import { READING_PROGRESS_STORAGE_KEY } from '../constants/storage';

// Reading Progress Memory: per-document scroll offsets and collapsed-heading
// state, keyed by workspace and persisted across app restarts. Best-effort by
// design — quota errors and corrupted payloads reset silently.

const MAX_FILES_PER_WORKSPACE = 100;
const WRITE_DEBOUNCE_MS = 500;

interface WorkspaceProgress {
  scroll: Record<string, number>;
  headings: Record<string, [string, boolean][]>;
  touched: Record<string, number>;
}

interface PersistedReadingProgress {
  version: 1;
  workspaces: Record<string, WorkspaceProgress>;
}

function emptyWorkspace(): WorkspaceProgress {
  return { scroll: {}, headings: {}, touched: {} };
}

function parsePayload(): PersistedReadingProgress {
  try {
    const raw = localStorage.getItem(READING_PROGRESS_STORAGE_KEY);
    if (!raw) return { version: 1, workspaces: {} };
    const parsed = JSON.parse(raw) as PersistedReadingProgress;
    if (parsed?.version !== 1 || typeof parsed.workspaces !== 'object' || parsed.workspaces === null) {
      return { version: 1, workspaces: {} };
    }
    return parsed;
  } catch {
    return { version: 1, workspaces: {} };
  }
}

let cached: PersistedReadingProgress | null = null;
let writeTimer: ReturnType<typeof setTimeout> | null = null;

function payload(): PersistedReadingProgress {
  if (!cached) cached = parsePayload();
  return cached;
}

function pruneWorkspace(workspace: WorkspaceProgress): WorkspaceProgress {
  const paths = Object.keys(workspace.touched)
    .sort((a, b) => workspace.touched[b] - workspace.touched[a]);
  if (paths.length <= MAX_FILES_PER_WORKSPACE) return workspace;
  const keep = new Set(paths.slice(0, MAX_FILES_PER_WORKSPACE));
  const next = emptyWorkspace();
  for (const path of keep) {
    if (workspace.scroll[path] !== undefined) next.scroll[path] = workspace.scroll[path];
    if (workspace.headings[path] !== undefined) next.headings[path] = workspace.headings[path];
    next.touched[path] = workspace.touched[path];
  }
  return next;
}

export function flushReadingProgress(): void {
  if (writeTimer) {
    clearTimeout(writeTimer);
    writeTimer = null;
  }
  if (!cached) return;
  try {
    const workspaces: Record<string, WorkspaceProgress> = {};
    for (const [key, workspace] of Object.entries(cached.workspaces)) {
      workspaces[key] = pruneWorkspace(workspace);
    }
    cached = { version: 1, workspaces };
    localStorage.setItem(READING_PROGRESS_STORAGE_KEY, JSON.stringify(cached));
  } catch {
    // Storage quota or privacy mode — progress memory is best-effort.
  }
}

function scheduleFlush(): void {
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(flushReadingProgress, WRITE_DEBOUNCE_MS);
}

function touch(workspaceKey: string, filePath: string): WorkspaceProgress {
  const store = payload();
  if (!store.workspaces[workspaceKey]) store.workspaces[workspaceKey] = emptyWorkspace();
  const workspace = store.workspaces[workspaceKey];
  workspace.touched[filePath] = Date.now();
  return workspace;
}

export function rememberScrollPosition(
  workspaceKey: string,
  filePath: string,
  scrollTop: number,
): void {
  if (!workspaceKey || !filePath || !Number.isFinite(scrollTop) || scrollTop < 0) return;
  touch(workspaceKey, filePath).scroll[filePath] = Math.round(scrollTop);
  scheduleFlush();
}

export function rememberHeadingState(
  workspaceKey: string,
  filePath: string,
  state: ReadonlyMap<string, boolean>,
): void {
  if (!workspaceKey || !filePath || state.size === 0) return;
  touch(workspaceKey, filePath).headings[filePath] = [...state.entries()];
  scheduleFlush();
}

export function getScrollPosition(workspaceKey: string, filePath: string): number | undefined {
  const workspace = payload().workspaces[workspaceKey];
  const value = workspace?.scroll[filePath];
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
}

export function getHeadingState(workspaceKey: string, filePath: string): Map<string, boolean> | undefined {
  const workspace = payload().workspaces[workspaceKey];
  const entries = workspace?.headings[filePath];
  if (!Array.isArray(entries)) return undefined;
  const map = new Map<string, boolean>();
  for (const entry of entries) {
    if (Array.isArray(entry) && typeof entry[0] === 'string' && typeof entry[1] === 'boolean') {
      map.set(entry[0], entry[1]);
    }
  }
  return map;
}
