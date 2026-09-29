import { fireEvent, render } from '@testing-library/react';
import { useRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { initialState } from '../../../../ui/src/contexts/appStateModel';
import { useDocumentInteractions } from '../../../../ui/src/components/Content/useDocumentInteractions';

vi.mock('../../../../ui/src/components/Content/scheduleContentEnhancements', () => ({
  scheduleContentEnhancements: () => () => {},
}));

const HTML = `
  <section class="mdn-section" id="intro" data-expanded="true">
    <div class="mdn-section-header" role="button" tabindex="0">Intro</div>
    <div class="mdn-section-body">
      <p>Body</p>
      <img src="a.png">
      <a href="#intro">self</a>
      <div class="mdn-codeblock"><button class="mdn-open-modal-btn">modal</button></div>
    </div>
  </section>`;

type Callbacks = ReturnType<typeof callbacks>;

function callbacks() {
  return {
    onImageClick: vi.fn(),
    navigate: vi.fn(),
    onOpenHtmlModal: vi.fn(),
    onOpenLinkMenu: vi.fn(),
    onActionError: vi.fn(),
  };
}

const bridge = { postMessage: vi.fn() };
const labels = { openError: 'err', modalTitle: 'm' } as any;

function Harness({ rootId, filePath, cb }: { rootId: 'primary' | 'secondary'; filePath: string; cb: Callbacks }) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  useDocumentInteractions({
    state: initialState,
    document: { rootId, filePath, renderVersion: 1, disabled: false },
    bodyRef,
    scrollRef,
    bridge,
    previewLabels: labels,
    ...cb,
  });
  return (
    <div ref={scrollRef}>
      <div ref={bodyRef} data-document-root={rootId} className="mdn-body" dangerouslySetInnerHTML={{ __html: HTML }} />
    </div>
  );
}

function roots(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>('[data-document-root]'));
}

describe('useDocumentInteractions', () => {
  it('collapses a section only in its own pane', () => {
    const { container } = render(<>
      <Harness rootId="primary" filePath="/a.md" cb={callbacks()} />
      <Harness rootId="secondary" filePath="/a.md" cb={callbacks()} />
    </>);
    const [primary, secondary] = roots(container);
    fireEvent.click(secondary.querySelector('.mdn-section-header')!);
    expect(secondary.querySelector<HTMLElement>('.mdn-section')!.dataset.expanded).toBe('false');
    expect(primary.querySelector<HTMLElement>('.mdn-section')!.dataset.expanded).not.toBe('false');
  });

  it('routes image clicks to the callbacks of the clicked pane', () => {
    const a = callbacks();
    const b = callbacks();
    const { container } = render(<>
      <Harness rootId="primary" filePath="/a.md" cb={a} />
      <Harness rootId="secondary" filePath="/b.md" cb={b} />
    </>);
    fireEvent.click(roots(container)[1].querySelector('img')!);
    expect(b.onImageClick).toHaveBeenCalledTimes(1);
    expect(a.onImageClick).not.toHaveBeenCalled();
  });

  it('opens the HTML modal from the clicked pane', () => {
    const a = callbacks();
    const b = callbacks();
    const { container } = render(<>
      <Harness rootId="primary" filePath="/a.md" cb={a} />
      <Harness rootId="secondary" filePath="/b.md" cb={b} />
    </>);
    fireEvent.click(roots(container)[1].querySelector('.mdn-open-modal-btn')!);
    expect(a.onOpenHtmlModal).not.toHaveBeenCalled();
    expect(b.onOpenHtmlModal.mock.calls.length + b.onActionError.mock.calls.length).toBe(1);
  });

  it('opens a link context menu resolved against the pane file', () => {
    const b = callbacks();
    const { container } = render(<Harness rootId="secondary" filePath="/docs/b.md" cb={b} />);
    fireEvent.contextMenu(container.querySelector('a')!);
    expect(b.onOpenLinkMenu).toHaveBeenCalledTimes(1);
  });
});
