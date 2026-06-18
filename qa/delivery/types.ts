import type { DeliveryResult, FormResult, QaSiteConfig } from '../../types';

export type DeliveryConfig = NonNullable<NonNullable<QaSiteConfig['qa']>['form']>['delivery'];

/** Common interface every delivery verifier implements. */
export interface DeliveryVerifier {
  verifyDelivery(result: FormResult, cfg: DeliveryConfig): Promise<DeliveryResult>;
}
