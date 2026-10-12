import { describe, it, expect } from 'vitest';
import { filterAndSortDomains, DEFAULT_DOMAIN_FILTER, DomainFilter } from '../../utils/domainFilters';
import { Domain, DomainStatus, SSLStatus } from '../../types';

function mkDomain(over: Partial<Domain> & { id: string; url: string }): Domain {
  return {
    status: DomainStatus.Alive,
    addedAt: new Date(0),
    history: [],
    tags: [],
    ...over,
  };
}

const withFilter = (over: Partial<DomainFilter>): DomainFilter => ({ ...DEFAULT_DOMAIN_FILTER, ...over });

describe('filterAndSortDomains', () => {
  const a = mkDomain({ id: 'a', url: 'alpha.com', status: DomainStatus.Alive, latency: 30, ssl: { status: SSLStatus.Valid } as Domain['ssl'] });
  const b = mkDomain({ id: 'b', url: 'beta.com', status: DomainStatus.Down, latency: 10, ssl: { status: SSLStatus.Expired } as Domain['ssl'] });
  const c = mkDomain({ id: 'c', url: 'gamma.com', status: DomainStatus.Error, latency: undefined, groupId: 'g1' });
  const all = [a, b, c];

  it('matches the search substring case-insensitively', () => {
    expect(filterAndSortDomains(all, withFilter({ search: 'BETA' }), 'url', 'asc').map(d => d.id)).toEqual(['b']);
  });

  it('trims the search term', () => {
    expect(filterAndSortDomains(all, withFilter({ search: '  alpha ' }), 'url', 'asc').map(d => d.id)).toEqual(['a']);
  });

  it('filters by status, ssl and group together', () => {
    expect(filterAndSortDomains(all, withFilter({ status: DomainStatus.Down }), 'url', 'asc').map(d => d.id)).toEqual(['b']);
    expect(filterAndSortDomains(all, withFilter({ ssl: SSLStatus.Expired }), 'url', 'asc').map(d => d.id)).toEqual(['b']);
    expect(filterAndSortDomains(all, withFilter({ groupId: 'g1' }), 'url', 'asc').map(d => d.id)).toEqual(['c']);
  });

  it('sorts by status using the zero-indexed order map (?? not ||)', () => {
    // Down=0, Error=1, Alive=4 → asc: b, c, a. A `|| fallback` bug would push
    // Down (0) to the fallback rank and break this ordering.
    expect(filterAndSortDomains(all, DEFAULT_DOMAIN_FILTER, 'status', 'asc').map(d => d.id)).toEqual(['b', 'c', 'a']);
  });

  it('sorts by ssl using the zero-indexed order map (Valid=0)', () => {
    // Valid=0, Expired=2, Unknown=4 → asc: a, b, c.
    expect(filterAndSortDomains(all, DEFAULT_DOMAIN_FILTER, 'ssl', 'asc').map(d => d.id)).toEqual(['a', 'b', 'c']);
  });

  it('sorts by expiry using the zero-indexed order map (active=0)', () => {
    const active = mkDomain({ id: 'x', url: 'x.com', expiry: { status: 'active' } as Domain['expiry'] });
    const expired = mkDomain({ id: 'y', url: 'y.com', expiry: { status: 'expired' } as Domain['expiry'] });
    const none = mkDomain({ id: 'z', url: 'z.com' });
    // active=0, expired=2, unknown(default)=3 → asc: x, y, z
    expect(filterAndSortDomains([none, expired, active], DEFAULT_DOMAIN_FILTER, 'expiry', 'asc').map(d => d.id)).toEqual(['x', 'y', 'z']);
  });

  it('sorts latency treating undefined as 0', () => {
    // a=30, b=10, c=undefined(0) → asc: c, b, a
    expect(filterAndSortDomains(all, DEFAULT_DOMAIN_FILTER, 'latency', 'asc').map(d => d.id)).toEqual(['c', 'b', 'a']);
  });

  it('reverses for desc without mutating the input array order', () => {
    const input = [a, b, c];
    const inputCopy = [...input];
    expect(filterAndSortDomains(input, DEFAULT_DOMAIN_FILTER, 'url', 'desc').map(d => d.id)).toEqual(['c', 'b', 'a']);
    // filter() copies before sort, so the caller's array is untouched.
    expect(input).toEqual(inputCopy);
  });

  it('sorts by lastChecked timestamps', () => {
    const old = mkDomain({ id: 'old', url: 'o.com', lastChecked: new Date(1000) });
    const recent = mkDomain({ id: 'recent', url: 'r.com', lastChecked: new Date(5000) });
    const never = mkDomain({ id: 'never', url: 'n.com' });
    expect(filterAndSortDomains([recent, old, never], DEFAULT_DOMAIN_FILTER, 'lastChecked', 'asc').map(d => d.id)).toEqual(['never', 'old', 'recent']);
  });
});
