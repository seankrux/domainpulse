import {
  getAccessToken,
  signOut,
  getClientId,
  setClientId,
  clearToken,
  redirectUri,
  SCOPES,
  validateClientId,
} from '../lib/auth.js';
import {
  listSites,
  matchProperty,
  normalizePageUrl,
  pageMetrics,
  dailySeries,
  topQueries,
  queryDeltas,
  inspectUrl,
  publishUrlNotification,
  getUrlNotificationMetadata,
  listSitemaps,
  submitSitemap,
  pingWebSub,
  fetchSitemapUrls,
  gscInspectDeepLink,
  gscPropertyDeepLink,
} from '../lib/gsc.js';
import { defaultRange, previousRange, pctChange } from '../lib/dates.js';
import { getQuota, bumpQuota, assertQuota } from '../lib/quota.js';
import {
  STORAGE,
  MSG,
  INDEX_TYPES,
  ALLOWED_OPEN_HOSTS,
} from '../lib/constants.js';

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

function assertExtensionSender(sender) {
  if (!sender || sender.id !== chrome.runtime.id) {
    throw new Error('Unauthorized message sender.');
  }
  const url = sender.url || '';
  if (!url.startsWith(`chrome-extension://${chrome.runtime.id}/`)) {
    throw new Error('Messages must come from PulseSEO extension pages.');
  }
}

function assertHttpsUrl(value, label = 'URL') {
  let u;
  try {
    u = new URL(value);
  } catch {
    throw new Error(`Invalid ${label}.`);
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') {
    throw new Error(`${label} must be http(s).`);
  }
  return u.href;
}

async function openAllowedUrl(url) {
  const u = new URL(assertHttpsUrl(url, 'link'));
  if (u.protocol !== 'https:') throw new Error('Only https links can be opened.');
  if (!ALLOWED_OPEN_HOSTS.has(u.hostname)) {
    throw new Error(`Host not allowed: ${u.hostname}`);
  }
  await chrome.tabs.create({ url: u.href });
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function ensureToken(interactive = true) {
  return getAccessToken({ interactive });
}

async function withAuthRetry(fn) {
  try {
    return await fn(await ensureToken(true));
  } catch (err) {
    if (err.code === 'AUTH_EXPIRED' || err.status === 401) {
      const token = await ensureToken(true);
      return fn(token);
    }
    throw err;
  }
}

async function loadNotes() {
  const { [STORAGE.NOTES]: notes } = await chrome.storage.local.get(STORAGE.NOTES);
  return notes || [];
}

let notesChain = Promise.resolve();
function enqueueNotes(task) {
  notesChain = notesChain.then(task, task);
  return notesChain;
}

async function saveNote(note) {
  return enqueueNotes(async () => {
    const notes = await loadNotes();
    const entry = {
      title: String(note.title || '').slice(0, 200),
      body: String(note.body || '').slice(0, 5000),
      scope: note.scope === 'property' ? 'property' : 'page',
      pageUrl: note.pageUrl || null,
      siteUrl: note.siteUrl || null,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    notes.unshift(entry);
    await chrome.storage.local.set({ [STORAGE.NOTES]: notes.slice(0, 500) });
    return entry;
  });
}

async function deleteNote(id) {
  return enqueueNotes(async () => {
    const notes = await loadNotes();
    await chrome.storage.local.set({
      [STORAGE.NOTES]: notes.filter((n) => n.id !== id),
    });
  });
}

async function runPageAudit(tabId) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    files: ['content/page-audit.js'],
  });
  const injection = results?.[0];
  if (injection?.error) {
    return { ok: false, error: String(injection.error) };
  }
  return injection?.result ?? { ok: false, error: 'No audit result (restricted page?).' };
}

async function ownedSiteUrls(token) {
  const sites = await listSites(token);
  return new Set(sites.map((s) => s.siteUrl));
}

async function assertOwnedProperty(token, siteUrl) {
  const owned = await ownedSiteUrls(token);
  if (!owned.has(siteUrl)) throw new Error('Property not in your Search Console account.');
  return siteUrl;
}

