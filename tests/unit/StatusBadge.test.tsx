import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBadge } from '../../components/StatusBadge/StatusBadge';
import { DomainStatus } from '../../types';

describe('StatusBadge (AGENTS.md §3 liveness display contract)', () => {
  it('shows HTTP code only for Alive', () => {
    render(<StatusBadge status={DomainStatus.Alive} statusCode={200} />);
    expect(screen.getByText('200 OK')).toBeInTheDocument();
  });

  it('shows HTTP code only for Down', () => {
    render(<StatusBadge status={DomainStatus.Down} statusCode={503} />);
    expect(screen.getByText('503')).toBeInTheDocument();
  });

  it('does not show stale HTTP code for Error', () => {
    render(<StatusBadge status={DomainStatus.Error} statusCode={200} />);
    expect(screen.queryByText('200 OK')).not.toBeInTheDocument();
    expect(screen.getByText('Error')).toBeInTheDocument();
  });

  it('does not show stale HTTP code for Unknown', () => {
    render(<StatusBadge status={DomainStatus.Unknown} statusCode={200} />);
    expect(screen.queryByText('200 OK')).not.toBeInTheDocument();
    expect(screen.getByText('Unknown')).toBeInTheDocument();
  });

  it('shows Checking label without HTTP code', () => {
    render(<StatusBadge status={DomainStatus.Checking} statusCode={200} />);
    expect(screen.getByText('Checking...')).toBeInTheDocument();
    expect(screen.queryByText('200 OK')).not.toBeInTheDocument();
  });
});
