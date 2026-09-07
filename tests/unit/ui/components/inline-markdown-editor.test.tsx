import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InlineMarkdownEditor } from '../../../../ui/src/components/Content/InlineMarkdownEditor';

const labels = {
  sourceLabel: 'Markdown source block',
  apply: 'Apply',
  cancel: 'Cancel',
};

function createTarget() {
  const target = document.createElement('p');
  target.setAttribute('data-mdn-source-start', '5');
  target.setAttribute('data-mdn-source-end', '9');
  target.textContent = 'Text';
  document.body.appendChild(target);
  return target;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('InlineMarkdownEditor', () => {
  it('edits the exact source slice and applies without saving to disk', () => {
    const target = createTarget();
    const onApply = vi.fn();
    const onCancel = vi.fn();

    render(
      <InlineMarkdownEditor
        target={target}
        source={'# A\n\nText\nEnd'}
        labels={labels}
        onApply={onApply}
        onCancel={onCancel}
      />,
    );

    const editor = screen.getByRole('textbox', { name: labels.sourceLabel });
    expect(editor).toHaveValue('Text');
    expect(target).toHaveClass('is-inline-editing');

    fireEvent.change(editor, { target: { value: 'Next' } });
    fireEvent.click(screen.getByRole('button', { name: labels.apply }));

    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply).toHaveBeenCalledWith('Next', { start: 5, end: 9 });
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('cancels without applying the draft', () => {
    const target = createTarget();
    const onApply = vi.fn();
    const onCancel = vi.fn();

    render(
      <InlineMarkdownEditor
        target={target}
        source={'# A\n\nText\nEnd'}
        labels={labels}
        onApply={onApply}
        onCancel={onCancel}
      />,
    );

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Changed' } });
    fireEvent.click(screen.getByRole('button', { name: labels.cancel }));

    expect(onApply).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('renders nothing when the selected DOM range is stale', () => {
    const target = document.createElement('p');
    target.setAttribute('data-mdn-source-start', '5');
    target.setAttribute('data-mdn-source-end', '99');
    document.body.appendChild(target);

    const { container } = render(
      <InlineMarkdownEditor
        target={target}
        source={'# A\n\nText'}
        labels={labels}
        onApply={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(target).not.toHaveClass('is-inline-editing');
  });
});