function pageBelongsToProperty(pageUrl, siteUrl) {
  return Boolean(matchProperty(pageUrl, [{ siteUrl, permissionLevel: 'siteOwner' }]));
}

async function resolveContext() {
  const tab = await getActiveTab();
  if (!tab?.url || !/^https?:/i.test(tab.url)) {
    return {
      tab,
      pageUrl: null,
      property: null,
      sites: [],
      error: 'Open an http(s) page to analyze.',
    };
  }
  const pageUrl = normalizePageUrl(tab.url);
  const token = await ensureToken(false);
  if (!token) {
    return { tab, pageUrl, property: null, sites: [], needsAuth: true };
  }
  try {
    const sites = await listSites(token);
    const property = matchProperty(pageUrl, sites);
    return { tab, pageUrl, property, sites, token };
  } catch (err) {
    if (err.code === 'AUTH_EXPIRED' || err.status === 401) {
      return { tab, pageUrl, property: null, sites: [], needsAuth: true };
    }
    throw err;
  }
}

async function setBadge(text) {
  try {
    await chrome.action.setBadgeText({ text: text || '' });
    await chrome.action.setBadgeBackgroundColor({ color: '#3d9cf0' });
  } catch {
    /* ignore */
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then((result) => sendResponse({ ok: true, result }))
    .catch((err) =>
      sendResponse({
        ok: false,
        error: err.message || String(err),
        code: err.code,
        status: err.status,
        hint: err.hint,
        gscLink: err.gscLink,
      })
    );
  return true;
});

