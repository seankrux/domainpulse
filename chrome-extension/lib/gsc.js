/**
 * Google Search Console + Indexing API + WebSub helpers.
 */

import { invalidateToken } from './auth.js';
import { assertPublicHttpUrl } from './ssrf.js';

const WEBMASTERS = 'https://www.googleapis.com/webmasters/v3';
const SEARCH_CONSOLE = 'https://searchconsole.googleapis.com/v1';
const INDEXING = 'https://indexing.googleapis.com/v3';
const WEBSUB_HUB = 'https://pubsubhubbub.appspot.com/';

async function gscFetch(url, token, options = {}, { retryOnAuth = true } = {}) {
  const headers = {
    Authorization: `Bearer ${token}`,
    ...(options.headers || {}),
  };
  if (options.body !== undefined && options.body !== null && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(url, { ...options, headers });
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text };
  }

  if (res.status === 401 && retryOnAuth) {
    await invalidateToken();
    const err = new Error('Unauthorized — sign in again.');
    err.status = 401;
    err.code = 'AUTH_EXPIRED';
    err.body = body;
    throw err;
  }

  if (!res.ok) {
    const message =
      body?.error?.message || body?.error_description || `HTTP ${res.status}`;
    const err = new Error(message);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

export function encodeSiteUrl(siteUrl) {
  return encodeURIComponent(siteUrl);
}

export async function listSites(token) {
  const data = await gscFetch(`${WEBMASTERS}/sites`, token);
  return (data.siteEntry || []).map((s) => ({
    siteUrl: s.siteUrl,
    permissionLevel: s.permissionLevel,
  }));
}

function pathUnderPrefix(pagePath, sitePath) {
  const prefix = sitePath.endsWith('/') ? sitePath : `${sitePath}/`;
  if (sitePath === '/' || sitePath === '') return true;
  return pagePath === sitePath || pagePath === prefix.slice(0, -1) || pagePath.startsWith(prefix);
}

/**
 * Pick the best matching GSC property for a page URL.
 * URL-prefix: same origin + path under property path (no host-prefix string tricks).
 * sc-domain: host or subdomain of the domain.
 * No www↔apex fallback for URL-prefix (those are different properties).
 */
export function matchProperty(pageUrl, sites) {
  let parsed;
  try {
    parsed = new URL(pageUrl);
  } catch {
    return null;
  }

  const host = parsed.hostname.replace(/^www\./, '');
  const candidates = [];

  for (const site of sites) {
    const su = site.siteUrl;
    if (su.startsWith('sc-domain:')) {
      const domain = su.slice('sc-domain:'.length).toLowerCase();
      if (host === domain || host.endsWith(`.${domain}`)) {
        candidates.push({ site, score: 1000 + domain.length });
      }
      continue;
    }
    try {
      const siteParsed = new URL(su);
      if (parsed.origin !== siteParsed.origin) continue;
      if (pathUnderPrefix(parsed.pathname, siteParsed.pathname)) {
        candidates.push({ site, score: 2000 + su.length });
      }
    } catch {
      /* ignore malformed property URLs */
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates[0]?.site ?? null;
}

/** Strip hash + common tracking params for more reliable page equals filters. */
export function normalizePageUrl(pageUrl) {
  let u;
  try {
    u = new URL(pageUrl);
  } catch {
    return pageUrl;
  }
  u.hash = '';
  const drop = [
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_term',
    'utm_content',
    'gclid',
    'fbclid',
    'mc_cid',
    'mc_eid',
  ];
  for (const key of drop) u.searchParams.delete(key);
  return u.toString();
}

function pageFilterGroup(pageUrl) {
  return {
    groupType: 'and',
    filters: [{ dimension: 'page', operator: 'equals', expression: pageUrl }],
  };
}

export async function searchAnalytics(token, siteUrl, body) {
  const url = `${WEBMASTERS}/sites/${encodeSiteUrl(siteUrl)}/searchAnalytics/query`;
  return gscFetch(url, token, { method: 'POST', body: JSON.stringify(body) });
}

export async function pageMetrics(token, siteUrl, { startDate, endDate, pageUrl, type = 'web', device, country }) {
  const body = {
    startDate,
    endDate,
    type,
    rowLimit: 1,
  };
  const filters = [];
  if (pageUrl) {
    body.dimensions = ['page'];
    body.aggregationType = 'byPage';
    filters.push({ dimension: 'page', operator: 'equals', expression: pageUrl });
  }
  if (device && device !== 'ALL') {
    filters.push({ dimension: 'device', operator: 'equals', expression: device });
  }
  if (country && country !== 'ALL') {
    filters.push({ dimension: 'country', operator: 'equals', expression: country });
  }
  if (filters.length) {
    body.dimensionFilterGroups = [{ groupType: 'and', filters }];
  }
  const data = await searchAnalytics(token, siteUrl, body);
  const row = data.rows?.[0];
  if (!row) {
    return { clicks: 0, impressions: 0, ctr: 0, position: null, empty: true };
  }
  return {
    clicks: row.clicks ?? 0,
    impressions: row.impressions ?? 0,
    ctr: row.ctr ?? 0,
    position: row.position ?? 0,
    empty: false,
  };
}

export async function dailySeries(token, siteUrl, { startDate, endDate, pageUrl, type = 'web', device, country }) {
  const body = {
    startDate,
    endDate,
    dimensions: ['date'],
    type,
    rowLimit: 500,
  };
  const filters = [];
  if (pageUrl) filters.push({ dimension: 'page', operator: 'equals', expression: pageUrl });
  if (device && device !== 'ALL') filters.push({ dimension: 'device', operator: 'equals', expression: device });
  if (country && country !== 'ALL') filters.push({ dimension: 'country', operator: 'equals', expression: country });
  if (filters.length) body.dimensionFilterGroups = [{ groupType: 'and', filters }];

  const data = await searchAnalytics(token, siteUrl, body);
  return (data.rows || []).map((r) => ({
    date: r.keys[0],
    clicks: r.clicks,
    impressions: r.impressions,
    ctr: r.ctr,
    position: r.position,
  }));
}

export async function topQueries(
  token,
  siteUrl,
  { startDate, endDate, pageUrl, rowLimit = 25, type = 'web', device, country }
) {
  const body = {
    startDate,
    endDate,
    dimensions: ['query'],
    type,
    rowLimit,
  };
  const filters = [];
  if (pageUrl) filters.push({ dimension: 'page', operator: 'equals', expression: pageUrl });
  if (device && device !== 'ALL') filters.push({ dimension: 'device', operator: 'equals', expression: device });
  if (country && country !== 'ALL') filters.push({ dimension: 'country', operator: 'equals', expression: country });
  if (filters.length) body.dimensionFilterGroups = [{ groupType: 'and', filters }];

  const data = await searchAnalytics(token, siteUrl, body);
  return (data.rows || []).map((r) => ({
    query: r.keys[0],
    clicks: r.clicks,
    impressions: r.impressions,
    ctr: r.ctr,
    position: r.position,
  }));
}

export async function queryDeltas(
  token,
  siteUrl,
  { current, previous, pageUrl, rowLimit = 100, type = 'web', device, country }
) {
  const opts = { pageUrl, rowLimit, type, device, country };
  const [cur, prev] = await Promise.all([
    topQueries(token, siteUrl, { ...current, ...opts }),
    topQueries(token, siteUrl, { ...previous, ...opts }),
  ]);

  const prevMap = new Map(prev.map((q) => [q.query, q]));
  const curMap = new Map(cur.map((q) => [q.query, q]));

  const growing = [];
  const decaying = [];
  const newRanking = [];

  for (const q of cur) {
    const p = prevMap.get(q.query);
    if (!p) {
      newRanking.push(q);
      continue;
    }
    const delta = q.clicks - p.clicks;
    const entry = { ...q, previousClicks: p.clicks, delta };
    if (delta > 0) growing.push(entry);
    else if (delta < 0) decaying.push(entry);
  }

  for (const q of prev) {
    if (!curMap.has(q.query) && q.clicks > 0) {
      decaying.push({
        ...q,
        clicks: 0,
        previousClicks: q.clicks,
        delta: -q.clicks,
      });
    }
  }

  growing.sort((a, b) => b.delta - a.delta);
  decaying.sort((a, b) => a.delta - b.delta);
  newRanking.sort((a, b) => b.impressions - a.impressions);

  return {
    growing: growing.slice(0, 15),
    decaying: decaying.slice(0, 15),
    newRanking: newRanking.slice(0, 15),
  };
}

export async function inspectUrl(token, { inspectionUrl, siteUrl, languageCode = 'en-US' }) {
  return gscFetch(`${SEARCH_CONSOLE}/urlInspection/index:inspect`, token, {
    method: 'POST',
    body: JSON.stringify({ inspectionUrl, siteUrl, languageCode }),
  });
}

/**
 * Indexing API notify. Officially JobPosting/BroadcastEvent; often needs a
 * service-account token. User OAuth frequently returns 403 — callers should
 * fall back to GSC Inspection UI.
 */
export async function publishUrlNotification(token, { url, type }) {
  return gscFetch(`${INDEXING}/urlNotifications:publish`, token, {
    method: 'POST',
    body: JSON.stringify({ url, type }),
  });
}

export async function getUrlNotificationMetadata(token, url) {
  const q = encodeURIComponent(url);
  return gscFetch(`${INDEXING}/urlNotifications/metadata?url=${q}`, token);
}

export async function listSitemaps(token, siteUrl) {
  const data = await gscFetch(
    `${WEBMASTERS}/sites/${encodeSiteUrl(siteUrl)}/sitemaps`,
    token
  );
  return data.sitemap || [];
}

export async function submitSitemap(token, siteUrl, feedpath) {
  const path = `${WEBMASTERS}/sites/${encodeSiteUrl(siteUrl)}/sitemaps/${encodeURIComponent(feedpath)}`;
  return gscFetch(path, token, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: '',
  });
}

/** Official Google WebSub hub ping after sitemap changes. */
export async function pingWebSub(sitemapUrl) {
  const body = new URLSearchParams({
    'hub.mode': 'publish',
    'hub.url': sitemapUrl,
  });
  const res = await fetch(WEBSUB_HUB, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    throw new Error(`WebSub ping failed (HTTP ${res.status})`);
  }
  return { ok: true, status: res.status };
}

export function gscInspectDeepLink(siteUrl, pageUrl) {
  const resource = encodeURIComponent(siteUrl);
  const id = encodeURIComponent(pageUrl);
  return `https://search.google.com/search-console/inspect?resource_id=${resource}&id=${id}`;
}

export function gscPropertyDeepLink(siteUrl) {
  return `https://search.google.com/search-console/performance/search-analytics?resource_id=${encodeURIComponent(siteUrl)}`;
}

/** Fetch sitemap or sitemap-index and return URL list (capped). */
export async function fetchSitemapUrls(
  sitemapUrl,
  { limit = 500, _visited = null } = {}
) {
  const visited = _visited || new Set();
  const start = assertPublicHttpUrl(sitemapUrl, 'sitemap URL');
  if (visited.has(start)) return [];
  visited.add(start);

  const res = await fetch(start, { redirect: 'follow' });
  if (!res.ok) throw new Error(`Sitemap fetch failed (HTTP ${res.status})`);
  // Re-check final URL after redirects
  assertPublicHttpUrl(res.url || start, 'sitemap redirect');

  const xml = await res.text();
  const locs = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)]
    .map((m) => m[1].trim())
    .filter((u) => {
      try {
        assertPublicHttpUrl(u, 'sitemap loc');
        return true;
      } catch {
        return false;
      }
    });
  const indexes = locs.filter((u) => /sitemap/i.test(u) && /\.xml(\.gz)?$/i.test(u));
  const pages = locs.filter((u) => !indexes.includes(u));

  if (indexes.length && pages.length < 5) {
    const nested = [];
    for (const idx of indexes.slice(0, 10)) {
      if (nested.length >= limit) break;
      try {
        const child = await fetchSitemapUrls(idx, {
          limit: limit - nested.length,
          _visited: visited,
        });
        nested.push(...child);
      } catch {
        /* skip bad child */
      }
    }
    return [...new Set(nested)].slice(0, limit);
  }
  return [...new Set(pages.length ? pages : locs)].slice(0, limit);
}

export { pageFilterGroup, WEBSUB_HUB };
