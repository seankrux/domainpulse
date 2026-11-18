import { describe, it, expect } from 'vitest';
import worker from '../../cloudflare/redirect-worker';

describe('original production hostname redirect', () => {
  it('preserves the original 308 root-to-www redirect and complete path/query', () => {
    const response = worker.fetch(new Request('https://domainpulse.seanguillermo.com/app?view=ssl&domain=example.com'));
    expect(response.status).toBe(308);
    expect(response.headers.get('Location')).toBe('https://www.domainpulse.seanguillermo.com/app?view=ssl&domain=example.com');
  });
  it('pins HTTPS and the production hostname without retaining a development port', () => {
    const response = worker.fetch(new Request('http://untrusted.example:8787/api/check?url=example.com'));
    expect(response.headers.get('Location')).toBe('https://www.domainpulse.seanguillermo.com/api/check?url=example.com');
  });
});
