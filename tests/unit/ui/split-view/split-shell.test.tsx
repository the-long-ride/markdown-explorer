import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SplitDivider } from '../../../../ui/src/components/Content/SplitDivider';
import { SplitDocumentView } from '../../../../ui/src/components/Content/SplitDocumentView';

describe('SplitDivider', () => {
  it('supports keyboard ratio adjustment and limits', () => {
    const onRatioChange = vi.fn();
    const { rerender } = render(<SplitDivider ratio={0.5} onRatioChange={onRatioChange} />);
    const divider = screen.getByRole('separator', { name: /resize document panes/i });
    fireEvent.keyDown(divider, { key: 'ArrowRight' });
    expect(onRatioChange).toHaveBeenCalledWith(0.52);

    rerender(<SplitDivider ratio={0.5} onRatioChange={onRatioChange} />);
    fireEvent.keyDown(divider, { key: 'Home' });
    expect(onRatioChange).toHaveBeenCalledWith(0.25);
    fireEvent.keyDown(divider, { key: 'End' });
    expect(onRatioChange).toHaveBeenCalledWith(0.75);
  });

  it('resizes from pointer movement inside the split container', () => {
    const onRatioChange = vi.fn();
    render(
      <div data-testid="split-root">
        <SplitDivider ratio={0.5} onRatioChange={onRatioChange} />
      </div>,
    );
    const root = screen.getByTestId('split-root');
    vi.spyOn(root, 'getBoundingClientRect').mockReturnValue({
      x: 100, y: 0, left: 100, top: 0, right: 1100, bottom: 500,
      width: 1000, height: 500, toJSON: () => ({}),
    });
    const divider = screen.getByRole('separator', { name: /resize document panes/i });
    fireEvent.pointerDown(divider, { pointerId: 7, clientX: 600 });
    fireEvent.pointerMove(window, { pointerId: 7, clientX: 700 });
    expect(onRatioChange).toHaveBeenCalledWith(0.6);
    fireEvent.pointerUp(window, { pointerId: 7, clientX: 700 });
  });
});

describe('SplitDocumentView', () => {
  it('renders exactly two selectable document regions and a divider', () => {
    const onActivatePane = vi.fn();
    render(
      <SplitDocumentView
        ratio={0.4}
        activePane="primary"
        primary={<div>Alpha</div>}
        secondary={<div>Beta</div>}
        onActivatePane={onActivatePane}
        onRatioChange={vi.fn()}
        onCloseSecondary={vi.fn()}
      />,
    );
    expect(screen.getAllByRole('region')).toHaveLength(2);
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
    expect(screen.getByRole('separator')).toBeInTheDocument();

    fireEvent.pointerDown(screen.getByRole('region', { name: /secondary document/i }));
    expect(onActivatePane).toHaveBeenCalledWith('secondary');
  });

  it('exposes a close action for the secondary pane', () => {
    const onCloseSecondary = vi.fn();
    render(
      <SplitDocumentView
        ratio={0.5}
        activePane="secondary"
        primary={<div>Alpha</div>}
        secondary={<div>Beta</div>}
        onActivatePane={vi.fn()}
        onRatioChange={vi.fn()}
        onCloseSecondary={onCloseSecondary}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /close secondary pane/i }));
    expect(onCloseSecondary).toHaveBeenCalledTimes(1);
  });
});