async function handleMessage(message, sender) {
  assertExtensionSender(sender);
  const type = message?.type;

  switch (type) {
    case MSG.GET_SETUP: {
      const clientId = await getClientId();
      return {
        clientId,
        redirectUri: redirectUri(),
        scopes: SCOPES,
        extensionId: chrome.runtime.id,
      };
    }
    case MSG.SET_CLIENT_ID: {
      const check = validateClientId(message.clientId);
      if (!check.ok) throw new Error(check.error);
      await clearToken();
      await setClientId(check.clientId);
      return { saved: true };
    }
    case MSG.SIGN_IN: {
      const token = await ensureToken(true);
      return { signedIn: Boolean(token) };
    }
    case MSG.SIGN_OUT: {
      await signOut();
      await setBadge('');
      return { signedIn: false };
    }
    case MSG.GET_CONTEXT: {
      const ctx = await resolveContext();
      const quota = ctx.property
        ? await getQuota(ctx.property.siteUrl)
        : await getQuota(null);
      return {
        pageUrl: ctx.pageUrl,
        property: ctx.property,
        sites: ctx.sites,
        needsAuth: Boolean(ctx.needsAuth),
        error: ctx.error,
        tabTitle: ctx.tab?.title,
        tabId: ctx.tab?.id,
        quota,
      };
    }
    case MSG.GET_ANALYTICS: {
      return withAuthRetry(async (token) => {
        const siteUrl = await assertOwnedProperty(token, message.siteUrl);
        const range = message.range || defaultRange(message.days || 28);
        const prev = previousRange(range.startDate, range.endDate);
        const pageUrl =
          message.scope === 'domain'
            ? null
            : normalizePageUrl(message.pageUrl || '');
        if (pageUrl && !pageBelongsToProperty(pageUrl, siteUrl)) {
          throw new Error('Page URL is not under the selected property.');
        }
        const dims = {
          type: message.searchType || 'web',
          device: message.device || 'ALL',
          country: message.country || 'ALL',
        };
        const [current, previous, series, queries, deltas] = await Promise.all([
          pageMetrics(token, siteUrl, { ...range, pageUrl, ...dims }),
          pageMetrics(token, siteUrl, { ...prev, pageUrl, ...dims }),
          dailySeries(token, siteUrl, { ...range, pageUrl, ...dims }),
          topQueries(token, siteUrl, { ...range, pageUrl, rowLimit: 50, ...dims }),
          queryDeltas(token, siteUrl, {
            current: range,
            previous: prev,
            pageUrl,
            ...dims,
          }),
        ]);
        const bothEmpty = current.empty && previous.empty;
        return {
          range,
          previousRange: prev,
          metrics: current,
          changes: bothEmpty
            ? { clicks: null, impressions: null, ctr: null, position: null }
            : {
                clicks: pctChange(current.clicks, previous.clicks),
                impressions: pctChange(current.impressions, previous.impressions),
                ctr: pctChange(current.ctr, previous.ctr),
                position:
                  current.position == null || previous.position == null
                    ? null
                    : pctChange(current.position, previous.position),
              },
          series,
          queries,
          deltas,
          deepLink: gscPropertyDeepLink(siteUrl),
          notes: (await loadNotes()).filter(
            (n) =>
              (pageUrl && n.pageUrl === pageUrl) ||
              (n.scope === 'property' && n.siteUrl === siteUrl)
          ),
        };
      });
    }
    case MSG.INSPECT_URL: {
      return withAuthRetry(async (token) => {
        const siteUrl = await assertOwnedProperty(token, message.siteUrl);
        const pageUrl = normalizePageUrl(assertHttpsUrl(message.pageUrl, 'page URL'));
        if (!pageBelongsToProperty(pageUrl, siteUrl)) {
          throw new Error('Page URL is not under the selected property.');
        }
        await assertQuota(siteUrl, 'inspect');
        const data = await inspectUrl(token, { inspectionUrl: pageUrl, siteUrl });
        await bumpQuota(siteUrl, 'inspect');
        return {
          inspection: data.inspectionResult,
          gscLink: gscInspectDeepLink(siteUrl, pageUrl),
          quota: await getQuota(siteUrl),
        };
      });
    }
    case MSG.REQUEST_INDEXING: {
      return withAuthRetry(async (token) => {
        const tab = await getActiveTab();
        const siteUrl = await assertOwnedProperty(token, message.siteUrl);
        const pageUrl = normalizePageUrl(
          assertHttpsUrl(message.pageUrl || tab?.url, 'page URL')
        );
        if (!pageBelongsToProperty(pageUrl, siteUrl)) {
          throw new Error('Page URL is not under the selected property.');
        }
        const notifyType = INDEX_TYPES.has(message.notifyType)
          ? message.notifyType
          : 'URL_UPDATED';
        await assertQuota(siteUrl, 'index');
        try {
          const result = await publishUrlNotification(token, {
            url: pageUrl,
            type: notifyType,
          });
          await bumpQuota(siteUrl, 'index');
          return {
            result,
            via: 'indexing_api',
            gscLink: gscInspectDeepLink(siteUrl, pageUrl),
            quota: await getQuota(siteUrl),
          };
        } catch (err) {
          err.gscLink = gscInspectDeepLink(siteUrl, pageUrl);
          err.hint =
            'Indexing API often requires a service account as GSC owner. Use Open GSC Inspection for the supported Request indexing button.';
          throw err;
        }
      });
    }
    case MSG.INDEXING_STATUS: {
      return withAuthRetry(async (token) => {
        const pageUrl = normalizePageUrl(assertHttpsUrl(message.pageUrl, 'page URL'));
        return getUrlNotificationMetadata(token, pageUrl);
      });
    }
    case MSG.LIST_SITEMAPS: {
      return withAuthRetry(async (token) => {
        const siteUrl = await assertOwnedProperty(token, message.siteUrl);
        return listSitemaps(token, siteUrl);
      });
    }
    case MSG.SUBMIT_SITEMAP: {
      return withAuthRetry(async (token) => {
        const siteUrl = await assertOwnedProperty(token, message.siteUrl);
        const feedpath = assertHttpsUrl(message.feedpath, 'sitemap URL');
        if (!pageBelongsToProperty(feedpath, siteUrl)) {
          throw new Error('Sitemap URL is not under the selected property.');
        }
        await submitSitemap(token, siteUrl, feedpath);
        let websub = null;
        if (message.pingWebSub) {
          try {
            websub = await pingWebSub(feedpath);
          } catch (e) {
            websub = { ok: false, error: e.message };
          }
        }
        return { submitted: true, websub };
      });
    }
    case MSG.PING_WEBSUB: {
      const feedpath = assertHttpsUrl(message.feedpath, 'sitemap URL');
      return pingWebSub(feedpath);
    }
    case MSG.PAGE_AUDIT: {
      const tab = await getActiveTab();
      if (!tab?.id) throw new Error('No active tab');
      if (!tab.url || !/^https?:/i.test(tab.url)) {
        throw new Error('On-page audit only works on http(s) pages.');
      }
      return runPageAudit(tab.id);
    }
    case MSG.LIST_NOTES: {
      const notes = await loadNotes();
      if (!message.pageUrl && !message.siteUrl) return notes;
      return notes.filter(
        (n) =>
          n.pageUrl === message.pageUrl ||
          (n.scope === 'property' && n.siteUrl === message.siteUrl)
      );
    }
    case MSG.ADD_NOTE: {
      return saveNote(message.note || {});
    }
    case MSG.DELETE_NOTE: {
      if (!message.id) throw new Error('Note id required.');
      await deleteNote(message.id);
      return { deleted: true };
    }
    case MSG.OPEN_GSC_INSPECT: {
      const siteUrl = message.siteUrl;
      const pageUrl = normalizePageUrl(assertHttpsUrl(message.pageUrl, 'page URL'));
      if (!siteUrl) throw new Error('siteUrl required');
      await openAllowedUrl(gscInspectDeepLink(siteUrl, pageUrl));
      return { opened: true };
    }
    case MSG.OPEN_GSC_PERF: {
      if (!message.siteUrl) throw new Error('siteUrl required');
      await openAllowedUrl(gscPropertyDeepLink(message.siteUrl));
      return { opened: true };
    }
    case MSG.GET_QUOTA: {
      return getQuota(message.siteUrl || null);
    }
    case MSG.FETCH_SITEMAP_URLS: {
      return withAuthRetry(async (token) => {
        const siteUrl = await assertOwnedProperty(token, message.siteUrl);
        const feedpath = assertHttpsUrl(message.feedpath, 'sitemap URL');
        if (!pageBelongsToProperty(feedpath, siteUrl)) {
          throw new Error('Sitemap URL is not under the selected property.');
        }
        const urls = await fetchSitemapUrls(feedpath, {
          limit: Math.min(Number(message.limit) || 200, 500),
        });
        const underProperty = urls.filter((u) => pageBelongsToProperty(u, siteUrl));
        return {
          urls: underProperty,
          count: underProperty.length,
          dropped: urls.length - underProperty.length,
        };
      });
    }
    case MSG.BULK_INSPECT: {
      return withAuthRetry(async (token) => {
        let authToken = token;
        const siteUrl = await assertOwnedProperty(authToken, message.siteUrl);
        const parsed = (message.urls || []).map((u) => {
          try {
            return normalizePageUrl(assertHttpsUrl(u));
          } catch {
            return null;
          }
        });
        const invalid = parsed.filter((u) => !u).length;
        const candidates = parsed.filter(Boolean);
        const urls = candidates
          .filter((u) => pageBelongsToProperty(u, siteUrl))
          .slice(0, 25);
        const skipped = candidates.length - urls.length + invalid;

        const results = [];
        for (let i = 0; i < urls.length; i++) {
          await assertQuota(siteUrl, 'inspect');
          await setBadge(`${i + 1}/${urls.length}`);
          try {
            const data = await inspectUrl(authToken, {
              inspectionUrl: urls[i],
              siteUrl,
            });
            await bumpQuota(siteUrl, 'inspect');
            const idx = data.inspectionResult?.indexStatusResult || {};
            results.push({
              url: urls[i],
              ok: true,
              verdict: idx.verdict || null,
              coverageState: idx.coverageState || null,
              lastCrawlTime: idx.lastCrawlTime || null,
              indexingState: idx.indexingState || null,
            });
          } catch (err) {
            if (err.code === 'AUTH_EXPIRED' || err.status === 401) {
              authToken = await ensureToken(true);
              i -= 1; // retry same URL
              continue;
            }
            results.push({ url: urls[i], ok: false, error: err.message });
          }
        }
        await setBadge('');
        return { results, skipped, quota: await getQuota(siteUrl) };
      });
    }
    default: {
      throw new Error(`Unknown message type: ${type}`);
    }
  }
}
