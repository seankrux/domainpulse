import type { DeliveryResult, FormResult } from '../../types';
import type { DeliveryConfig, DeliveryVerifier } from './types';

/** Injectable fetch so tests can mock the Gmail API without a network. */
export type FetchLike = (
  url: string,
  init?: { method?: string; headers?: Record<string, string> }
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

/**
 * Email verifier (Gmail API). Confirms the form's unique marker actually
 * arrived in an inbox — this is what catches a form that shows a fake success
 * but never delivers.
 *
 * Auth: provide a Gmail OAuth access token via env `GMAIL_ACCESS_TOKEN`
 * (scope: gmail.readonly). No extra dependency — uses the Gmail REST API over
 * fetch. The token can be minted from a refresh token in CI; keep it in
 * GitHub Actions / Vercel secrets, never in the repo.
 *
 * Config: `delivery.match` (defaults to the form marker) is the search term;
 * `delivery.inbox` is informational. We search the last day to avoid stale hits.
 */
export function createEmailVerifier(fetchImpl?: FetchLike, token?: string): DeliveryVerifier {
  const doFetch: FetchLike =
    fetchImpl ?? ((url, init) => fetch(url, init) as unknown as ReturnType<FetchLike>);
  const accessToken = token ?? process.env.GMAIL_ACCESS_TOKEN;

  return {
    async verifyDelivery(result: FormResult, cfg: DeliveryConfig): Promise<DeliveryResult> {
      if (!accessToken) {
        return {
          method: 'email',
          delivered: false,
          detail: 'No GMAIL_ACCESS_TOKEN set — cannot verify inbox delivery.',
        };
      }
      const match = cfg?.match || result.marker;
      const query = encodeURIComponent(`"${match}" newer_than:1d`);
      const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${query}`;
      try {
        const resp = await doFetch(url, {
          method: 'GET',
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!resp.ok) {
          return { method: 'email', delivered: false, detail: `Gmail API returned ${resp.status}.` };
        }
        const data = (await resp.json()) as { messages?: unknown[]; resultSizeEstimate?: number };
        const count = data.messages?.length ?? data.resultSizeEstimate ?? 0;
        const delivered = count > 0;
        return {
          method: 'email',
          delivered,
          detail: delivered
            ? `Found ${count} message(s) matching "${match}" in inbox.`
            : `No inbox message matching "${match}" within the last day.`,
        };
      } catch (err) {
        return {
          method: 'email',
          delivered: false,
          detail: `Gmail query failed: ${(err as Error).message}`,
        };
      }
    },
  };
}
