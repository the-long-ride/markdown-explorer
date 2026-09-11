import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DocumentDiffView } from '../../../../ui/src/components/History/DocumentDiffView';

describe('source diff view', () => {
  it('exposes additions and removals with semantic labels', () => {
    render(<DocumentDiffView leftSource={'# A\nold'} rightSource={'# A\nnew'} leftLabel="old" rightLabel="current" defaultMode="source" />);
    expect(screen.getByText('old').closest('[data-diff-type]')).toHaveAttribute('data-diff-type', 'remove');
    expect(screen.getByText('new').closest('[data-diff-type]')).toHaveAttribute('data-diff-type', 'add');
    expect(screen.getByText('Removed')).toBeInTheDocument();
    expect(screen.getByText('Added')).toBeInTheDocument();
  });
});
