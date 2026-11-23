import { describe, expect, it, vi } from 'vitest';
import { getSkippedUpdateVersion, shouldNotifyForUpdate, skipUpdateVersion } from '../../../ui/src/updateNotification';

describe('update notification skip storage', () => {
  it('normalizes and stores skipped versions best-effort', () => {
    const setItem = vi.fn();
    expect(skipUpdateVersion(' v1.2.3-beta+5 ', { setItem })).toBe('1.2.3');
    expect(setItem).toHaveBeenCalledWith(expect.any(String), '1.2.3');
    expect(skipUpdateVersion('', { setItem })).toBe('');
    expect(skipUpdateVersion('2.0.0', undefined)).toBe('2.0.0');
    expect(skipUpdateVersion('2.0.0', { setItem: () => { throw new Error('full'); } })).toBe('2.0.0');
  });

  it('reads skipped versions defensively and compares notifications', () => {
    expect(getSkippedUpdateVersion(undefined)).toBe('');
    expect(getSkippedUpdateVersion({ getItem: () => { throw new Error('denied'); } })).toBe('');
    expect(getSkippedUpdateVersion({ getItem: () => null })).toBe('');
    expect(shouldNotifyForUpdate(true, '', '')).toBe(false);
    expect(shouldNotifyForUpdate(true, 'v2.0.0', '2.0.0')).toBe(false);
    expect(shouldNotifyForUpdate(true, 'v2.1.0', '2.0.0')).toBe(true);
  });
});
