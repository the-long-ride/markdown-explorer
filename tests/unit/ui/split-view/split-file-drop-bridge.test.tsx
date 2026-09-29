import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { requestOpenInSplit } from '../../../../ui/src/components/Content/documentFileDrop';
import { setSplitDropHandler } from '../../../../ui/src/split-view/splitPointerDrag';

const dispatch = vi.fn();
const postMessage = vi.fn();
const appState = vi.hoisted(() => ({ splitEnabled: true }));

vi.mock('../../../../ui/src/contexts/AppStateContext', () => ({
  useAppState: () => ({
    state: { splitView: { enabled: appState.splitEnabled }, contentTabs: [] },
    dispatch,
    navigate: vi.fn(),
  }),
}));
vi.mock('../../../../ui/src/contexts/PlatformContext', () => ({
  usePlatform: () => ({ postMessage }),
}));

import { DocumentFileDragBridge } from '../../../../ui/src/AppShell';

const originalElementFromPoint = document.elementFromPoint;

function markup() {
  return (
    <>
      <div className="tree-file" data-path="/docs/z.md" data-filename="z.md" data-testid="row">z.md</div>
      <section className="split-document-pane" data-pane-id="secondary">
        <div className="split-document-pane__scroll"><p data-testid="body">body</p></div>
      </section>
    </>
  );
}

function pointer(type: string, x: number) {
  return new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX: x, clientY: 5 });
}

afterEach(() => {
  document.elementFromPoint = originalElementFromPoint;
  appState.splitEnabled = true;
  dispatch.mockClear();
  postMessage.mockClear();
});

describe('DocumentFileDragBridge', () => {
  it('drags a sidebar file into the split pane under the pointer', () => {
    const onDrop = vi.fn();
    const unregister = setSplitDropHandler(onDrop);
    const { getByTestId } = render(<><DocumentFileDragBridge />{markup()}</>);
    document.elementFromPoint = vi.fn(() => getByTestId('body'));

    getByTestId('row').dispatchEvent(pointer('pointerdown', 0));
    window.dispatchEvent(pointer('pointermove', 40));
    expect(document.querySelector('.tab-drag-ghost')?.textContent).toBe('z.md');
    window.dispatchEvent(pointer('pointerup', 40));

    expect(onDrop).toHaveBeenCalledWith({ kind: 'document', filePath: '/docs/z.md' }, { paneId: 'secondary', zone: 'pane' });
    unregister();
  });

  it('does not start a file drag when split view is closed', () => {
    appState.splitEnabled = false;
    const onDrop = vi.fn();
    const unregister = setSplitDropHandler(onDrop);
    const { getByTestId } = render(<><DocumentFileDragBridge />{markup()}</>);
    document.elementFromPoint = vi.fn(() => getByTestId('body'));

    getByTestId('row').dispatchEvent(pointer('pointerdown', 0));
    window.dispatchEvent(pointer('pointermove', 40));
    window.dispatchEvent(pointer('pointerup', 40));

    expect(onDrop).not.toHaveBeenCalled();
    unregister();
  });

  it('opens a document in the secondary pane on open-in-split requests', () => {
    render(<DocumentFileDragBridge />);
    requestOpenInSplit('/docs/z.md');
    expect(dispatch).toHaveBeenCalledWith({ type: 'OPEN_SPLIT_VIEW', filePath: '/docs/z.md' });
    expect(dispatch).toHaveBeenCalledWith({ type: 'SET_SPLIT_PANE_FILE', paneId: 'secondary', filePath: '/docs/z.md' });
    expect(postMessage).toHaveBeenCalledWith({ command: 'navigate', path: '/docs/z.md' });
  });
});
