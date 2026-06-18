import { describe, it, expect } from 'vitest';
import { lookupGmb } from '../../api/_utils/gmbLookup';
import { mergeQaResults } from '../../utils/qaResults';
import { Domain, DomainStatus, FormCheckStatus, CallCheckStatus } from '../../types';

describe('lookupGmb', () => {
  it('degrades to UNKNOWN with a message when no API key is configured', async () => {
    // Pass '' explicitly: an explicit `undefined` would trigger the default
    // param (process.env.GOOGLE_PLACES_API_KEY) and make this env-dependent.
    const res = await lookupGmb({ placeId: 'ChIJxyz' }, '');
    expect(res.status).toBe('UNKNOWN');
    expect(res.error).toMatch(/GOOGLE_PLACES_API_KEY/);
  });
});

describe('mergeQaResults', () => {
  const baseDomain = (url: string): Domain => ({
    id: url,
    url,
    status: DomainStatus.Alive,
    addedAt: new Date(),
    history: [],
    tags: [],
  });

  it('returns the same list when there are no results', () => {
    const domains = [baseDomain('example.com')];
    expect(mergeQaResults(domains, new Map())).toBe(domains);
  });

  it('merges form/call results onto matching domains (normalizing www + protocol)', () => {
    const domains = [baseDomain('https://www.example.com'), baseDomain('other.com')];
    const results = new Map([
      ['example.com', {
        formCheck: { status: FormCheckStatus.Pass, results: [] },
        callCheck: { status: CallCheckStatus.NoButtons, results: [] },
      }],
    ]);
    const merged = mergeQaResults(domains, results);
    expect(merged[0]?.formCheck?.status).toBe(FormCheckStatus.Pass);
    expect(merged[0]?.callCheck?.status).toBe(CallCheckStatus.NoButtons);
    expect(merged[1]?.formCheck).toBeUndefined();
  });
});
