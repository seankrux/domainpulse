/**
 * Google Search Console + Indexing API client.
 * All requests use a Bearer token from chrome.identity.
 */

const WEBMASTERS = 'https://www.googleapis.com/webmasters/v3';
const SEARCH_CONSOLE = 'https://searchconsole.googleapis.com/v1';
const INDEXING = 'https://indexing.googleapis.com/v3';

async function gscFetch(url, token, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text };
  }

  if (!res.ok) {
    const message =
      body?.error?.message ||
      body?.error_description ||
      `HTTP ${res.status}`;
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

/** List properties the signed-in user can access. */
export async function listSites(token) {
  const data = await gscFetch(`${WEBMASTERS}/sites`, token);
  return (data.siteEntry || []).map((s) => ({
    siteUrl: s.siteUrl,
    permissionLevel: s.permissionLevel,
  }));
}

/**
 * Pick the best matching GSC property for a page URL.
 * Prefers longest matching URL-prefix, then sc-domain.
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
      const domain = su.slice('sc-domain:'.length);
      if (host === domain || host.endsWith(`.${domain}`)) {
        candidates.push({ site, score: 1000 + domain.length });
      }
      continue;
    }
    try {
      const siteParsed = new URL(su);
      if (pageUrl.startsWith(su) || pageUrl.startsWith(su.replace(/\/$/, ''))) {
        candidates.push({ site, score: 2000 + su.length });
      } else if (
        siteParsed.hostname.replace(/^www\./, '') === host ||
        parsed.hostname === siteParsed.hostname
      ) {
        candidates.push({ site, score: 500 + su.length });
      }
    } catch {
      /* ignore malformed property URLs */
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates[0]?.site ?? null;
}

export async function searchAnalytics(token, siteUrl, body) {
  const url = `${WEBMASTERS}/sites/${encodeSiteUrl(siteUrl)}/searchAnalytics/query`;
  return gscFetch(url, token, { method: 'POST', body: JSON.stringify(body) });
}

/** Aggregate metrics for a single page (or whole property if pageUrl omitted). */
export async function pageMetrics(token, siteUrl, { startDate, endDate, pageUrl }) {
  const body = {
    startDate,
    endDate,
    searchType: 'web',
    rowLimit: 1,
  };
  if (pageUrl) {
    body.dimensions = ['page'];
    body.aggregationType = 'byPage';
    body.dimensionFilterGroups = [
      {
        groupType: 'and',
        filters: [{ dimension: 'page', operator: 'equals', expression: pageUrl }],
      },
    ];
  }
  const data = await searchAnalytics(token, siteUrl, body);
  const row = data.rows?.[0];
  return {
    clicks: row?.clicks ?? 0,
    impressions: row?.impressions ?? 0,
    ctr: row?.ctr ?? 0,
    position: row?.position ?? 0,
  };
}

/** Daily series for charting. */
export async function dailySeries(token, siteUrl, { startDate, endDate, pageUrl }) {
  const body = {
    startDate,
    endDate,
    dimensions: ['date'],
    searchType: 'web',
    rowLimit: 500,
  };
  if (pageUrl) {
    body.dimensionFilterGroups = [
      {
        groupType: 'and',
        filters: [{ dimension: 'page', operator: 'equals', expression: pageUrl }],
      },
    ];
  }
  const data = await searchAnalytics(token, siteUrl, body);
  return (data.rows || []).map((r) => ({
    date: r.keys[0],
    clicks: r.clicks,
    impressions: r.impressions,
    ctr: r.ctr,
    position: r.position,
  }));
}

/** Top queries for a page (or property). */
export async function topQueries(token, siteUrl, { startDate, endDate, pageUrl, rowLimit = 25 }) {
  const body = {
    startDate,
    endDate,
    dimensions: ['query'],
    searchType: 'web',
    rowLimit,
  };
  if (pageUrl) {
    body.dimensionFilterGroups = [
      {
        groupType: 'and',
        filters: [{ dimension: 'page', operator: 'equals', expression: pageUrl }],
      },
    ];
  }
  const data = await searchAnalytics(token, siteUrl, body);
  return (data.rows || []).map((r) => ({
    query: r.keys[0],
    clicks: r.clicks,
    impressions: r.impressions,
    ctr: r.ctr,
    position: r.position,
  }));
}

/** Growing / decaying queries by comparing two periods. */
export async function queryDeltas(
  token,
  siteUrl,
  { current, previous, pageUrl, rowLimit = 50 }
) {
  const [cur, prev] = await Promise.all([
    topQueries(token, siteUrl, { ...current, pageUrl, rowLimit }),
    topQueries(token, siteUrl, { ...previous, pageUrl, rowLimit }),
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

/** URL Inspection API — index status for a URL. */
export async function inspectUrl(token, { inspectionUrl, siteUrl, languageCode = 'en-US' }) {
  return gscFetch(`${SEARCH_CONSOLE}/urlInspection/index:inspect`, token, {
    method: 'POST',
    body: JSON.stringify({ inspectionUrl, siteUrl, languageCode }),
  });
}

/**
 * Indexing API — notify Google of URL_UPDATED / URL_DELETED.
 * Officially intended for JobPosting / BroadcastEvent pages; users
 * should understand quota + policy limits.
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
  return gscFetch(path, token, { method: 'PUT', body: '' });
}

/** Deep-link into the GSC URL Inspection UI for manual “Request indexing”. */
export function gscInspectDeepLink(siteUrl, pageUrl) {
  const resource = encodeURIComponent(siteUrl);
  const id = encodeURIComponent(pageUrl);
  return `https://search.google.com/search-console/inspect?resource_id=${resource}&id=${id}`;
}

export function gscPropertyDeepLink(siteUrl) {
  return `https://search.google.com/search-console/performance/search-analytics?resource_id=${encodeURIComponent(siteUrl)}`;
}
