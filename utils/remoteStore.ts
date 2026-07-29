import { Domain, DomainGroup } from '../types';
import { AppSettings, defaultSettings, loadDomains, saveDomains, loadGroupsResult, saveGroups, loadSettings, saveSettings } from './storage';
import { getSessionToken } from './authSession';
import { logger } from './logger';
import { SAMPLE_DOMAINS, SAMPLE_GROUPS } from '../data/seed';

export type PersistenceMode = 'neon' | 'local' | 'unknown';

export interface AppStoreSnapshot {
  domains: Domain[];
  groups: DomainGroup[];
  settings: AppSettings;
  persistence: PersistenceMode;
}

const PROXY_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_PROXY_URL) || 'http://localhost:3001';

function authHeaders(): HeadersInit {
  const token = getSessionToken();
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function tryEndpoints<T>(
  path: string,
  init: RequestInit,
): Promise<{ ok: true; data: T } | { ok: false; status?: number }> {
  const endpoints = [path, `${PROXY_URL}${path}`];
  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, init);
      if (res.status === 503) {
        return { ok: false, status: 503 };
      }
      if (res.status === 401) {
        return { ok: false, status: 401 };
      }
      if (!res.ok) continue;
      const data = (await res.json()) as T;
      return { ok: true, data };
    } catch {
      continue;
    }
  }
  return { ok: false };
}

function reviveDomain(d: Domain): Domain {
  return {
    ...d,
    addedAt: new Date(d.addedAt),
    lastChecked: d.lastChecked ? new Date(d.lastChecked) : undefined,
    history: (d.history || []).map((h) => ({
      ...h,
      timestamp: new Date(h.timestamp),
    })),
    ssl: d.ssl
      ? {
          ...d.ssl,
          validFrom: d.ssl.validFrom ? new Date(d.ssl.validFrom) : undefined,
          validTo: d.ssl.validTo ? new Date(d.ssl.validTo) : undefined,
        }
      : undefined,
    expiry: d.expiry
      ? {
          ...d.expiry,
          expiryDate: d.expiry.expiryDate ? new Date(d.expiry.expiryDate) : undefined,
          createdDate: d.expiry.createdDate ? new Date(d.expiry.createdDate) : undefined,
          updatedDate: d.expiry.updatedDate ? new Date(d.expiry.updatedDate) : undefined,
        }
      : undefined,
    canonical: d.canonical
      ? {
          ...d.canonical,
          lastChecked: d.canonical.lastChecked ? new Date(d.canonical.lastChecked) : undefined,
        }
      : undefined,
    gmb: d.gmb
      ? {
          ...d.gmb,
          lastChecked: d.gmb.lastChecked ? new Date(d.gmb.lastChecked) : undefined,
        }
      : undefined,
  };
}

/**
 * Load app state: prefer Neon via /api/store, fall back to localStorage.
 * Migrates local data to Neon when the DB is empty.
 */
export async function loadAppStore(): Promise<AppStoreSnapshot> {
  const remote = await tryEndpoints<{
    domains: Domain[];
    groups: DomainGroup[];
    settings: Record<string, unknown>;
    persistence?: string;
  }>('/api/store', { method: 'GET', headers: authHeaders() });

  if (remote.ok) {
    const domains = (remote.data.domains || []).map(reviveDomain);
    const groups = remote.data.groups || [];
    const settings: AppSettings = { ...defaultSettings, ...(remote.data.settings || {}) };

    if (domains.length === 0) {
      // Migrate from localStorage if the user already had data locally
      const local = loadDomains();
      const localGroups = loadGroupsResult();
      const localSettings = loadSettings();
      const hasRealLocal =
        !local.loadFailed &&
        local.domains.length > 0 &&
        !local.domains.every((d) => d.id.startsWith('sample-'));

      if (hasRealLocal) {
        await saveAppStore({
          domains: local.domains,
          groups: localGroups.groups,
          settings: localSettings,
        });
        saveDomains(local.domains);
        saveGroups(localGroups.groups);
        saveSettings(localSettings);
        return {
          domains: local.domains,
          groups: localGroups.groups,
          settings: localSettings,
          persistence: 'neon',
        };
      }

      // Fresh Neon DB — seed once and persist
      await saveAppStore({
        domains: SAMPLE_DOMAINS,
        groups: SAMPLE_GROUPS,
        settings: defaultSettings,
      });
      saveDomains(SAMPLE_DOMAINS);
      saveGroups(SAMPLE_GROUPS);
      saveSettings(defaultSettings);
      return {
        domains: SAMPLE_DOMAINS,
        groups: SAMPLE_GROUPS,
        settings: defaultSettings,
        persistence: 'neon',
      };
    }

    // Mirror remote → local cache
    saveDomains(domains);
    saveGroups(groups);
    saveSettings(settings);
    return { domains, groups, settings, persistence: 'neon' };
  }

  // Neon unavailable — localStorage
  const local = loadDomains();
  const localGroups = loadGroupsResult();
  return {
    domains: local.domains,
    groups: localGroups.groups,
    settings: loadSettings(),
    persistence: 'local',
  };
}

let saveQueue: Promise<void> = Promise.resolve();

/**
 * Persist to Neon (when available) and always mirror to localStorage.
 * Saves are serialized to avoid overlapping PUTs clobbering each other.
 */
export function saveAppStore(snapshot: {
  domains: Domain[];
  groups: DomainGroup[];
  settings: AppSettings;
}): Promise<void> {
  // Always keep a local cache so the UI still works offline / without DATABASE_URL
  saveDomains(snapshot.domains);
  saveGroups(snapshot.groups);
  saveSettings(snapshot.settings);

  saveQueue = saveQueue
    .then(async () => {
      const result = await tryEndpoints('/api/store', {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(snapshot),
      });
      if (!result.ok && result.status !== 503) {
        logger.warn('Failed to persist store to Neon', result);
      }
    })
    .catch((err) => {
      logger.error('Remote store save failed', err);
    });

  return saveQueue;
}
