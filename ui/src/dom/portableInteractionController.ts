type PortableInteractionWindow = Window & {
  UI?: Record<string, any>;
  Table?: Record<string, any>;
};

const installedDocuments = new WeakSet<Document>();

const managedInlineSelectors = [
  '.mdn-section-header',
  '.mdn-section-copy-btn',
  '.mdn-copy-btn',
  '.mdn-toggle-preview-btn',
  '.mdn-toggle-csv-btn',
  '.mdn-codeblock-toggle-btn',
  '.mdn-table-input',
  '.mdn-table-toggle-btn',
  '.mdn-table-wrap-toggle',
  '.mdn-table-columns-toggle',
  '.mdn-table-filter-btn',
  '.mdn-th',
].join(',');

function targetElement(target: EventTarget | null): Element | null {
  if (target instanceof Element) return target;
  return target instanceof Node ? target.parentElement : null;
}

function tableIdFromWrap(element: Element): string {
  const wrap = element.closest<HTMLElement>('.mdn-table-wrap');
  if (wrap?.id.endsWith('-wrap')) return wrap.id.slice(0, -'-wrap'.length);
  const table = element.closest<HTMLTableElement>('table.mdn-table');
  return table?.id ?? '';
}

function tableIdFromControl(element: HTMLElement, suffix: string): string {
  return element.id.endsWith(suffix) ? element.id.slice(0, -suffix.length) : tableIdFromWrap(element);
}

function isInteractiveSectionTarget(target: Element, header: HTMLElement): boolean {
  const interactive = target.closest('a,button,input,select,textarea,[role="button"],[role="option"],[contenteditable="true"]');
  return Boolean(interactive && interactive !== header);
}

function removeManagedInlineHandlers(doc: Document): void {
  doc.querySelectorAll<HTMLElement>(managedInlineSelectors).forEach((element) => {
    element.removeAttribute('onclick');
    element.removeAttribute('oninput');
    element.removeAttribute('onchange');
    element.removeAttribute('onkeydown');
  });
}

export function installPortableInteractionController(
  doc: Document = document,
  win: PortableInteractionWindow = window,
): void {
  if (installedDocuments.has(doc)) return;
  installedDocuments.add(doc);
  removeManagedInlineHandlers(doc);

  doc.addEventListener('input', (event) => {
    const target = targetElement(event.target)?.closest<HTMLInputElement>('.mdn-table-input');
    if (!target) return;
    const tableId = tableIdFromWrap(target);
    if (tableId) win.Table?.filter?.(tableId, target.value);
  });

  doc.addEventListener('click', (event) => {
    const target = targetElement(event.target);
    if (!target) return;

    const copySection = target.closest<HTMLElement>('.mdn-section-copy-btn');
    if (copySection) {
      event.preventDefault();
      event.stopPropagation();
      win.UI?.copySection?.(copySection, event);
      return;
    }

    const copyCode = target.closest<HTMLElement>('.mdn-copy-btn');
    if (copyCode) {
      event.preventDefault();
      event.stopPropagation();
      win.UI?.copyCode?.(copyCode);
      return;
    }

    const htmlToggle = target.closest<HTMLElement>('.mdn-toggle-preview-btn');
    if (htmlToggle) {
      event.preventDefault();
      event.stopPropagation();
      win.UI?.toggleHtmlMode?.(htmlToggle);
      return;
    }

    const csvToggle = target.closest<HTMLElement>('.mdn-toggle-csv-btn');
    if (csvToggle) {
      event.preventDefault();
      event.stopPropagation();
      win.UI?.toggleCsvMode?.(csvToggle);
      return;
    }

    const codeToggle = target.closest<HTMLElement>('.mdn-codeblock-toggle-btn');
    if (codeToggle) {
      event.preventDefault();
      event.stopPropagation();
      win.UI?.toggleCodeCollapse?.(codeToggle);
      return;
    }

    const filterButton = target.closest<HTMLElement>('.mdn-table-filter-btn');
    if (filterButton) {
      event.preventDefault();
      event.stopPropagation();
      const header = filterButton.closest<HTMLElement>('.mdn-th');
      const tableId = tableIdFromWrap(filterButton);
      const columnIndex = Number.parseInt(header?.dataset.col ?? '', 10);
      if (tableId && Number.isFinite(columnIndex)) {
        win.Table?.showFilterMenu?.(tableId, columnIndex, filterButton);
      }
      return;
    }

    const tableToggle = target.closest<HTMLElement>('.mdn-table-toggle-btn');
    if (tableToggle) {
      event.preventDefault();
      event.stopPropagation();
      const tableId = tableIdFromControl(tableToggle, '-toggle-btn');
      if (tableId) win.Table?.toggleCollapse?.(tableId);
      return;
    }

    const wrapToggle = target.closest<HTMLElement>('.mdn-table-wrap-toggle');
    if (wrapToggle) {
      event.preventDefault();
      event.stopPropagation();
      const tableId = tableIdFromControl(wrapToggle, '-wrap-toggle');
      if (tableId) win.Table?.toggleWrap?.(tableId, wrapToggle);
      return;
    }

    const columnsToggle = target.closest<HTMLElement>('.mdn-table-columns-toggle');
    if (columnsToggle) {
      event.preventDefault();
      event.stopPropagation();
      const tableId = tableIdFromControl(columnsToggle, '-columns-toggle');
      if (tableId) win.Table?.toggleColumnMenu?.(tableId, event);
      return;
    }

    const viewSelect = target.closest<HTMLElement>('.mdn-table-view-select');
    if (viewSelect) {
      event.preventDefault();
      event.stopPropagation();
      const dropdown = viewSelect.closest<HTMLElement>('.mdn-table-view-dropdown');
      const tableId = dropdown?.id.replace(/-view-dropdown$/, '') ?? '';
      if (tableId) win.Table?.toggleViewDropdown?.(tableId, event);
      return;
    }

    const viewOption = target.closest<HTMLElement>('.mdn-table-view-menu__option');
    if (viewOption) {
      event.preventDefault();
      event.stopPropagation();
      if (viewOption.hasAttribute('disabled') || viewOption.getAttribute('aria-disabled') === 'true') return;
      const dropdown = viewOption.closest<HTMLElement>('.mdn-table-view-dropdown');
      const tableId = dropdown?.id.replace(/-view-dropdown$/, '') ?? '';
      const value = viewOption.dataset.value ?? '';
      if (tableId && value) {
        win.Table?.switchView?.(tableId, value);
        win.Table?.closeViewDropdown?.(tableId);
      }
      return;
    }

    const header = target.closest<HTMLElement>('.mdn-th');
    if (header) {
      event.preventDefault();
      event.stopPropagation();
      const tableId = tableIdFromWrap(header);
      const columnIndex = Number.parseInt(header.dataset.col ?? '', 10);
      if (tableId && Number.isFinite(columnIndex)) win.Table?.sort?.(tableId, columnIndex);
      return;
    }

    const sectionHeader = target.closest<HTMLElement>('.mdn-section-header');
    if (sectionHeader && !isInteractiveSectionTarget(target, sectionHeader)) {
      event.preventDefault();
      win.UI?.toggleSection?.(sectionHeader);
    }
  });
}
