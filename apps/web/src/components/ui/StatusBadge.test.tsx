import { getIntakeStatus } from '@flyms/shared';
import { render, screen } from '@testing-library/react';
import { StatusBadge } from './StatusBadge';

describe('StatusBadge', () => {
  it('shows label and countdown text, not just colour', () => {
    render(
      <StatusBadge
        status={getIntakeStatus({ start: '2026-10-01', end: '2026-11-07' }, '2026-11-01')}
      />,
    );
    expect(screen.getByText('Closing soon')).toBeInTheDocument();
    expect(screen.getByText('· 6 days left')).toBeInTheDocument();
  });

  it('shows an opening countdown', () => {
    render(
      <StatusBadge
        status={getIntakeStatus({ start: '2026-11-02', end: '2027-01-15' }, '2026-11-01')}
      />,
    );
    expect(screen.getByText('Opening soon')).toBeInTheDocument();
    expect(screen.getByText('· Opens tomorrow')).toBeInTheDocument();
  });

  it('labels missing dates', () => {
    render(<StatusBadge status={getIntakeStatus({ start: null, end: null }, '2026-11-01')} />);
    expect(screen.getByText('Dates not published')).toBeInTheDocument();
  });
});
