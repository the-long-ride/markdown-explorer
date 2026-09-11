import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GitRevisionView } from '../../../../ui/src/components/History/GitRevisionView';

describe('GitRevisionView', () => {
  it('renders historical markdown without editing controls', () => {
    render(<GitRevisionView snapshot={{ oid: 'a'.repeat(40), path: 'docs/a.md', source: '# Old\n\nHistorical text.' }} />);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Old' })).toBeInTheDocument();
    expect(screen.getByText('Historical text.')).toBeInTheDocument();
  });
});
