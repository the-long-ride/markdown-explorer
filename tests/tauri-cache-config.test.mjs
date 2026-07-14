import { describe, expect, it } from 'vitest';
import { getTauriCacheDir } from '../tauri/scripts/run-with-global-cache.mjs';

// Kept for backwards-compatible path; full suite lives in tests/unit/build/.
describe('Tauri global cache', () => {
  it('uses the explicit cache override when provided', () => {
    expect(getTauriCacheDir({ MARKDOWN_EXPLORER_TAURI_CACHE: 'D:/shared/tauri-cache' })).toBe('D:/shared/tauri-cache');
  });

  it('uses the Windows local app data directory by default', () => {
    expect(getTauriCacheDir({ LOCALAPPDATA: 'C:/Users/test/AppData/Local' })).toBe(
      'C:/Users/test/AppData/Local/MarkdownExplorer/tauri-cache',
    );
  });
});
