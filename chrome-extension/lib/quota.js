import { STORAGE, QUOTA_DEFAULTS } from './constants.js';

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export async function getQuota(siteUrl) {
  const { [STORAGE.QUOTA]: all } = await chrome.storage.local.get(STORAGE.QUOTA);
  const day = todayKey();
  const key = `${day}::${siteUrl || 'global'}`;
  const entry = all?.[key] || { inspect: 0, index: 0 };
  return {
    day,
    siteUrl,
    inspect: entry.inspect,
    index: entry.index,
    inspectLimit: QUOTA_DEFAULTS.inspectPerDay,
    indexLimit: QUOTA_DEFAULTS.indexPerDay,
  };
}

export async function bumpQuota(siteUrl, kind) {
  const { [STORAGE.QUOTA]: all = {} } = await chrome.storage.local.get(STORAGE.QUOTA);
  const day = todayKey();
  const key = `${day}::${siteUrl || 'global'}`;
  const entry = all[key] || { inspect: 0, index: 0 };
  if (kind === 'inspect') entry.inspect += 1;
  if (kind === 'index') entry.index += 1;
  all[key] = entry;
  // prune old days
  for (const k of Object.keys(all)) {
    if (!k.startsWith(day)) delete all[k];
  }
  await chrome.storage.local.set({ [STORAGE.QUOTA]: all });
  return getQuota(siteUrl);
}

export async function assertQuota(siteUrl, kind) {
  const q = await getQuota(siteUrl);
  if (kind === 'inspect' && q.inspect >= q.inspectLimit) {
    throw new Error(`Daily URL Inspection quota reached (${q.inspectLimit}).`);
  }
  if (kind === 'index' && q.index >= q.indexLimit) {
    throw new Error(`Daily Indexing API quota reached (${q.indexLimit}).`);
  }
  return q;
}
