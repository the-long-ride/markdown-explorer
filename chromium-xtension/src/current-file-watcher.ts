import { resolveFileHandle } from "./file-access";

export interface FileSignature {
  readonly lastModified: number;
  readonly size: number;
}

export interface CurrentFileWatcherOptions {
  readonly dirHandle: FileSystemDirectoryHandle;
  readonly intervalMs: number;
  readonly setInterval: typeof globalThis.setInterval;
  readonly clearInterval: typeof globalThis.clearInterval;
  readonly readFileSignature?: (
    handle: FileSystemDirectoryHandle,
    relativePath: string,
  ) => Promise<FileSignature | null>;
}

export async function readFileSignature(
  handle: FileSystemDirectoryHandle,
  relativePath: string,
): Promise<FileSignature | null> {
  const fileHandle = await resolveFileHandle(handle, relativePath);
  if (!fileHandle) return null;
  const file = await fileHandle.getFile();
  return { lastModified: file.lastModified, size: file.size };
}

export function signaturesDiffer(
  a: FileSignature | null,
  b: FileSignature | null,
): boolean {
  if (!a || !b) return a !== b;
  return a.lastModified !== b.lastModified || a.size !== b.size;
}

export class CurrentFileWatcher {
  private timer: ReturnType<typeof globalThis.setInterval> | null = null;
  private lastSig: FileSignature | null = null;
  private readonly opts: CurrentFileWatcherOptions;
  private gen = 0;

  constructor(opts: CurrentFileWatcherOptions) {
    this.opts = {
      readFileSignature,
      ...opts,
    };
  }

  async start(
    relativePath: string,
    onChanged: (relativePath: string) => void,
  ): Promise<void> {
    this.stop();
    const myGen = ++this.gen;
    this.lastSig = (await this.opts.readFileSignature?.(this.opts.dirHandle, relativePath)) ?? null;
    if (myGen !== this.gen) return;
    this.timer = this.opts.setInterval(() => {
      void this.tick(relativePath, onChanged);
    }, this.opts.intervalMs);
  }

  private async tick(relativePath: string, onChanged: (relativePath: string) => void): Promise<void> {
    const sig = (await this.opts.readFileSignature?.(this.opts.dirHandle, relativePath)) ?? null;
    if (signaturesDiffer(sig, this.lastSig)) {
      this.lastSig = sig;
      onChanged(relativePath);
    } else if (sig) {
      this.lastSig = sig;
    }
  }

  stop(): void {
    if (this.timer !== null) {
      this.opts.clearInterval(this.timer);
      this.timer = null;
    }
    this.lastSig = null;
    this.gen++;
  }
}

export const CURRENT_FILE_WATCH_INTERVAL_MS = 3000;

let activeWatcher: CurrentFileWatcher | null = null;

export function startCurrentFileWatcher(
  dirHandle: FileSystemDirectoryHandle | null,
  relativePath: string | null,
  onChanged: (relativePath: string) => void,
): void {
  stopCurrentFileWatcher();
  if (!dirHandle || !relativePath) return;
  activeWatcher = new CurrentFileWatcher({
    dirHandle,
    intervalMs: CURRENT_FILE_WATCH_INTERVAL_MS,
    setInterval: globalThis.setInterval,
    clearInterval: globalThis.clearInterval,
  });
  void activeWatcher.start(relativePath, onChanged);
}

export function stopCurrentFileWatcher(): void {
  activeWatcher?.stop();
  activeWatcher = null;
}
