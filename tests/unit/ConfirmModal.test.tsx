import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConfirmModal } from '../../components/Dashboard/ConfirmModal';

describe('ConfirmModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onConfirm: vi.fn(),
    title: 'Test Title',
    message: 'Test message'
  };

  it('should not render when isOpen is false', () => {
    render(<ConfirmModal {...defaultProps} isOpen={false} />);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('should render title and message', () => {
    render(<ConfirmModal {...defaultProps} />);
    expect(screen.getByText('Test Title')).toBeInTheDocument();
    expect(screen.getByText('Test message')).toBeInTheDocument();
  });

  it('should call onConfirm when confirm button clicked', async () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    render(
      <ConfirmModal 
        {...defaultProps} 
        onConfirm={onConfirm}
        onClose={onClose}
        confirmText="Confirm"
      />
    );
    
    fireEvent.click(screen.getByText('Confirm'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should call onClose when cancel button clicked', () => {
    const onClose = vi.fn();
    render(<ConfirmModal {...defaultProps} onClose={onClose} cancelText="Cancel" />);
    
    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should call onClose when backdrop clicked', () => {
    const onClose = vi.fn();
    render(<ConfirmModal {...defaultProps} onClose={onClose} />);
    
    fireEvent.click(screen.getByRole('presentation'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should use danger variant styles', () => {
    render(<ConfirmModal {...defaultProps} variant="danger" />);
    const confirmButton = screen.getByText('Confirm');
    expect(confirmButton).toHaveClass('bg-rose-600');
  });

  it('should use warning variant styles', () => {
    render(<ConfirmModal {...defaultProps} variant="warning" />);
    const confirmButton = screen.getByText('Confirm');
    expect(confirmButton).toHaveClass('bg-amber-600');
  });

  it('should use info variant styles', () => {
    render(<ConfirmModal {...defaultProps} variant="info" />);
    const confirmButton = screen.getByText('Confirm');
    expect(confirmButton).toHaveClass('bg-indigo-600');
  });

  it('should display custom confirm and cancel text', () => {
    render(
      <ConfirmModal 
        {...defaultProps} 
        confirmText="Delete"
        cancelText="Go Back"
      />
    );
    expect(screen.getByText('Delete')).toBeInTheDocument();
    expect(screen.getByText('Go Back')).toBeInTheDocument();
  });

  it('should have proper ARIA attributes', () => {
    render(<ConfirmModal {...defaultProps} />);
    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'confirm-title');
    expect(dialog).toHaveAttribute('aria-describedby', 'confirm-description');
  });
});
