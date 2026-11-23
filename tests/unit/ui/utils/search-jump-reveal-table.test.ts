import { afterEach, describe, expect, it, vi } from 'vitest';
import { revealElementAncestors } from '../../../../ui/src/utils/searchJumpDom';

afterEach(() => { delete (window as any).Table; document.body.innerHTML = ''; });

function table(rowClass: string) {
  document.body.innerHTML = `<div class="mdn-table-wrap"><input class="mdn-table-input" value="q"><button class="mdn-table-toggle-btn"></button>
    <table class="mdn-table" id="tb"><tbody><tr class="${rowClass}"><td id="hit">x</td></tr><tr class="is-hidden"><td>y</td></tr></tbody></table></div>`;
  return document.getElementById('hit')!;
}

describe('revealElementAncestors table rows', () => {
  it('switches charts back to the table and clears filters for hidden rows', () => {
    const state: any = { searchQuery: 'q', filters: { a: 1 } };
    const switchView = vi.fn();
    const applyAllFilters = vi.fn();
    (window as any).Table = { states: { tb: { currentView: 'bar' } }, switchView, initState: () => state, applyAllFilters };
    revealElementAncestors(table('is-hidden'));
    expect(switchView).toHaveBeenCalledWith('tb', 'table');
    expect(state).toMatchObject({ searchQuery: '', filters: {}, expanded: true });
    expect((document.querySelector('.mdn-table-input') as HTMLInputElement).value).toBe('');
    const collapsed: any = {};
    (window as any).Table = { initState: () => collapsed, applyAllFilters };
    revealElementAncestors(table('is-collapsed-row'));
    expect(collapsed.expanded).toBe(true);
    revealElementAncestors(table(''));
  });

  it('expands rows directly without the table runtime', () => {
    revealElementAncestors(table('is-collapsed-row'));
    expect(document.querySelectorAll('tr.is-hidden, tr.is-collapsed-row')).toHaveLength(0);
    expect(document.querySelector('.mdn-table-toggle-btn')!.classList.contains('is-expanded')).toBe(true);
  });
});
