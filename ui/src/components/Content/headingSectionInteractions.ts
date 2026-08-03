import {
  HEADING_SECTION_STATE_CHANGE_EVENT,
  toggleSection,
} from '../../dom/headingSectionHandlers';
import {
  applyHeadingSectionState,
  captureHeadingSectionState,
  setHeadingSectionExpanded,
  type HeadingSectionState,
} from './enhancements/headingSectionState';

interface HeadingSectionInteractionOptions {
  body: HTMLElement;
  currentFile?: string | null;
  defaultExpanded: boolean;
  stateByFile: Map<string, HeadingSectionState>;
}

export interface HeadingSectionInteractions {
  expandAncestors(target: HTMLElement): void;
  dispose(): void;
}

export function createHeadingSectionInteractions({
  body,
  currentFile,
  defaultExpanded,
  stateByFile,
}: HeadingSectionInteractionOptions): HeadingSectionInteractions {
  const stateKey = currentFile || '__current-document__';

  // Apply initial state without triggering the CSS transform transition.
  // We briefly mark the body with a flag that disables transitions, then
  // restore it in the next animation frame so only user-initiated toggles animate.
  body.classList.add('no-section-transition');
  applyHeadingSectionState(
    body,
    stateByFile.get(stateKey) ?? new Map(),
    defaultExpanded,
  );
  requestAnimationFrame(() => body.classList.remove('no-section-transition'));

  const remember = () => {
    stateByFile.set(stateKey, captureHeadingSectionState(body));
  };
  const handleStateChange = (event: Event) => {
    const section = (event as CustomEvent<{ section?: HTMLElement }>).detail?.section;
    if (!section || body.contains(section)) remember();
  };
  const handleClick = (event: Event) => {
    if (!(event.target instanceof Element)) return;
    const header = event.target.closest<HTMLElement>('.mdn-section-header');
    const control = event.target.closest('.mdn-anchor, .mdn-section-copy-btn');
    if (!header || !body.contains(header) || control) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    toggleSection(header);
  };
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    if (!(event.target instanceof HTMLElement)) return;
    const header = event.target.closest<HTMLElement>('.mdn-section-header');
    const control = event.target.closest('.mdn-anchor, .mdn-section-copy-btn');
    if (!header || !body.contains(header) || control) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    toggleSection(header);
  };

  window.addEventListener(HEADING_SECTION_STATE_CHANGE_EVENT, handleStateChange);
  body.addEventListener('click', handleClick);
  body.addEventListener('keydown', handleKeyDown);

  return {
    expandAncestors(target) {
      let section = target.closest<HTMLElement>('.mdn-section');
      while (section) {
        setHeadingSectionExpanded(section, true);
        section = section.parentElement?.closest<HTMLElement>('.mdn-section') ?? null;
      }
      remember();
    },
    dispose() {
      window.removeEventListener(HEADING_SECTION_STATE_CHANGE_EVENT, handleStateChange);
      body.removeEventListener('click', handleClick);
      body.removeEventListener('keydown', handleKeyDown);
    },
  };
}
