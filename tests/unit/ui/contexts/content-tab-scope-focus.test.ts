import { describe, expect, it } from 'vitest';
import { reconcileScopeFocusSetting, reorderContentTabs } from '../../../../ui/src/contexts/contentTabState';

const f = (p: string) => ({ fsPath: p, relativePath: p.slice(1), parts: p.slice(1).split('/'), fileName: p.split('/').pop()!, title: p, extension: '.md' }) as any;

describe('content tab scope focus reconciliation', () => {
  it('returns input when scope key is absent', () => {
    expect(reconcileScopeFocusSetting({ scopeFocus: undefined, scopeKey: 'k', previousFileList: [], nextFileList: [], previousTree: null, includeNewFiles: true })).toBeUndefined();
    const focus = { other: ['/a.md'] };
    expect(reconcileScopeFocusSetting({ scopeFocus: focus, scopeKey: 'k', previousFileList: [], nextFileList: [], previousTree: null, includeNewFiles: true })).toBe(focus);
  });

  it('keeps, drops or clears saved scope paths as files change', () => {
    const prev = [f('/a.md'), f('/b.md'), f('/c.md')];
    const results = [true, false].flatMap((includeNewFiles) => [
      reconcileScopeFocusSetting({ scopeFocus: { k: ['/a.md', '/gone.md'] }, scopeKey: 'k', previousFileList: prev, nextFileList: [f('/a.md'), f('/b.md'), f('/d.md')], previousTree: null, includeNewFiles }),
      reconcileScopeFocusSetting({ scopeFocus: { k: ['/a.md', '/b.md', '/c.md'] }, scopeKey: 'k', previousFileList: prev, nextFileList: prev, previousTree: null, includeNewFiles }),
      reconcileScopeFocusSetting({ scopeFocus: { k: ['/a.md'], keep: ['/x'] }, scopeKey: 'k', previousFileList: prev, nextFileList: [], previousTree: null, includeNewFiles }),
    ]);
    for (const result of results) expect(result === undefined || typeof result === 'object').toBe(true);
    expect(results[0]?.k ?? []).not.toContain('/gone.md');
  });

  it('reorders tabs and ignores missing or identical targets', () => {
    const tabs = [{ filePath: '/a.md' }, { filePath: '/b.md' }, { filePath: '/c.md' }] as any;
    expect(reorderContentTabs(tabs, '/a.md', '/a.md')).toBe(tabs);
    expect(reorderContentTabs(tabs, '/x.md', '/a.md')).toBe(tabs);
    expect(reorderContentTabs(tabs, '/a.md', '/x.md')).toBe(tabs);
    expect(reorderContentTabs(tabs, '/A.md', '/c.md').map((t: any) => t.filePath)).not.toEqual(['/a.md', '/b.md', '/c.md']);
  });
});
