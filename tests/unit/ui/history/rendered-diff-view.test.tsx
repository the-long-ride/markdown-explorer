import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DocumentDiffView } from '../../../../ui/src/components/History/DocumentDiffView';
import { RenderedDiffView } from '../../../../ui/src/components/History/RenderedDiffView';

describe('rendered diff view', () => {
  it('renders both complete markdown documents', () => {
    render(<DocumentDiffView leftSource={'# A\n\nold'} rightSource={'# A\n\nnew'} leftLabel="old" rightLabel="current" defaultMode="rendered" />);
    expect(screen.getAllByRole('heading', { name: 'A' })).toHaveLength(2);
    expect(screen.getByText('old')).toBeInTheDocument();
    expect(screen.getByText('new')).toBeInTheDocument();
  });

  it('preserves .is-diff-changed highlights when an ancestor re-renders (e.g. dark/light theme switch)', () => {
    function ThemeWrapper() {
      const [theme, setTheme] = useState<'dark' | 'light'>('dark');
      return (
        <div data-theme={theme}>
          <button type="button" onClick={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}>
            Toggle theme
          </button>
          <RenderedDiffView
            leftSource={'# Title\n\n## Intro\n\nsame'}
            rightSource={'# Title\n\n## Intro\n\nsame\n\n## External Links\n\n- [Example](https://example.com)'}
            language="en"
          />
        </div>
      );
    }

    const { container } = render(<ThemeWrapper />);
    const initialCount = container.querySelectorAll('.is-diff-changed').length;
    expect(initialCount).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Toggle theme' }));

    expect(container.querySelector('[data-theme]')).toHaveAttribute('data-theme', 'light');
    expect(container.querySelectorAll('.is-diff-changed').length).toBe(initialCount);
  });
});
