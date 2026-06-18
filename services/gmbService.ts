import { ServiceConfig, GmbInfo, GmbStatus } from '../types';
import { logger } from '../utils/logger';
import { config as appConfig } from '../lib/config';

const DEFAULT_PROXY_URL = appConfig.proxy.defaultUrl;
const AUTH_SESSION_KEY = 'domainpulse_auth_session';

const getStoredToken = (): string | null => {
  try {
    const storedSession = localStorage.getItem(AUTH_SESSION_KEY);
    if (!storedSession) return null;
    const parsed = JSON.parse(storedSession) as { token?: string; expiresAt?: number };
    if (!parsed?.token || !parsed.expiresAt || parsed.expiresAt <= Date.now()) return null;
    return parsed.token;
  } catch {
    return null;
  }
};

interface RawGmbResult {
  status: string;
  placeId?: string;
  name?: string;
  rating?: number;
  reviewCount?: number;
  businessStatus?: string;
  openNow?: boolean;
  address?: string;
  phone?: string;
  website?: string;
  mapsUrl?: string;
  error?: string;
}

const toStatus = (s: string): GmbStatus =>
  (Object.values(GmbStatus) as string[]).includes(s) ? (s as GmbStatus) : GmbStatus.Unknown;

/**
 * Look up a Google Business Profile by Place ID (preferred) or free-text query.
 * Returns a GmbInfo snapshot; degrades to GmbStatus.Error/Unknown on failure so
 * callers never throw for a missing listing or unconfigured API key.
 */
export const checkGmb = async (
  opts: { placeId?: string; query?: string },
  serviceConfig?: ServiceConfig,
): Promise<GmbInfo> => {
  const { placeId, query } = opts;
  if (!placeId && !query) {
    return { status: GmbStatus.Unknown, lastChecked: new Date() };
  }

  const proxyUrl =
    serviceConfig?.proxyUrl ||
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_PROXY_URL) ||
    DEFAULT_PROXY_URL;

  let token = serviceConfig?.authToken;
  if (!token && typeof localStorage !== 'undefined') {
    token = getStoredToken() || undefined;
  }

  const qs = placeId ? `placeId=${encodeURIComponent(placeId)}` : `query=${encodeURIComponent(query!)}`;
  const endpoints = [`/api/gmb?${qs}`, `${proxyUrl}/api/gmb?${qs}`];

  try {
    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint, {
          method: 'GET',
          headers: { Accept: 'application/json', Authorization: token ? `Bearer ${token}` : '' },
        });
        if (response.status === 401) throw new Error('Unauthorized');
        if (response.ok) {
          const data = (await response.json()) as RawGmbResult;
          return {
            status: toStatus(data.status),
            placeId: data.placeId,
            name: data.name,
            rating: data.rating,
            reviewCount: data.reviewCount,
            businessStatus: data.businessStatus,
            openNow: data.openNow,
            address: data.address,
            phone: data.phone,
            website: data.website,
            mapsUrl: data.mapsUrl,
            error: data.error,
            lastChecked: new Date(),
          };
        }
      } catch (e) {
        if (e instanceof Error && e.message === 'Unauthorized') throw e;
        continue;
      }
    }
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') throw error;
    logger.error(`GMB lookup failed for ${placeId || query}:`, error);
  }

  return { status: GmbStatus.Error, error: 'Failed to reach GMB lookup endpoint', lastChecked: new Date() };
};
