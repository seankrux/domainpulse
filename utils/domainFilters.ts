import { Domain, DomainStatus, SSLStatus, SortField, SortOrder } from '../types';

/**
 * Pure filtering + sorting for the domain table (`App.tsx → displayDomains`).
 *
 * Extracted so the ordering contract (AGENTS.md §4) is unit-testable without
 * rendering the app. The sort comparators MUST use `??`, not `||`, for the
 * order lookups — those maps are zero-indexed (`Valid: 0`, `active: 0`), and
 * `0 || fallback` would wrongly yield the fallback.
 */

export interface DomainFilter {
  search: string;
  status: DomainStatus | 'ALL';
  ssl: SSLStatus | 'ALL';
  groupId: string | 'ALL';
}

export const DEFAULT_DOMAIN_FILTER: DomainFilter = {
  search: '',
  status: 'ALL',
  ssl: 'ALL',
  groupId: 'ALL',
};

const STATUS_ORDER: Record<DomainStatus, number> = {
  [DomainStatus.Down]: 0,
  [DomainStatus.Error]: 1,
  [DomainStatus.Checking]: 2,
  [DomainStatus.Unknown]: 3,
  [DomainStatus.Alive]: 4,
};

const SSL_ORDER: Record<SSLStatus, number> = {
  [SSLStatus.Valid]: 0,
  [SSLStatus.Expiring]: 1,
  [SSLStatus.Expired]: 2,
  [SSLStatus.Invalid]: 3,
  [SSLStatus.Unknown]: 4,
};

const EXPIRY_ORDER: Record<string, number> = {
  active: 0,
  expiring: 1,
  expired: 2,
  unknown: 3,
};

function compareDomains(a: Domain, b: Domain, field: SortField): number {
  switch (field) {
    case 'url':
      return a.url.localeCompare(b.url);
    case 'status':
      return (STATUS_ORDER[a.status] ?? 5) - (STATUS_ORDER[b.status] ?? 5);
    case 'latency':
      return (a.latency ?? 0) - (b.latency ?? 0);
    case 'lastChecked':
      return (a.lastChecked?.getTime() ?? 0) - (b.lastChecked?.getTime() ?? 0);
    case 'ssl':
      return (SSL_ORDER[a.ssl?.status ?? SSLStatus.Unknown] ?? 4) - (SSL_ORDER[b.ssl?.status ?? SSLStatus.Unknown] ?? 4);
    case 'expiry':
      return (EXPIRY_ORDER[a.expiry?.status ?? 'unknown'] ?? 3) - (EXPIRY_ORDER[b.expiry?.status ?? 'unknown'] ?? 3);
    default:
      return 0;
  }
}

export function filterAndSortDomains(
  domains: Domain[],
  f: DomainFilter,
  sortField: SortField,
  sortOrder: SortOrder,
): Domain[] {
  const normalizedFilter = f.search.trim().toLowerCase();
  const filtered = domains.filter((d) => {
    const matchesSearch = d.url.toLowerCase().includes(normalizedFilter);
    const matchesStatus = f.status === 'ALL' || d.status === f.status;
    const matchesSSL = f.ssl === 'ALL' || d.ssl?.status === f.ssl;
    const matchesGroup = f.groupId === 'ALL' || d.groupId === f.groupId;
    return matchesSearch && matchesStatus && matchesSSL && matchesGroup;
  });

  filtered.sort((a, b) => {
    const comparison = compareDomains(a, b, sortField);
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  return filtered;
}
