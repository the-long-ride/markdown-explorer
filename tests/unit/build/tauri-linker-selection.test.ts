import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  getTauriCacheDir,
  hasMsvcLinker,
  resolveCargoArgs,
} from '../../../tauri/scripts/run-with-global-cache.mjs';

describe('Tauri global cache', () => {
  it('uses the explicit cache override when provided', () => {
    expect(getTauriCacheDir({ MARKDOWN_EXPLORER_TAURI_CACHE: 'D:/shared/tauri-cache' })).toBe('D:/shared/tauri-cache');
  });

  it('uses the Windows local app data directory by default', () => {
    expect(
      getTauriCacheDir({ LOCALAPPDATA: 'C:/Users/test/AppData/Local' }),
    ).toBe(path.join('C:/Users/test/AppData/Local', 'MarkdownExplorer', 'tauri-cache'));
  });
});

describe('Windows Rust linker selection', () => {
  it('forces GNU when MARKDOWN_EXPLORER_FORCE_GNU=1', () => {
    expect(hasMsvcLinker({ MARKDOWN_EXPLORER_FORCE_GNU: '1' })).toBe(false);
  });

  it('forces MSVC when MARKDOWN_EXPLORER_FORCE_MSVC=1', () => {
    expect(hasMsvcLinker({ MARKDOWN_EXPLORER_FORCE_MSVC: '1' })).toBe(true);
  });

  it('falls back to windows-gnu cargo toolchain when link.exe is missing', () => {
    const args = resolveCargoArgs(['dev'], {}, { hasLinker: false });
    if (process.platform === 'win32') {
      expect(args[0]).toMatch(/^\+.*-windows-gnu$/);
      expect(args.slice(1)).toEqual(['tauri', 'dev']);
    } else {
      expect(args).toEqual(['tauri', 'dev']);
    }
  });

  it('uses default MSVC toolchain when link.exe is available', () => {
    const args = resolveCargoArgs(['dev'], {}, { hasLinker: true });
    expect(args).toEqual(['tauri', 'dev']);
  });

  it('detects link.exe via where.exe on Windows', () => {
    if (process.platform !== 'win32') {
      return;
    }
    const run = vi.fn(() => ({ status: 0, stdout: 'C:\\link.exe\n' }));
    expect(hasMsvcLinker({}, run as never)).toBe(true);
    expect(run).toHaveBeenCalled();
  });
});
