import { MSG } from '../lib/constants.js';

const $ = (sel) => document.querySelector(sel);

async function api(type, payload = {}) {
  const res = await chrome.runtime.sendMessage({ type, ...payload });
  if (!res?.ok) {
    const err = new Error(res?.error || 'Failed');
    err.code = res?.code;
    throw err;
  }
  return res.result;
}

function setMsg(text, ok) {
  const el = $('#savedMsg');
  el.textContent = text;
  el.className = `saved ${ok ? 'msg-ok' : 'msg-err'}`;
}

async function init() {
  const setup = await api(MSG.GET_SETUP);
  $('#extId').textContent = setup.extensionId;
  $('#redirectUri').textContent = setup.redirectUri;
  $('#scopes').textContent = setup.scopes;
  $('#clientId').value = setup.clientId || '';
}

$('#saveBtn').addEventListener('click', async () => {
  try {
    const clientId = $('#clientId').value.trim();
    await api(MSG.SET_CLIENT_ID, { clientId });
    setMsg('Saved. Use Test sign-in or open the side panel.', true);
  } catch (err) {
    setMsg(err.message, false);
  }
});

$('#testSignInBtn').addEventListener('click', async () => {
  try {
    setMsg('Opening Google sign-in…', true);
    await api(MSG.SIGN_IN);
    setMsg('Sign-in OK. Open the side panel on a property page.', true);
  } catch (err) {
    setMsg(err.message, false);
  }
});

init().catch((err) => setMsg(err.message, false));
