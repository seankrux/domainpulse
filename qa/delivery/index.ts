import type { DeliveryResult, FormResult } from '../../types';
import type { DeliveryConfig, DeliveryVerifier } from './types';
import { screenOnlyVerifier } from './screenOnly';
import { createWebhookVerifier } from './webhook';
import { createEmailVerifier } from './email';

export type { DeliveryVerifier, DeliveryConfig } from './types';
export { screenOnlyVerifier } from './screenOnly';
export { createWebhookVerifier } from './webhook';
export { createEmailVerifier } from './email';

/**
 * CRM verifier is intentionally stubbed — it requires external credentials
 * (HubSpot/Zoho tokens) that are unconfirmed. It conforms to DeliveryVerifier
 * so adding a real implementation later is a one-file change.
 * Email is implemented via the Gmail API (needs env GMAIL_ACCESS_TOKEN).
 */
const stubVerifier = (method: DeliveryResult['method']): DeliveryVerifier => ({
  async verifyDelivery(_result: FormResult, _cfg: DeliveryConfig): Promise<DeliveryResult> {
    void _result;
    void _cfg;
    return {
      method,
      delivered: false,
      detail: `TODO: ${method} delivery verifier not implemented (pending credentials).`,
    };
  },
});

/** Select a delivery verifier by cfg.type. Defaults to screen-only. */
export function selectVerifier(cfg: DeliveryConfig): DeliveryVerifier {
  switch (cfg?.type) {
    case 'webhook':
      return createWebhookVerifier();
    case 'email':
      return createEmailVerifier();
    case 'crm':
      return stubVerifier('crm');
    case 'screen-only':
    default:
      return screenOnlyVerifier;
  }
}
