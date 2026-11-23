export function memoryFile(name: string, initialSource = '', permission: PermissionState = 'granted') {
  let source = initialSource;
  let revision = 1;
  return {
    kind: 'file' as const,
    name,
    queryPermission: async () => permission,
    requestPermission: async () => permission,
    async getFile() {
      const text = source;
      const file = new File([text], name, { lastModified: revision });
      return Object.assign(file, {
        text: async () => text,
        arrayBuffer: async () => new TextEncoder().encode(text).buffer,
        slice: (start?: number, end?: number) => {
          const slice = text.slice(start, end);
          return Object.assign(new Blob([slice]), { text: async () => slice });
        },
      });
    },
    async createWritable() {
      return {
        write: async (value: string | File) => { source = typeof value === 'string' ? value : await value.text(); },
        close: async () => { revision += 1; },
        abort: async () => {},
      };
    },
  };
}

type MemoryFile = ReturnType<typeof memoryFile>;

export class MemoryFolder {
  readonly kind = 'directory';
  readonly children = new Map<string, MemoryFile | MemoryFolder>();

  constructor(readonly name: string, private permission: PermissionState = 'granted') {}

  async queryPermission() { return this.permission; }
  async requestPermission() { return this.permission; }
  async *values() { yield* this.children.values(); }
  async *entries() { yield* this.children; }
  [Symbol.asyncIterator]() { return this.entries(); }

  async getDirectoryHandle(name: string, options?: { create?: boolean }) {
    const entry = this.children.get(name);
    if (entry instanceof MemoryFolder) return entry;
    if (entry) throw new DOMException('not a folder', 'TypeMismatchError');
    if (!options?.create) throw new DOMException('missing folder', 'NotFoundError');
    const folder = new MemoryFolder(name);
    this.children.set(name, folder);
    return folder;
  }

  async getFileHandle(name: string, options?: { create?: boolean }) {
    const entry = this.children.get(name);
    if (entry instanceof MemoryFolder) throw new DOMException('not a file', 'TypeMismatchError');
    if (entry) return entry;
    if (!options?.create) throw new DOMException('missing file', 'NotFoundError');
    const file = memoryFile(name);
    this.children.set(name, file);
    return file;
  }

  async removeEntry(name: string) {
    if (!this.children.delete(name)) throw new DOMException('missing entry', 'NotFoundError');
  }

  asHandle() { return this as unknown as FileSystemDirectoryHandle; }
}

export function asFileHandle(file: MemoryFile): FileSystemFileHandle {
  return file as unknown as FileSystemFileHandle;
}
