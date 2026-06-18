import type { DeliveryResult, FormResult } from '../../types';
import type { DeliveryConfig, DeliveryVerifier } from './types';

/** Injectable fetch so tests can mock the endpoint without a network. */
export type FetchLike = (
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string }
) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

/**
 * Webhook verifier: queries a webhook/endpoint log (GET) or posts the marker
 * (POST) and confirms the marker is present in the response. The marker proves
 * the submission actually reached the destination, catching forms that show a
 * fake success without delivering.
 */
export function createWebhookVerifier(fetchImpl?: FetchLike): DeliveryVerifier {
  const doFetch: FetchLike = fetchImpl ?? ((url, init) => fetch(url, init) as unknown as ReturnType<FetchLike>);

  return {
    async verifyDelivery(result: FormResult, cfg: DeliveryConfig): Promise<DeliveryResult> {
      if (!cfg?.endpoint) {
        return { method: 'webhook', delivered: false, detail: 'No webhook endpoint configured.' };
      }
      const match = cfg.match || result.marker;
      try {
        const resp = await doFetch(cfg.endpoint, { method: 'GET' });
        if (!resp.ok) {
          return {
            method: 'webhook',
            delivered: false,
            detail: `Endpoint returned ${resp.status}.`,
          };
        }
        const body = await resp.text();
        const delivered = body.includes(match);
        return {
          method: 'webhook',
          delivered,
          detail: delivered
            ? `Marker "${match}" found at endpoint.`
            : `Marker "${match}" not found at endpoint.`,
        };
      } catch (err) {
        return {
          method: 'webhook',
          delivered: false,
          detail: `Webhook query failed: ${(err as Error).message}`,
        };
      }
    },
  };
}
