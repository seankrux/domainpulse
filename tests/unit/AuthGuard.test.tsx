import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AuthGuard } from '../../components/AuthGuard';
import { AuthProvider } from '../../components/AuthProvider';

/**
 * AuthGuard contract (AGENTS.md §7): the login portal shows ONLY when the
 * server says a password is configured (`/api/auth-status`). Public demo
 * instances (no hash) and status-probe failures render the dashboard
 * directly — front and back must agree so the demo never gets locked out.
 */

const jsonResponse = (body: unknown, ok = true, status = 200) =>
  ({ ok, status, json: async () => body }) as Response;

const mockApi = (routes: Record<string, () => Response | Promise<Response>>) => {
  vi.mocked(global.fetch).mockImplementation(async (input: RequestInfo | URL) => {
    const url = String(input);
    for (const [path, respond] of Object.entries(routes)) {
      if (url.includes(path)) return respond();
    }
    throw new Error(`Unmocked fetch: ${url}`);
  });
};

const renderGuard = () =>
  render(
    <AuthProvider>
      <AuthGuard>
        <div data-testid="dashboard">dashboard</div>
      </AuthGuard>
    </AuthProvider>
  );

describe('AuthGuard', () => {
  beforeEach(() => {
    vi.mocked(global.fetch).mockReset();
    sessionStorage.clear();
    // AuthProvider caches the session in a module-scoped variable that
    // survives across tests; the auth-invalid event is the supported way to
    // clear it. Mount a throwaway provider so the listener is attached.
    mockApi({ '/api/auth-status': () => jsonResponse({ authRequired: false }) });
    const { unmount } = render(<AuthProvider><span /></AuthProvider>);
    fireEvent(window, new Event('domainpulse:auth-invalid'));
    unmount();
    vi.mocked(global.fetch).mockReset();
  });

  it('renders children directly in public mode (authRequired: false)', async () => {
    mockApi({ '/api/auth-status': () => jsonResponse({ authRequired: false }) });
    renderGuard();
    expect(await screen.findByTestId('dashboard')).toBeInTheDocument();
  });

  it('shows the login page when auth is required and there is no session', async () => {
    mockApi({ '/api/auth-status': () => jsonResponse({ authRequired: true }) });
    renderGuard();
    expect(await screen.findByText('Sign in to access your dashboard')).toBeInTheDocument();
    expect(screen.queryByTestId('dashboard')).not.toBeInTheDocument();
  });

  it('fails open to public mode when the status probe errors', async () => {
    mockApi({ '/api/auth-status': () => Promise.reject(new Error('network down')) });
    renderGuard();
    expect(await screen.findByTestId('dashboard')).toBeInTheDocument();
  });

  it('logs in through the portal and reaches the dashboard', async () => {
    mockApi({
      '/api/auth-status': () => jsonResponse({ authRequired: true }),
      '/api/login': () =>
        jsonResponse({ token: 'test-token', expiresAt: Date.now() + 60_000 }),
    });
    renderGuard();

    fireEvent.change(await screen.findByLabelText('Password'), {
      target: { value: 'correct-password' },
    });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByTestId('dashboard')).toBeInTheDocument();
  });

  it('shows an error and stays gated on a rejected password', async () => {
    mockApi({
      '/api/auth-status': () => jsonResponse({ authRequired: true }),
      '/api/login': () => jsonResponse({ error: 'Invalid password' }, false, 401),
    });
    renderGuard();

    fireEvent.change(await screen.findByLabelText('Password'), {
      target: { value: 'wrong-password' },
    });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() =>
      expect(screen.getByText(/invalid password/i)).toBeInTheDocument()
    );
    expect(screen.queryByTestId('dashboard')).not.toBeInTheDocument();
  });
});
