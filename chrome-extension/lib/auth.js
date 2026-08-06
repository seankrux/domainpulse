/**
 * OAuth via chrome.identity.launchWebAuthFlow (implicit token).
 * User supplies Chrome Extension OAuth Client ID in Options.
 */

import { STORAGE } from './constants.js';

const SCOPES = [
  'https://www.googleapis.com/auth/webmasters',
  'https://www.googleapis.com/auth/indexing',
].join(' ');

const CLIENT_ID_RE = /^\d+-[a-z0-9]+\.apps\.googleusercontent\.com$/i;

let inflight = null;

export async function getClientId() {
  const { [STORAGE.CLIENT_ID]: id } = await chrome.storage.sync.get(STORAGE.CLIENT_ID);
  return id || '';
}

export function validateClientId(clientId) {
  const trimmed = String(clientId || '').trim();
  if (!trimmed) return { ok: false, error: 'Client ID is required.' };
  if (!CLIENT_ID_RE.test(trimmed)) {
    return {
      ok: false,
      error: 'Client ID must look like 123-abc.apps.googleusercontent.com',
    };
  }
  return { ok: true, clientId: trimmed };
}

export async function setClientId(clientId) {
  const check = validateClientId(clientId);
  if (!check.ok) throw new Error(check.error);
  await chrome.storage.sync.set({ [STORAGE.CLIENT_ID]: check.clientId });
}

export function redirectUri() {
  return `https://${chrome.runtime.id}.chromiumapp.org/`;
}

async function readTokenRecord() {
  const { [STORAGE.TOKEN]: cached } = await chrome.storage.session.get(STORAGE.TOKEN);
  return cached?.access_token ? cached : null;
}

async function loadCachedToken() {
  const cached = await readTokenRecord();
  if (!cached) return null;
  if (cached.expires_at && Date.now() < cached.expires_at - 60_000) {
    return cached.access_token;
  }
  return null;
}

async function cacheToken(tokenResponse) {
  const expiresIn = Number(tokenResponse.expires_in || 3600);
  const record = {
    access_token: tokenResponse.access_token,
    expires_at: Date.now() + expiresIn * 1000,
  };
  await chrome.storage.session.set({ [STORAGE.TOKEN]: record });
  return record.access_token;
}

export async function clearToken() {
  await chrome.storage.session.remove(STORAGE.TOKEN);
}

async function revokeToken(accessToken) {
  if (!accessToken) return;
  try {
    await fetch('https://oauth2.googleapis.com/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token: accessToken }),
    });
  } catch {
    /* best-effort */
  }
}

async function getAccessTokenUnlocked({ interactive = true } = {}) {
  const cached = await loadCachedToken();
  if (cached) return cached;

  const clientId = await getClientId();
  if (!clientId) {
    const err = new Error(
      'Set your Google OAuth Client ID in PulseSEO Options before signing in.'
    );
    err.code = 'NO_CLIENT_ID';
    throw err;
  }

  const { [STORAGE.FORCE_INTERACTIVE]: forceInteractive } =
    await chrome.storage.session.get(STORAGE.FORCE_INTERACTIVE);

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'token',
    redirect_uri: redirectUri(),
    scope: SCOPES,
    include_granted_scopes: 'true',
  });

  if (!interactive) {
    params.set('prompt', 'none');
  } else if (forceInteractive) {
    params.set('prompt', 'select_account');
    await chrome.storage.session.remove(STORAGE.FORCE_INTERACTIVE);
  }

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;

  let redirectUrl;
  try {
    redirectUrl = await chrome.identity.launchWebAuthFlow({
      url: authUrl,
      interactive,
    });
  } catch (e) {
    if (!interactive) return null;
    throw e;
  }

  if (!redirectUrl) {
    if (!interactive) return null;
    throw new Error('Sign-in was cancelled.');
  }

  const hash = new URL(redirectUrl).hash.replace(/^#/, '');
  const result = Object.fromEntries(new URLSearchParams(hash));
  if (result.error) {
    if (!interactive) return null;
    throw new Error(result.error_description || result.error);
  }
  if (!result.access_token) {
    if (!interactive) return null;
    throw new Error('No access token returned from Google.');
  }
  return cacheToken(result);
}

/**
 * Interactive or silent OAuth. Single-flight coalesces callers with the same
 * interactive flag; an interactive request never joins a silent in-flight flow.
 */
export async function getAccessToken(opts = {}) {
  const interactive = Boolean(opts.interactive);
  if (inflight && inflight.interactive === interactive) {
    return inflight.promise;
  }
  if (inflight && interactive && !inflight.interactive) {
    // Wait for silent attempt to finish, then run interactive if still needed.
    try {
      const silent = await inflight.promise;
      if (silent) return silent;
    } catch {
      /* fall through to interactive */
    }
  } else if (inflight && !interactive && inflight.interactive) {
    return inflight.promise;
  }

  const promise = getAccessTokenUnlocked(opts).finally(() => {
    if (inflight?.promise === promise) inflight = null;
  });
  inflight = { interactive, promise };
  return promise;
}

export async function signOut() {
  const record = await readTokenRecord();
  await clearToken();
  await chrome.storage.session.set({ [STORAGE.FORCE_INTERACTIVE]: true });
  await revokeToken(record?.access_token);
}

/** Clear cached token after API 401 so the next call re-auths. */
export async function invalidateToken() {
  await clearToken();
}

export { SCOPES, CLIENT_ID_RE };
