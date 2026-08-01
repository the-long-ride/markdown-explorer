export type HeadingSectionState = Map<string, boolean>;

export function getHeadingSectionKey(section: HTMLElement, index: number): string {
  return section.id || section.dataset.sectionKey || `section-${index}`;
}

export function setHeadingSectionExpanded(section: HTMLElement, expanded: boolean): void {
  section.dataset.expanded = String(expanded);
  section.querySelector<HTMLElement>('.mdn-section-header')
    ?.setAttribute('aria-expanded', String(expanded));
}

export function captureHeadingSectionState(root: ParentNode): HeadingSectionState {
  const state = new Map<string, boolean>();
  root.querySelectorAll<HTMLElement>('.mdn-section').forEach((section, index) => {
    state.set(getHeadingSectionKey(section, index), section.dataset.expanded !== 'false');
  });
  return state;
}

export function applyHeadingSectionState(
  root: ParentNode,
  saved: ReadonlyMap<string, boolean>,
  defaultExpanded: boolean,
): void {
  root.querySelectorAll<HTMLElement>('.mdn-section').forEach((section, index) => {
    const key = getHeadingSectionKey(section, index);
    const expanded = saved.get(key) ?? defaultExpanded;
    setHeadingSectionExpanded(section, expanded);
  });
}
