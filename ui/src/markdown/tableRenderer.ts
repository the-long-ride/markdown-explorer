import { renderInline } from './inline';
import { escHtml, shortId } from './utils';
import { AUDITED_UI_TRANSLATIONS } from '../contexts/auditedUiTranslations';
import type { AuditedUiTranslationDomains } from '../contexts/auditedUiTranslationTypes';

export interface InteractiveTableData {
  headers: string[];
  rows: string[][];
  align?: Array<'left' | 'center' | 'right' | null>;
}

function isCategoryColumn(rows: string[][], colIndex: number): boolean {
  const count = rows.length;
  if (count < 3) return false;
  const values = rows.map((row) => (row[colIndex] ?? '').trim()).filter(Boolean);
  const uniqueCount = new Set(values).size;
  if (uniqueCount <= 1 || uniqueCount >= count) return false;
  const averageLength = values.reduce((sum, value) => sum + value.length, 0) / values.length;
  return (uniqueCount <= 10 || uniqueCount / count <= 0.4) && averageLength < 40;
}

export function renderInteractiveTable(
  data: InteractiveTableData,
  isMdx = false,
  labels: AuditedUiTranslationDomains['rendererUi'] = AUDITED_UI_TRANSLATIONS.en.rendererUi,
): string {
  const id = shortId('tbl');
  const encodedLabels = escHtml(JSON.stringify(labels));
  const align = data.align ?? [];
  const thead = data.headers.map((header, columnIndex) => {
    const alignAttr = align[columnIndex] ? ` style="text-align:${align[columnIndex]}"` : '';
    const category = isCategoryColumn(data.rows, columnIndex);
    const filterButton = category
      ? `<span class="mdn-table-filter-btn" onclick="event.stopPropagation(); Table.showFilterMenu('${id}', ${columnIndex}, this)" title="${escHtml(labels.filterByValues)}" role="button" tabindex="0">
             <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
           </span>`
      : '';
    return `<th class="mdn-th${category ? ' has-filter' : ''}" data-col="${columnIndex}" onclick="Table.sort('${id}',${columnIndex})" tabindex="0"${alignAttr}>
  <div class="mdn-th-content">
    <span class="mdn-th-text">${renderInline(header, isMdx, labels)}</span>
    <span class="mdn-sort-icon" aria-hidden="true">⇅</span>
    ${filterButton}
  </div>
</th>`;
  }).join('');

  const tbody = data.rows.map((row, rowIndex) => {
    const rowClass = rowIndex >= 15 ? ' class="is-collapsed-row"' : '';
    const cells = data.headers.map((_, columnIndex) => {
      const alignAttr = align[columnIndex] ? ` style="text-align:${align[columnIndex]}"` : '';
      return `<td${alignAttr}>${renderInline(row[columnIndex] ?? '', isMdx, labels)}</td>`;
    }).join('');
    return `<tr${rowClass}>${cells}</tr>`;
  }).join('\n');

  const toggleButton = data.rows.length > 15
    ? `<button class="mdn-table-toggle-btn" onclick="Table.toggleCollapse('${id}')" id="${id}-toggle-btn">${escHtml(labels.showMore)}</button>`
    : '';

  return `<div class="mdn-table-wrap" id="${id}-wrap" data-ui-labels="${encodedLabels}">
  <div class="mdn-table-toolbar">
    <label class="mdn-table-search-wrap" aria-label="${escHtml(labels.searchTable)}">
      <svg class="mdn-search-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
      <input class="mdn-table-input" type="search" placeholder="${escHtml(labels.filterRows)}" oninput="Table.filter('${id}',this.value)" />
    </label>
    <span class="mdn-row-count" id="${id}-count"></span>
    <div class="mdn-table-toolbar-actions">
      <button class="mdn-table-wrap-toggle" id="${id}-wrap-toggle" onclick="Table.toggleWrap('${id}', this)" aria-pressed="false" title="${escHtml(labels.wrapTableText)}">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 7h16"/><path d="M4 12h10a4 4 0 0 1 0 8H9"/><path d="m12 17-3 3 3 3"/></svg><span class="mdn-table-wrap-toggle__label">${escHtml(labels.wrap)}</span>
      </button>
      <div class="mdn-table-view-switcher" id="${id}-switcher"></div>
    </div>
  </div>
  <div class="mdn-table-scroll" id="${id}-scroll">
    <table class="mdn-table" id="${id}">
      <thead><tr>${thead}</tr></thead>
      <tbody>${tbody}</tbody>
    </table>
  </div>
  <div class="mdn-table-chart-container" id="${id}-chart-container" style="display:none;">
    <canvas id="${id}-chart-canvas"></canvas>
  </div>
  ${toggleButton}
</div>`;
}
