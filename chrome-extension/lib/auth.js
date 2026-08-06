/**
 * OAuth for Chrome extensions via chrome.identity.launchWebAuthFlow.
 * User supplies their own Google Cloud OAuth Client ID (Chrome extension type)
 * in Options — keeps this project open-source without shipping secrets.
 */

const SCOPES = [
  'https://www.googleapis.com/auth/webmasters',
  'https://www.googleapis.com/auth/indexing',
].join(' ');

const TOKEN_KEY = 'pulse_seo_token';
const CLIENT_ID_KEY = 'pulse_seo_client_id';

export async function getClientId() {
  const { [CLIENT_ID_KEY]: id } = await chrome.storage.sync.get(CLIENT_ID_KEY);
  return id || '';
}

export async function setClientId(clientId) {
  await chrome.storage.sync.set({ [CLIENT_ID_KEY]: clientId.trim() });
}

function redirectUri() {
  return `https://${chrome.runtime.id}.chromiumapp.org/`;
}

async function loadCachedToken() {
  const { [TOKEN_KEY]: cached } = await chrome.storage.session.get(TOKEN_KEY);
  if (!cached?.access_token) return null;
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
  await chrome.storage.session.set({ [TOKEN_KEY]: record });
  return record.access_token;
}

export async function clearToken() {
  await chrome.storage.session.remove(TOKEN_KEY);
}

/**
 * Interactive or silent OAuth. Uses Google OAuth 2.0 implicit flow
 * suitable for Chrome extensions (no client secret).
 */
export async function getAccessToken({ interactive = true } = {}) {
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

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'token',
    redirect_uri: redirectUri(),
    scope: SCOPES,
    prompt: interactive ? 'consent' : 'none',
  });

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
    throw new Error(result.error_description || result.error);
  }
  if (!result.access_token) {
    throw new Error('No access token returned from Google.');
  }
  return cacheToken(result);
}

export async function signOut() {
  const cached = await loadCachedToken();
  await clearToken();
  if (cached) {
    try {
      await fetch(`https://oauth2.googleapis.com/revoke?token=${cached}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
    } catch {
      /* revoke best-effort */
    }
  }
}

export { SCOPES, CLIENT_ID_KEY, redirectUri };
