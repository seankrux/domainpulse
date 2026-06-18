import { describe, it, expect } from 'vitest';
import { createEmailVerifier } from '../../qa/delivery/email';
import { createWebhookVerifier } from '../../qa/delivery/webhook';
import { screenOnlyVerifier } from '../../qa/delivery/screenOnly';
import { FormCheckStatus, type FormResult } from '../../types';

const result = (marker: string, onScreenSuccess = true): FormResult => ({
  pageUrl: 'https://example.com/contact',
  fieldsFilled: 3,
  submitted: true,
  onScreenSuccess,
  marker,
  status: FormCheckStatus.Pass,
});

describe('screenOnlyVerifier', () => {
  it('reflects on-screen success', async () => {
    expect((await screenOnlyVerifier.verifyDelivery(result('QA-1'), { type: 'screen-only' })).delivered).toBe(true);
    expect((await screenOnlyVerifier.verifyDelivery(result('QA-1', false), { type: 'screen-only' })).delivered).toBe(false);
  });
});

describe('emailVerifier (Gmail API, mocked)', () => {
  it('reports delivered when a matching message is found', async () => {
    const fetchImpl = async () => ({ ok: true, status: 200, json: async () => ({ messages: [{ id: 'x' }], resultSizeEstimate: 1 }) });
    const v = createEmailVerifier(fetchImpl, 'fake-token');
    const r = await v.verifyDelivery(result('QA-MARKER-123'), { type: 'email', match: 'QA-MARKER-123' });
    expect(r.delivered).toBe(true);
    expect(r.method).toBe('email');
  });

  it('catches the "fake success but no delivery" case', async () => {
    const fetchImpl = async () => ({ ok: true, status: 200, json: async () => ({ resultSizeEstimate: 0 }) });
    const v = createEmailVerifier(fetchImpl, 'fake-token');
    const r = await v.verifyDelivery(result('QA-X'), { type: 'email' });
    expect(r.delivered).toBe(false);
  });

  it('fails safe with no token', async () => {
    const v = createEmailVerifier(async () => ({ ok: true, status: 200, json: async () => ({}) }), undefined);
    const r = await v.verifyDelivery(result('QA-X'), { type: 'email' });
    expect(r.delivered).toBe(false);
    expect(r.detail).toMatch(/GMAIL_ACCESS_TOKEN/);
  });

  it('handles a non-200 Gmail response', async () => {
    const v = createEmailVerifier(async () => ({ ok: false, status: 401, json: async () => ({}) }), 'fake');
    expect((await v.verifyDelivery(result('QA-X'), { type: 'email' })).delivered).toBe(false);
  });
});

describe('webhookVerifier (mocked)', () => {
  it('finds the marker in the endpoint response', async () => {
    const v = createWebhookVerifier(async () => ({ ok: true, status: 200, text: async () => 'lead body QA-99 here' }));
    expect((await v.verifyDelivery(result('QA-99'), { type: 'webhook', endpoint: 'https://x' })).delivered).toBe(true);
  });

  it('reports not delivered when marker absent', async () => {
    const v = createWebhookVerifier(async () => ({ ok: true, status: 200, text: async () => 'nothing here' }));
    expect((await v.verifyDelivery(result('QA-99'), { type: 'webhook', endpoint: 'https://x' })).delivered).toBe(false);
  });

  it('fails safe with no endpoint', async () => {
    const v = createWebhookVerifier(async () => ({ ok: true, status: 200, text: async () => '' }));
    expect((await v.verifyDelivery(result('QA-99'), { type: 'webhook' })).delivered).toBe(false);
  });
});
