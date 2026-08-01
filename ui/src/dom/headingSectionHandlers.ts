import { setHeadingSectionExpanded } from '../components/Content/enhancements/headingSectionState';

export const HEADING_SECTION_STATE_CHANGE_EVENT = 'markdown-explorer-heading-state-change';

function notifyHeadingSectionStateChange(section: HTMLElement): void {
  window.dispatchEvent(new CustomEvent(HEADING_SECTION_STATE_CHANGE_EVENT, {
    detail: {
      section,
      expanded: section.dataset.expanded !== 'false',
    },
  }));
}

export function toggleSection(headerEl: HTMLElement): void {
  const section = headerEl.closest<HTMLElement>('.mdn-section');
  if (!section) return;
  const expanded = section.dataset.expanded !== 'true';
  setHeadingSectionExpanded(section, expanded);
  headerEl.setAttribute('aria-expanded', String(expanded));
  notifyHeadingSectionStateChange(section);
}

export function expandAll(): void {
  document.querySelectorAll<HTMLElement>('.mdn-section').forEach((section) => {
    setHeadingSectionExpanded(section, true);
    notifyHeadingSectionStateChange(section);
  });
}

export function collapseAll(): void {
  document.querySelectorAll<HTMLElement>('.mdn-section').forEach((section) => {
    setHeadingSectionExpanded(section, false);
    notifyHeadingSectionStateChange(section);
  });
}
