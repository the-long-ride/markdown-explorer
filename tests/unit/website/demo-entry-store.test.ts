import { describe, expect, it } from 'vitest';
import { DemoEntryStore, DEMO_WORKSPACE_STORAGE_KEY } from '../../../website-app/src/demo-entry-store';

const seeds = [{ path: 'sample.md', kind: 'file' as const, source: 'sample.md' }];
describe('demo storage recovery', () => {
  it.each(['{broken', '{}', '[{"path":"../escape","kind":"folder"}]',
    '[{"path":"orphan/a.md","kind":"file"}]',
    '[{"path":"a.md","kind":"file","source":"unknown.md"}]',
    '[{"path":"same","kind":"folder"},{"path":"same","kind":"folder"}]'])('ignores invalid snapshots: %s', raw => {
    localStorage.setItem(DEMO_WORKSPACE_STORAGE_KEY, raw);
    expect(new DemoEntryStore(seeds, localStorage).entries).toEqual(seeds);
  });

  it('loads seed files when reading browser storage is blocked', () => {
    const store = new DemoEntryStore(seeds, { getItem: () => { throw new Error('blocked'); }, setItem: () => {} });
    expect(store.entries).toEqual(seeds);
  });

  it('preserves prior state if persisting a rename or deletion fails', () => {
    const store = new DemoEntryStore(seeds, { getItem: () => null, setItem: () => { throw new Error('full'); } });
    expect(() => store.rename('sample.md', 'new.md', 'file')).toThrow('failed');
    expect(() => store.delete('sample.md')).toThrow('failed');
    expect(store.entries).toEqual(seeds);
  });
});
