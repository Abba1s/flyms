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
    expect(screen.getByText('Closing in 6 days')).toBeInTheDocument();
  });

  it('shows an opening countdown', () => {
    render(
      <StatusBadge
        status={getIntakeStatus({ start: '2026-11-02', end: '2027-01-15' }, '2026-11-01')}
      />,
    );
    expect(screen.getByText('Upcoming intake')).toBeInTheDocument();
    expect(screen.getByText('· Opens tomorrow')).toBeInTheDocument();
  });

  it('shows open and closed states', () => {
    const { rerender } = render(
      <StatusBadge
        status={getIntakeStatus({ start: '2026-10-01', end: '2027-01-15' }, '2026-11-01')}
      />,
    );
    expect(screen.getByText('Applications open')).toBeInTheDocument();
    expect(screen.getByText('· 75 days left')).toBeInTheDocument();
    rerender(
      <StatusBadge
        status={getIntakeStatus({ start: '2026-04-01', end: '2026-07-15' }, '2026-11-01')}
      />,
    );
    expect(screen.getByText('Applications closed')).toBeInTheDocument();
  });

  it('says "Closes today" on the last day', () => {
    render(
      <StatusBadge
        status={getIntakeStatus({ start: '2026-10-01', end: '2026-11-01' }, '2026-11-01')}
      />,
    );
    expect(screen.getByText('Closes today')).toBeInTheDocument();
  });

  it('labels missing dates', () => {
    render(<StatusBadge status={getIntakeStatus({ start: null, end: null }, '2026-11-01')} />);
    expect(screen.getByText('Dates not published')).toBeInTheDocument();
  });
});
