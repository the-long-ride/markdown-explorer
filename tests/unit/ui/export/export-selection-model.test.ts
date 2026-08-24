import { describe, expect, it } from 'vitest';
import { setFilteredSelection } from '../../../../ui/src/components/Export/exportSelectionModel';

describe('setFilteredSelection', () => {
  it('selects only visible rows while preserving selections outside the filter', () => {
    const current = new Set(['docs/keep.md']);
    const result = setFilteredSelection(current, ['docs/a.md', 'docs/b.md'], true);
    expect([...result].sort()).toEqual(['docs/a.md', 'docs/b.md', 'docs/keep.md']);
  });

  it('unselects only visible rows while preserving hidden selections', () => {
    const current = new Set(['docs/a.md', 'docs/b.md', 'docs/keep.md']);
    const result = setFilteredSelection(current, ['docs/a.md', 'docs/b.md'], false);
    expect([...result]).toEqual(['docs/keep.md']);
  });

  it('does not mutate the original selection', () => {
    const current = new Set(['docs/a.md']);
    const result = setFilteredSelection(current, ['docs/b.md'], true);
    expect(current).toEqual(new Set(['docs/a.md']));
    expect(result).not.toBe(current);
  });
});
