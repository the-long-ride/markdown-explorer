import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LinkContextMenu } from '../../../../ui/src/components/shared/LinkContextMenu';

const link = {
  raw: './guide.md',
  resolved: 'file:///docs/guide.md',
  kind: 'file' as const,
  openable: true,
  copyable: true,
};

describe('LinkContextMenu scope action', () => {
  it('invokes Open as scope without invoking normal browser open', () => {
    const onOpenScope = vi.fn();
    const onOpen = vi.fn();
    render(
      <LinkContextMenu
        state={{ x: 20, y: 20, link }}
        menuLabel="Link menu"
        openLabel="Open in browser"
        copyLabel="Copy link"
        scopeLabel="Open as scope"
        onOpenScope={onOpenScope}
        onOpen={onOpen}
        onClose={() => {}}
      />,
    );

    fireEvent.click(screen.getByText('Open as scope'));
    expect(onOpenScope).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('does not render the scope action when the link is not eligible', () => {
    render(
      <LinkContextMenu
        state={{ x: 20, y: 20, link }}
        menuLabel="Link menu"
        openLabel="Open in browser"
        copyLabel="Copy link"
        onOpen={() => {}}
        onClose={() => {}}
      />,
    );

    expect(screen.queryByText('Open as scope')).toBeNull();
  });
});
