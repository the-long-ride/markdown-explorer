import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DocumentDiffView } from '../../../../ui/src/components/History/DocumentDiffView';

describe('rendered diff view', () => {
  it('renders both complete markdown documents', () => {
    render(<DocumentDiffView leftSource={'# A\n\nold'} rightSource={'# A\n\nnew'} leftLabel="old" rightLabel="current" defaultMode="rendered" />);
    expect(screen.getAllByRole('heading', { name: 'A' })).toHaveLength(2);
    expect(screen.getByText('old')).toBeInTheDocument();
    expect(screen.getByText('new')).toBeInTheDocument();
  });
});
