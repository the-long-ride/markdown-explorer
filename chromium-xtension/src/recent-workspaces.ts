// =============================================================================
// chrome/src/recent-workspaces.ts — Manages recent workspace handles and UI representation
// =============================================================================

import {
  saveHandleToIDB,
  loadHandlesFromIDB,
  deleteHandleFromIDB,
} from './file-access';
import type { RecentWorkspace } from '../../ui/src/types';

export class BrowserRecentWorkspaces {
  private static handles = new Map<string, FileSystemDirectoryHandle>();

  static async getHandle(path: string): Promise<FileSystemDirectoryHandle | null> {
    if (this.handles.has(path)) {
      return this.handles.get(path)!;
    }
    const all = await loadHandlesFromIDB();
    const match = all.find(w => w.path === path);
    if (match) {
      this.handles.set(path, match.handle);
      return match.handle;
    }
    return null;
  }

  static async load(): Promise<RecentWorkspace[]> {
    try {
      const list = await loadHandlesFromIDB();
      list.sort((a, b) => b.lastOpened - a.lastOpened);
      
      for (const item of list) {
        this.handles.set(item.path, item.handle);
      }

      return list.map(item => ({
        name: item.name,
        path: item.path,
        lastOpened: item.lastOpened
      }));
    } catch (err) {
      console.error('Failed to load recent workspaces:', err);
      return [];
    }
  }

  static async save(name: string, path: string, handle: FileSystemDirectoryHandle): Promise<RecentWorkspace[]> {
    this.handles.set(path, handle);
    try {
      await saveHandleToIDB(path, handle, name);
    } catch (err) {
      console.error('Failed to save recent workspace handle to DB:', err);
    }
    return await this.load();
  }

  static async remove(path: string): Promise<RecentWorkspace[]> {
    this.handles.delete(path);
    try {
      await deleteHandleFromIDB(path);
    } catch (err) {
      console.error('Failed to delete workspace from DB:', err);
    }
    return await this.load();
  }
}
