import type { DeliveryResult, FormResult } from '../../types';
import type { DeliveryConfig, DeliveryVerifier } from './types';

/**
 * Screen-only verifier: reflects on-screen success only. Does NOT independently
 * confirm the message reached any destination — it cannot catch a "shows
 * success but never delivers" lie. Use a webhook/email verifier for that.
 */
export const screenOnlyVerifier: DeliveryVerifier = {
  async verifyDelivery(result: FormResult, _cfg: DeliveryConfig): Promise<DeliveryResult> {
    void _cfg;
    return {
      method: 'screen-only',
      delivered: result.onScreenSuccess,
      detail: result.onScreenSuccess
        ? 'On-screen success detected (no destination verification).'
        : 'No on-screen success detected.',
    };
  },
};
