import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsVersionFooter } from '../../../../ui/src/components/Settings/SettingsVersionFooter';

afterEach(() => vi.restoreAllMocks());

describe('SettingsVersionFooter', () => {
  it('renders the version link and a donate button beside it', () => {
    const onOpenChangelog = vi.fn();
    const onOpenDonate = vi.fn();
    render(<SettingsVersionFooter versionLabel="v1.6.9" changelogTooltip="Open changelog" language="en" onOpenChangelog={onOpenChangelog} onOpenDonate={onOpenDonate} />);

    fireEvent.click(screen.getByText('v1.6.9'));
    expect(onOpenChangelog).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('Donate'));
    expect(onOpenDonate).toHaveBeenCalledWith('https://github.com/the-long-ride#donate');
  });

  it('localizes the donate label and falls back to window.open without a host opener', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    render(<SettingsVersionFooter versionLabel="" changelogTooltip="" language="vi" onOpenChangelog={vi.fn()} />);

    expect(document.querySelector('.settings-navigation__version')).toBeNull();
    fireEvent.click(screen.getByText('Ủng hộ'));
    expect(open).toHaveBeenCalledWith('https://github.com/the-long-ride#donate', '_blank', 'noopener,noreferrer');
  });
});
