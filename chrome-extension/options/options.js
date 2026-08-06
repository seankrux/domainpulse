const $ = (sel) => document.querySelector(sel);

async function api(type, payload = {}) {
  const res = await chrome.runtime.sendMessage({ type, ...payload });
  if (!res?.ok) throw new Error(res?.error || 'Failed');
  return res.result;
}

async function init() {
  const setup = await api('GET_SETUP');
  $('#extId').textContent = setup.extensionId;
  $('#redirectUri').textContent = setup.redirectUri;
  $('#scopes').textContent = setup.scopes;
  $('#clientId').value = setup.clientId || '';
}

$('#saveBtn').addEventListener('click', async () => {
  const clientId = $('#clientId').value.trim();
  if (!clientId) {
    $('#savedMsg').textContent = 'Client ID is required.';
    return;
  }
  await api('SET_CLIENT_ID', { clientId });
  $('#savedMsg').textContent = 'Saved. Open the side panel and sign in.';
});

init().catch((err) => {
  $('#savedMsg').textContent = err.message;
});
