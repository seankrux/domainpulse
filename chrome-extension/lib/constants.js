/** Shared constants for PulseSEO. */

export const STORAGE = {
  TOKEN: 'pulse_seo_token',
  CLIENT_ID: 'pulse_seo_client_id',
  NOTES: 'pulse_seo_notes',
  QUOTA: 'pulse_seo_quota',
  FORCE_INTERACTIVE: 'pulse_seo_force_interactive',
};

export const MSG = {
  GET_SETUP: 'GET_SETUP',
  SET_CLIENT_ID: 'SET_CLIENT_ID',
  SIGN_IN: 'SIGN_IN',
  SIGN_OUT: 'SIGN_OUT',
  GET_CONTEXT: 'GET_CONTEXT',
  GET_ANALYTICS: 'GET_ANALYTICS',
  INSPECT_URL: 'INSPECT_URL',
  REQUEST_INDEXING: 'REQUEST_INDEXING',
  INDEXING_STATUS: 'INDEXING_STATUS',
  LIST_SITEMAPS: 'LIST_SITEMAPS',
  SUBMIT_SITEMAP: 'SUBMIT_SITEMAP',
  PING_WEBSUB: 'PING_WEBSUB',
  PAGE_AUDIT: 'PAGE_AUDIT',
  LIST_NOTES: 'LIST_NOTES',
  ADD_NOTE: 'ADD_NOTE',
  DELETE_NOTE: 'DELETE_NOTE',
  OPEN_GSC_INSPECT: 'OPEN_GSC_INSPECT',
  OPEN_GSC_PERF: 'OPEN_GSC_PERF',
  GET_QUOTA: 'GET_QUOTA',
  FETCH_SITEMAP_URLS: 'FETCH_SITEMAP_URLS',
  BULK_INSPECT: 'BULK_INSPECT',
};

export const INDEX_TYPES = new Set(['URL_UPDATED', 'URL_DELETED']);

export const ALLOWED_OPEN_HOSTS = new Set([
  'search.google.com',
  'console.cloud.google.com',
  'myaccount.google.com',
]);

/** Conservative local quotas (Google docs: Inspection ~2000/day/property, Indexing default 200). */
export const QUOTA_DEFAULTS = {
  inspectPerDay: 2000,
  indexPerDay: 200,
};
