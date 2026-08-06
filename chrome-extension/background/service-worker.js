import {
  getAccessToken,
  signOut,
  getClientId,
  setClientId,
  clearToken,
  redirectUri,
  SCOPES,
} from '../lib/auth.js';
import {
  listSites,
  matchProperty,
  pageMetrics,
  dailySeries,
  topQueries,
  queryDeltas,
  inspectUrl,
  publishUrlNotification,
  getUrlNotificationMetadata,
  listSitemaps,
  submitSitemap,
  gscInspectDeepLink,
  gscPropertyDeepLink,
} from '../lib/gsc.js';
import { defaultRange, previousRange, pctChange } from '../lib/dates.js';

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

const NOTES_KEY = 'pulse_seo_notes';

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function ensureToken(interactive = true) {
  return getAccessToken({ interactive });
}

async function loadNotes() {
  const { [NOTES_KEY]: notes } = await chrome.storage.local.get(NOTES_KEY);
  return notes || [];
}

async function saveNote(note) {
  const notes = await loadNotes();
  const entry = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    ...note,
  };
  notes.unshift(entry);
  await chrome.storage.local.set({ [NOTES_KEY]: notes.slice(0, 500) });
  return entry;
}

async function deleteNote(id) {
  const notes = await loadNotes();
  await chrome.storage.local.set({
    [NOTES_KEY]: notes.filter((n) => n.id !== id),
  });
}

async function runPageAudit(tabId) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    files: ['content/page-audit.js'],
  });
  return results?.[0]?.result ?? null;
}

async function resolveContext() {
  const tab = await getActiveTab();
  if (!tab?.url || !/^https?:/i.test(tab.url)) {
    return { tab, pageUrl: null, property: null, sites: [], error: 'Open an http(s) page to analyze.' };
  }
  const token = await ensureToken(false);
  if (!token) {
    return { tab, pageUrl: tab.url, property: null, sites: [], needsAuth: true };
  }
  const sites = await listSites(token);
  const property = matchProperty(tab.url, sites);
  return { tab, pageUrl: tab.url, property, sites, token };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  handleMessage(message)
    .then((result) => sendResponse({ ok: true, result }))
    .catch((err) =>
      sendResponse({
        ok: false,
        error: err.message || String(err),
        code: err.code,
        status: err.status,
      })
    );
  return true;
});

async function handleMessage(message) {
  switch (message.type) {
    case 'GET_SETUP': {
      const clientId = await getClientId();
      return {
        clientId,
        redirectUri: redirectUri(),
        scopes: SCOPES,
        extensionId: chrome.runtime.id,
      };
    }
    case 'SET_CLIENT_ID': {
      await setClientId(message.clientId);
      await clearToken();
      return { saved: true };
    }
    case 'SIGN_IN': {
      const token = await ensureToken(true);
      return { signedIn: Boolean(token) };
    }
    case 'SIGN_OUT': {
      await signOut();
      return { signedIn: false };
    }
    case 'GET_CONTEXT': {
      const ctx = await resolveContext();
      return {
        pageUrl: ctx.pageUrl,
        property: ctx.property,
        sites: ctx.sites,
        needsAuth: Boolean(ctx.needsAuth),
        error: ctx.error,
        tabTitle: ctx.tab?.title,
      };
    }
    case 'GET_ANALYTICS': {
      const token = await ensureToken(true);
      const range = message.range || defaultRange(message.days || 28);
      const prev = previousRange(range.startDate, range.endDate);
      const siteUrl = message.siteUrl;
      const pageUrl = message.scope === 'domain' ? null : message.pageUrl;

      const [current, previous, series, queries, deltas] = await Promise.all([
        pageMetrics(token, siteUrl, { ...range, pageUrl }),
        pageMetrics(token, siteUrl, { ...prev, pageUrl }),
        dailySeries(token, siteUrl, { ...range, pageUrl }),
        topQueries(token, siteUrl, { ...range, pageUrl, rowLimit: 25 }),
        queryDeltas(token, siteUrl, { current: range, previous: prev, pageUrl }),
      ]);

      return {
        range,
        previousRange: prev,
        metrics: current,
        previousMetrics: previous,
        changes: {
          clicks: pctChange(current.clicks, previous.clicks),
          impressions: pctChange(current.impressions, previous.impressions),
          ctr: pctChange(current.ctr, previous.ctr),
          position: pctChange(current.position, previous.position),
        },
        series,
        queries,
        deltas,
        deepLink: gscPropertyDeepLink(siteUrl),
      };
    }
    case 'INSPECT_URL': {
      const token = await ensureToken(true);
      const data = await inspectUrl(token, {
        inspectionUrl: message.pageUrl,
        siteUrl: message.siteUrl,
      });
      return {
        inspection: data.inspectionResult,
        gscLink: gscInspectDeepLink(message.siteUrl, message.pageUrl),
      };
    }
    case 'REQUEST_INDEXING': {
      const token = await ensureToken(true);
      const type = message.notifyType || 'URL_UPDATED';
      const result = await publishUrlNotification(token, {
        url: message.pageUrl,
        type,
      });
      return { result, gscLink: gscInspectDeepLink(message.siteUrl, message.pageUrl) };
    }
    case 'INDEXING_STATUS': {
      const token = await ensureToken(true);
      return getUrlNotificationMetadata(token, message.pageUrl);
    }
    case 'LIST_SITEMAPS': {
      const token = await ensureToken(true);
      return listSitemaps(token, message.siteUrl);
    }
    case 'SUBMIT_SITEMAP': {
      const token = await ensureToken(true);
      await submitSitemap(token, message.siteUrl, message.feedpath);
      return { submitted: true };
    }
    case 'PAGE_AUDIT': {
      const tab = await getActiveTab();
      if (!tab?.id) throw new Error('No active tab');
      return runPageAudit(tab.id);
    }
    case 'LIST_NOTES': {
      const notes = await loadNotes();
      const filtered = message.pageUrl
        ? notes.filter(
            (n) =>
              n.pageUrl === message.pageUrl ||
              n.scope === 'property' && n.siteUrl === message.siteUrl
          )
        : notes;
      return filtered;
    }
    case 'ADD_NOTE': {
      return saveNote(message.note);
    }
    case 'DELETE_NOTE': {
      await deleteNote(message.id);
      return { deleted: true };
    }
    case 'OPEN_URL': {
      await chrome.tabs.create({ url: message.url });
      return { opened: true };
    }
    default: {
      const _exhaustive = message.type;
      throw new Error(`Unknown message type: ${_exhaustive}`);
    }
  }
}
