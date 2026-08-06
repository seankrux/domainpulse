import { MSG } from '../lib/constants.js';

const state = {
  scope: 'page',
  pageUrl: null,
  siteUrl: null,
  sites: [],
  analytics: null,
  queryFilter: 'all',
  monitorFilter: 'all',
  monitorRows: [],
  needsAuth: true,
  tab: 'analytics',
  seq: 0,
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

async function api(type, payload = {}) {
  const res = await chrome.runtime.sendMessage({ type, ...payload });
  if (!res?.ok) {
    const err = new Error(res?.error || 'Request failed');
    err.code = res?.code;
    err.status = res?.status;
    err.hint = res?.hint;
    err.gscLink = res?.gscLink;
    throw err;
  }
  return res.result;
}

function showBanner(kind, msg) {
  const el = kind === 'error' ? $('#errorBanner') : $('#statusBanner');
  const other = kind === 'error' ? $('#statusBanner') : $('#errorBanner');
  other.hidden = true;
  if (!msg) {
    el.hidden = true;
    el.textContent = '';
    return;
  }
  el.textContent = msg;
  el.hidden = false;
  if (kind === 'info') {
    clearTimeout(showBanner._t);
    showBanner._t = setTimeout(() => {
      el.hidden = true;
    }, 4000);
  }
}

const showError = (msg) => showBanner('error', msg);
const showStatus = (msg) => showBanner('info', msg);

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fmtNum(n) {
  if (n == null || Number.isNaN(n)) return '—';
  return new Intl.NumberFormat().format(Math.round(n));
}

function fmtPct(n) {
  if (n == null || Number.isNaN(n)) return '—';
  return `${(n * 100).toFixed(1)}%`;
}

function fmtPos(n) {
  if (n == null || Number.isNaN(n)) return '—';
  return Number(n).toFixed(1);
}

function fmtDelta(n, invert = false) {
  if (n == null || Number.isNaN(n)) return { text: '', cls: '' };
  const good = invert ? n < 0 : n > 0;
  const bad = invert ? n > 0 : n < 0;
  const sign = n > 0 ? '+' : '';
  return {
    text: `${sign}${n.toFixed(1)}% vs prior`,
    cls: good ? 'up' : bad ? 'down' : '',
  };
}

function setAuthGate(needsAuth, hint = '') {
  state.needsAuth = needsAuth;
  document.body.classList.toggle('gated', needsAuth);
  document.body.classList.remove('booting');
  document.body.removeAttribute('aria-busy');
  $('#authHint').textContent = hint;
  $('#authGate').hidden = !needsAuth;
  $('#signOutBtn').hidden = needsAuth;
  if (needsAuth) {
    $$('[id^="panel-"]').forEach((p) => {
      p.hidden = true;
    });
    $('#authGate').hidden = false;
    return;
  }
  switchTab(state.tab || 'analytics');
}

function switchTab(name) {
  state.tab = name;
  $$('.tab').forEach((t) => {
    const on = t.dataset.tab === name;
    t.classList.toggle('active', on);
    t.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  $$('[id^="panel-"]').forEach((p) => {
    p.hidden = p.id !== `panel-${name}`;
  });
  if (!state.needsAuth) $('#authGate').hidden = true;
}

function resetResults() {
  state.analytics = null;
  state.monitorRows = [];
  $('#queriesTable').innerHTML = '';
  $('#inspectResult').hidden = true;
  $('#inspectResult').innerHTML = '';
  $('#auditResult').innerHTML = '';
  $('#indexingOut').hidden = true;
  $('#indexingOut').textContent = '';
  $('#monitorTable').innerHTML = '<div class="muted">No URLs loaded.</div>';
  ['clicks', 'impressions', 'ctr', 'position'].forEach((k) => {
    $(`[data-k="${k}"]`).textContent = '—';
    $(`[data-d="${k}"]`).textContent = '';
    $(`[data-d="${k}"]`).className = 'metric-delta';
  });
  drawChart([]);
  $('#chartSummary').textContent = '';
}

function renderQuota(q) {
  const el = $('#quotaMeter');
  if (!q) {
    el.hidden = true;
    return;
  }
  el.hidden = false;
  el.textContent = `Today · Inspect ${q.inspect}/${q.inspectLimit} · Indexing API ${q.index}/${q.indexLimit}`;
}

function drawChart(series, noteDates = []) {
  const canvas = $('#chart');
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth || 360;
  const cssH = 120;
  canvas.width = cssW * dpr;
  canvas.height = cssH * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);

  const styles = getComputedStyle(document.documentElement);
  const muted = styles.getPropertyValue('--muted').trim() || '#8b9bb0';
  const line = styles.getPropertyValue('--line').trim() || '#2a3441';
  const accent = styles.getPropertyValue('--accent').trim() || '#3d9cf0';
  const good = styles.getPropertyValue('--good').trim() || '#3ecf8e';
  const warn = styles.getPropertyValue('--warn').trim() || '#e6c07b';

  if (!series?.length) {
    ctx.fillStyle = muted;
    ctx.font = '12px sans-serif';
    ctx.fillText('No trend data for this range', 12, 60);
    return;
  }

  const pad = { t: 8, r: 8, b: 16, l: 8 };
  const w = cssW - pad.l - pad.r;
  const h = cssH - pad.t - pad.b;
  const clicks = series.map((s) => s.clicks);
  const imps = series.map((s) => s.impressions);
  const maxC = Math.max(...clicks, 1);
  const maxI = Math.max(...imps, 1);
  const xAt = (i) => pad.l + (i / Math.max(series.length - 1, 1)) * w;
  const yC = (v) => pad.t + h - (v / maxC) * h;
  const yI = (v) => pad.t + h - (v / maxI) * h;

  const dateSet = new Set(noteDates);
  series.forEach((s, i) => {
    if (!dateSet.has(s.date)) return;
    const x = xAt(i);
    ctx.strokeStyle = warn;
    ctx.beginPath();
    ctx.moveTo(x, pad.t);
    ctx.lineTo(x, pad.t + h);
    ctx.stroke();
  });

  ctx.strokeStyle = line;
  ctx.beginPath();
  ctx.moveTo(pad.l, pad.t + h);
  ctx.lineTo(pad.l + w, pad.t + h);
  ctx.stroke();

  const lineDraw = (vals, yFn, color) => {
    ctx.beginPath();
    vals.forEach((v, i) => {
      const x = xAt(i);
      const y = yFn(v);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
    if (vals.length === 1) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(xAt(0), yFn(vals[0]), 3, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  lineDraw(imps, yI, good);
  lineDraw(clicks, yC, accent);

  const first = series[0]?.date;
  const last = series[series.length - 1]?.date;
  $('#chartSummary').textContent = `${first} → ${last} (dual scale)`;
}

function renderMetrics(analytics) {
  if (!analytics) return;
  const { metrics, changes } = analytics;
  $('[data-k="clicks"]').textContent = fmtNum(metrics.clicks);
  $('[data-k="impressions"]').textContent = fmtNum(metrics.impressions);
  $('[data-k="ctr"]').textContent = fmtPct(metrics.ctr);
  $('[data-k="position"]').textContent = fmtPos(metrics.position);

  for (const [key, invert] of [
    ['clicks', false],
    ['impressions', false],
    ['ctr', false],
    ['position', true],
  ]) {
    const el = $(`[data-d="${key}"]`);
    const d = fmtDelta(changes[key], invert);
    el.textContent = d.text;
    el.className = `metric-delta ${d.cls}`;
  }

  const noteDates = (analytics.notes || []).map((n) => n.createdAt?.slice(0, 10)).filter(Boolean);
  drawChart(analytics.series, noteDates);
  $('#rangeHint').textContent = `${analytics.range.startDate} → ${analytics.range.endDate}`;
  renderQueries();
}

function queryRows() {
  const a = state.analytics;
  if (!a) return [];
  switch (state.queryFilter) {
    case 'growing':
      return a.deltas.growing;
    case 'decaying':
      return a.deltas.decaying;
    case 'new':
      return a.deltas.newRanking;
    case 'all':
    default:
      return a.queries;
  }
}

function renderQueries() {
  const rows = queryRows();
  const root = $('#queriesTable');
  const showDelta = state.queryFilter === 'growing' || state.queryFilter === 'decaying';
  if (!rows.length) {
    root.innerHTML = '<div class="muted">No queries in this view.</div>';
    return;
  }
  root.innerHTML = [
    `<div class="row head"><span>Query</span><span class="num">Clicks</span><span class="num">Impr.</span><span class="num">Pos</span>${showDelta ? '<span class="num">Δ</span>' : '<span></span>'}</div>`,
    ...rows.map((q) => {
      const delta =
        q.delta == null ? '' : (q.delta > 0 ? '+' : '') + q.delta;
      return `<div class="row" title="${escapeHtml(q.query)}"><span class="q">${escapeHtml(q.query)}</span><span class="num">${fmtNum(q.clicks)}</span><span class="num">${fmtNum(q.impressions)}</span><span class="num">${fmtPos(q.position)}</span><span class="num">${escapeHtml(delta)}</span></div>`;
    }),
  ].join('');
}

function fillProperties(sites, selected) {
  const sel = $('#propertySelect');
  sel.innerHTML = '';
  if (!sites.length) {
    sel.innerHTML = '<option value="">No GSC properties</option>';
    sel.disabled = true;
    state.siteUrl = null;
    return;
  }
  if (!selected) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'No property matched — pick one';
    sel.appendChild(opt);
  }
  for (const s of sites) {
    const opt = document.createElement('option');
    opt.value = s.siteUrl;
    opt.textContent = s.siteUrl;
    if (selected && s.siteUrl === selected) opt.selected = true;
    sel.appendChild(opt);
  }
  sel.disabled = false;
  state.siteUrl = selected || '';
}

function downloadCsv(filename, rows) {
  const csv = rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function monitorBucket(row) {
  if (!row.ok) return 'error';
  const cov = `${row.coverageState || ''} ${row.verdict || ''}`;
  if (/Indexed|PASS/i.test(cov) && !/Excluded|not indexed|FAIL/i.test(cov)) return 'indexed';
  return 'not';
}

function renderMonitor() {
  const root = $('#monitorTable');
  const rows = state.monitorRows.filter((r) => {
    if (state.monitorFilter === 'all') return true;
    return monitorBucket(r) === state.monitorFilter;
  });
  if (!rows.length) {
    root.innerHTML = '<div class="muted">No rows in this filter.</div>';
    return;
  }
  root.innerHTML = [
    '<div class="row compact head"><span>URL</span><span>Coverage</span><span>Verdict</span></div>',
    ...rows.map(
      (r) =>
        `<div class="row compact" title="${escapeHtml(r.url)}"><span class="q">${escapeHtml(r.url)}</span><span class="num">${escapeHtml(r.coverageState || r.error || '—')}</span><span class="num">${escapeHtml(r.verdict || '')}</span></div>`
    ),
  ].join('');
}

async function loadContext() {
  const seq = ++state.seq;
  showError('');
  try {
    const ctx = await api(MSG.GET_CONTEXT);
    if (seq !== state.seq) return;
    state.pageUrl = ctx.pageUrl;
    state.sites = ctx.sites || [];
    $('#pageUrl').textContent = ctx.pageUrl || ctx.error || '—';
    $('#pageUrl').title = ctx.pageUrl || '';
    $('#scopeLabel').textContent = ctx.tabTitle || 'GSC Command Center';
    renderQuota(ctx.quota);

    if (ctx.error && !ctx.pageUrl) {
      setAuthGate(false);
      resetResults();
      showError(ctx.error);
      return;
    }

    if (ctx.needsAuth) {
      setAuthGate(true, 'Sign in to load analytics for this page.');
      return;
    }

    setAuthGate(false);
    fillProperties(state.sites, ctx.property?.siteUrl || null);
    resetResults();
    if (!state.siteUrl) {
      showError(
        'No auto-matched property for this URL (URL-prefix properties do not cover www↔apex). Pick a matching property, or switch Scope to Domain.'
      );
      return;
    }
    await Promise.all([loadAnalytics(seq), loadNotes(seq), loadSitemaps(seq)]);
  } catch (err) {
    if (seq !== state.seq) return;
    if (err.code === 'NO_CLIENT_ID') {
      setAuthGate(true, err.message);
      return;
    }
    showError(err.message);
  }
}

async function loadAnalytics(seq = state.seq) {
  if (!state.siteUrl || !state.pageUrl) return;
  showStatus('Loading analytics…');
  try {
    const analytics = await api(MSG.GET_ANALYTICS, {
      siteUrl: state.siteUrl,
      pageUrl: state.pageUrl,
      scope: state.scope,
      days: Number($('#rangeSelect').value),
      device: $('#deviceSelect').value,
      searchType: $('#typeSelect').value,
    });
    if (seq !== state.seq) return;
    state.analytics = analytics;
    renderMetrics(analytics);
    showStatus('');
  } catch (err) {
    if (seq !== state.seq) return;
    showStatus('');
    showError(err.message);
  }
}

async function loadSitemaps(seq = state.seq) {
  if (!state.siteUrl) return;
  const root = $('#sitemapsList');
  try {
    const list = await api(MSG.LIST_SITEMAPS, { siteUrl: state.siteUrl });
    if (seq !== state.seq) return;
    if (!list.length) {
      root.innerHTML = '<div class="muted">No sitemaps submitted yet.</div>';
      return;
    }
    root.innerHTML = list
      .map((s) => {
        const path = s.path || s;
        const last = s.lastSubmitted || s.lastDownloaded || '';
        return `<div class="row compact"><span class="q">${escapeHtml(path)}</span><span class="num" style="grid-column: span 2">${escapeHtml(last)}</span></div>`;
      })
      .join('');
  } catch (err) {
    if (seq !== state.seq) return;
    root.innerHTML = `<div class="muted">${escapeHtml(err.message)}</div>`;
  }
}

async function loadNotes(seq = state.seq) {
  try {
    const notes = await api(MSG.LIST_NOTES, {
      pageUrl: state.pageUrl,
      siteUrl: state.siteUrl,
    });
    if (seq !== state.seq) return;
    const root = $('#notesList');
    if (!notes.length) {
      root.innerHTML = '<div class="muted">No notes yet for this page.</div>';
      return;
    }
    root.replaceChildren();
    for (const n of notes) {
      const article = document.createElement('article');
      article.className = 'note';
      article.dataset.id = n.id;
      const title = document.createElement('div');
      title.className = 'note-title';
      title.textContent = n.title;
      const meta = document.createElement('div');
      meta.className = 'note-meta';
      meta.textContent = `${new Date(n.createdAt).toLocaleString()} · ${n.scope}${n.pageUrl ? ` · ${n.pageUrl}` : ''}`;
      const body = document.createElement('div');
      body.className = 'note-body';
      body.textContent = n.body || '';
      const actions = document.createElement('div');
      actions.className = 'note-actions';
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'linkish del-note';
      del.dataset.id = n.id;
      del.textContent = 'Delete';
      actions.appendChild(del);
      article.append(title, meta, body, actions);
      root.appendChild(article);
    }
  } catch (err) {
    if (seq !== state.seq) return;
    $('#notesList').innerHTML = `<div class="muted">${escapeHtml(err.message)}</div>`;
  }
}

function renderInspection(result) {
  const root = $('#inspectResult');
  const r = result.inspection;
  const idx = r?.indexStatusResult || {};
  const verdict = idx.verdict || 'N/A';
  const coverage = idx.coverageState || '';
  const pillClass =
    /PASS/i.test(verdict) || /Indexed/i.test(coverage)
      ? 'good'
      : /FAIL|Excluded|Error/i.test(`${verdict} ${coverage}`)
        ? 'bad'
        : 'warn';

  root.hidden = false;
  root.innerHTML = `
    <div class="card">
      <div class="card-head">
        <span>Index status</span>
        <span class="pill ${pillClass}">${escapeHtml(verdict)}</span>
      </div>
      <dl class="kv">
        <dt>Coverage</dt><dd>${escapeHtml(idx.coverageState || '—')}</dd>
        <dt>Robots</dt><dd>${escapeHtml(idx.robotsTxtState || '—')}</dd>
        <dt>Indexing</dt><dd>${escapeHtml(idx.indexingState || '—')}</dd>
        <dt>Last crawl</dt><dd>${escapeHtml(idx.lastCrawlTime || '—')}</dd>
        <dt>Fetch</dt><dd>${escapeHtml(String(idx.pageFetchState || '—'))}</dd>
        <dt>Canonical (Google)</dt><dd>${escapeHtml(idx.googleCanonical || '—')}</dd>
        <dt>Canonical (user)</dt><dd>${escapeHtml(idx.userCanonical || '—')}</dd>
        <dt>Sitemap</dt><dd>${escapeHtml((idx.sitemap || []).join(', ') || '—')}</dd>
        <dt>Referring URLs</dt><dd>${escapeHtml((idx.referringUrls || []).slice(0, 5).join(', ') || '—')}</dd>
      </dl>
      <button type="button" class="btn ghost block" id="openInspectLink">Open full report in GSC</button>
      <button type="button" class="btn ghost block" id="exportInspectBtn">Export JSON</button>
    </div>`;

  $('#openInspectLink')?.addEventListener('click', () => {
    api(MSG.OPEN_GSC_INSPECT, { siteUrl: state.siteUrl, pageUrl: state.pageUrl });
  });
  $('#exportInspectBtn')?.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(result.inspection, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pulse-seo-inspect.json';
    a.click();
    URL.revokeObjectURL(url);
  });
  if (result.quota) renderQuota(result.quota);
}

function severityClass(sev) {
  return sev === 'error' || sev === 'warn' || sev === 'info' ? sev : 'info';
}

function renderAudit(audit) {
  const root = $('#auditResult');
  if (!audit || audit.ok === false) {
    root.innerHTML = `<div class="muted">${escapeHtml(audit?.error || 'Could not audit this page.')}</div>`;
    return;
  }
  root.innerHTML = `
    <div class="card">
      <div class="card-head">Signals</div>
      <dl class="kv">
        <dt>Title</dt><dd>${escapeHtml(audit.title)} <span class="muted">(${audit.titleLength})</span></dd>
        <dt>Description</dt><dd>${escapeHtml(audit.description || '—')} <span class="muted">(${audit.descriptionLength})</span></dd>
        <dt>Canonical</dt><dd>${escapeHtml(audit.canonical || '—')}</dd>
        <dt>Robots</dt><dd>${escapeHtml(audit.robotsMeta || '—')}</dd>
        <dt>OG</dt><dd>${escapeHtml([audit.og?.title, audit.og?.description, audit.og?.image].filter(Boolean).join(' · ') || '—')}</dd>
        <dt>H1</dt><dd>${escapeHtml(audit.headings.h1.join(' | ') || '—')}</dd>
        <dt>H2 / H3</dt><dd>${audit.headings.h2Count} / ${audit.headings.h3Count}</dd>
        <dt>Words</dt><dd>${fmtNum(audit.wordCount)}</dd>
        <dt>Images</dt><dd>${audit.images.total} (${audit.images.missingAlt} missing alt)</dd>
        <dt>Links</dt><dd>${audit.links.internal} in / ${audit.links.external} out / ${audit.links.other || 0} other</dd>
        <dt>JSON-LD</dt><dd>${escapeHtml(audit.jsonLdTypes.join(', ') || 'none')}</dd>
      </dl>
      <p class="muted">${escapeHtml(audit.limitations || '')}</p>
    </div>
    <div class="card">
      <div class="card-head">Issues (${audit.issues.length})</div>
      ${
        audit.issues.length
          ? audit.issues
              .map(
                (i) =>
                  `<div class="issue ${severityClass(i.severity)}">${escapeHtml(i.message)}</div>`
              )
              .join('')
          : '<div class="muted">No issues flagged.</div>'
      }
    </div>`;
}

function bindExclusive(rootSel, btnSel, attr, onChange) {
  $$(`${rootSel} ${btnSel}`).forEach((b) =>
    b.addEventListener('click', () => {
      $$(`${rootSel} ${btnSel}`).forEach((x) => {
        x.classList.remove('active');
        x.setAttribute('aria-pressed', 'false');
      });
      b.classList.add('active');
      b.setAttribute('aria-pressed', 'true');
      onChange(b.dataset[attr]);
    })
  );
}

function bind() {
  $$('.tab').forEach((t) =>
    t.addEventListener('click', () => {
      if (state.needsAuth) return;
      switchTab(t.dataset.tab);
    })
  );

  bindExclusive('.seg', '.seg-btn', 'scope', (scope) => {
    state.scope = scope;
    const seq = ++state.seq;
    loadAnalytics(seq);
  });
  bindExclusive('#queryFilter', '.mini', 'qf', (qf) => {
    state.queryFilter = qf;
    renderQueries();
  });
  bindExclusive('#monitorFilter', '.mini', 'mf', (mf) => {
    state.monitorFilter = mf;
    renderMonitor();
  });

  ['#rangeSelect', '#deviceSelect', '#typeSelect'].forEach((sel) => {
    $(sel).addEventListener('change', () => {
      const seq = ++state.seq;
      loadAnalytics(seq);
    });
  });

  $('#propertySelect').addEventListener('change', (e) => {
    state.siteUrl = e.target.value;
    const seq = ++state.seq;
    resetResults();
    if (!state.siteUrl) return;
    loadAnalytics(seq);
    loadSitemaps(seq);
    loadNotes(seq);
  });

  $('#refreshBtn').addEventListener('click', () => loadContext());
  $('#settingsBtn').addEventListener('click', () => chrome.runtime.openOptionsPage());
  $('#openOptionsBtn').addEventListener('click', () => chrome.runtime.openOptionsPage());

  $('#signInBtn').addEventListener('click', async () => {
    try {
      await api(MSG.SIGN_IN);
      state.tab = 'analytics';
      await loadContext();
    } catch (err) {
      showError(err.message);
    }
  });

  $('#signOutBtn').addEventListener('click', async () => {
    await api(MSG.SIGN_OUT);
    resetResults();
    setAuthGate(true, 'Signed out. Revoke app access at myaccount.google.com/permissions if needed.');
  });

  $('#inspectBtn').addEventListener('click', async () => {
    try {
      showStatus('Inspecting URL…');
      const result = await api(MSG.INSPECT_URL, {
        siteUrl: state.siteUrl,
        pageUrl: state.pageUrl,
      });
      renderInspection(result);
      showStatus('');
    } catch (err) {
      showStatus('');
      showError(err.message);
    }
  });

  const requestIndex = async (notifyType) => {
    if (notifyType === 'URL_DELETED') {
      const ok = confirm('Notify Google that this URL was deleted?');
      if (!ok) return;
    }
    const btn = notifyType === 'URL_DELETED' ? $('#indexDeletedBtn') : $('#indexUpdatedBtn');
    btn.disabled = true;
    try {
      const out = await api(MSG.REQUEST_INDEXING, {
        siteUrl: state.siteUrl,
        pageUrl: state.pageUrl,
        notifyType,
      });
      const pre = $('#indexingOut');
      pre.hidden = false;
      pre.textContent = JSON.stringify(out.result, null, 2);
      if (out.quota) renderQuota(out.quota);
      showStatus(`${notifyType} submitted via Indexing API.`);
    } catch (err) {
      showError(
        `${err.message}${err.hint ? ` — ${err.hint}` : ''} Prefer Open GSC Inspection.`
      );
      if (err.gscLink) {
        /* keep primary CTA available */
      }
    } finally {
      btn.disabled = false;
    }
  };

  $('#indexUpdatedBtn').addEventListener('click', () => requestIndex('URL_UPDATED'));
  $('#indexDeletedBtn').addEventListener('click', () => requestIndex('URL_DELETED'));
  $('#openGscInspect').addEventListener('click', () =>
    api(MSG.OPEN_GSC_INSPECT, { siteUrl: state.siteUrl, pageUrl: state.pageUrl })
  );
  $('#indexingMetaBtn').addEventListener('click', async () => {
    try {
      const meta = await api(MSG.INDEXING_STATUS, { pageUrl: state.pageUrl });
      const pre = $('#indexingOut');
      pre.hidden = false;
      pre.textContent = JSON.stringify(meta, null, 2);
    } catch (err) {
      showError(err.message);
    }
  });

  $('#submitSitemapBtn').addEventListener('click', async () => {
    const feedpath = $('#sitemapUrl').value.trim();
    if (!feedpath) {
      showError('Enter a sitemap URL.');
      return;
    }
    try {
      const out = await api(MSG.SUBMIT_SITEMAP, {
        siteUrl: state.siteUrl,
        feedpath,
        pingWebSub: $('#pingWebSub').checked,
      });
      showStatus(
        out.websub?.ok
          ? 'Sitemap submitted + WebSub pinged.'
          : out.websub?.error
            ? `Sitemap submitted; WebSub: ${out.websub.error}`
            : 'Sitemap submitted.'
      );
      await loadSitemaps();
    } catch (err) {
      showError(err.message);
    }
  });

  $('#openGscPerf').addEventListener('click', () => {
    if (!state.siteUrl) {
      showError('Select a property first.');
      return;
    }
    api(MSG.OPEN_GSC_PERF, { siteUrl: state.siteUrl });
  });

  $('#exportQueriesBtn').addEventListener('click', () => {
    const rows = queryRows();
    if (!rows.length) {
      showError('No queries to export.');
      return;
    }
    downloadCsv('pulse-seo-queries.csv', [
      ['query', 'clicks', 'impressions', 'ctr', 'position', 'delta'],
      ...rows.map((q) => [q.query, q.clicks, q.impressions, q.ctr, q.position, q.delta ?? '']),
    ]);
  });

  $('#loadSitemapBtn').addEventListener('click', async () => {
    const feedpath = $('#monitorSitemap').value.trim();
    if (!feedpath) {
      showError('Enter a sitemap URL.');
      return;
    }
    try {
      showStatus('Fetching sitemap…');
      const { urls, count, dropped } = await api(MSG.FETCH_SITEMAP_URLS, {
        siteUrl: state.siteUrl,
        feedpath,
        limit: 200,
      });
      $('#monitorPaste').value = urls.join('\n');
      showStatus(
        dropped
          ? `Loaded ${count} URLs (${dropped} outside property dropped).`
          : `Loaded ${count} URLs.`
      );
    } catch (err) {
      showStatus('');
      showError(err.message);
    }
  });

  $('#runBulkInspectBtn').addEventListener('click', async () => {
    const urls = $('#monitorPaste')
      .value.split(/\n+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!urls.length) {
      showError('Paste or load URLs first.');
      return;
    }
    if (!state.siteUrl) {
      showError('Select a property first.');
      return;
    }
    $('#runBulkInspectBtn').disabled = true;
    try {
      showStatus(`Inspecting ${Math.min(urls.length, 25)} URLs…`);
      const { results, skipped, quota } = await api(MSG.BULK_INSPECT, {
        siteUrl: state.siteUrl,
        urls,
      });
      state.monitorRows = results;
      renderMonitor();
      if (quota) renderQuota(quota);
      showStatus(
        `Done — ${results.filter((r) => r.ok).length}/${results.length} ok` +
          (skipped ? ` (${skipped} skipped/not under property)` : '') +
          '.'
      );
    } catch (err) {
      showStatus('');
      showError(err.message);
    } finally {
      $('#runBulkInspectBtn').disabled = false;
    }
  });

  $('#exportMonitorBtn').addEventListener('click', () => {
    if (!state.monitorRows.length) {
      showError('Nothing to export.');
      return;
    }
    downloadCsv('pulse-seo-monitor.csv', [
      ['url', 'ok', 'verdict', 'coverageState', 'indexingState', 'lastCrawlTime', 'error'],
      ...state.monitorRows.map((r) => [
        r.url,
        r.ok,
        r.verdict,
        r.coverageState,
        r.indexingState,
        r.lastCrawlTime,
        r.error,
      ]),
    ]);
  });

  $('#auditBtn').addEventListener('click', async () => {
    try {
      const audit = await api(MSG.PAGE_AUDIT);
      renderAudit(audit);
    } catch (err) {
      showError(err.message);
    }
  });

  $('#saveNoteBtn').addEventListener('click', async () => {
    const title = $('#noteTitle').value.trim();
    if (!title) {
      showError('Note title is required.');
      return;
    }
    try {
      await api(MSG.ADD_NOTE, {
        note: {
          title,
          body: $('#noteBody').value.trim(),
          scope: $('#noteScope').value,
          pageUrl: state.pageUrl,
          siteUrl: state.siteUrl,
        },
      });
      $('#noteTitle').value = '';
      $('#noteBody').value = '';
      await loadNotes();
      // Refresh analytics so note markers appear on the chart
      if (state.siteUrl) loadAnalytics(++state.seq);
      showStatus('Note saved.');
    } catch (err) {
      showError(err.message);
    }
  });

  $('#notesList').addEventListener('click', async (e) => {
    const btn = e.target.closest('.del-note');
    if (!btn) return;
    if (!confirm('Delete this note?')) return;
    try {
      await api(MSG.DELETE_NOTE, { id: btn.dataset.id });
      await loadNotes();
    } catch (err) {
      showError(err.message);
    }
  });

  new ResizeObserver(() => {
    if (state.analytics?.series) {
      const noteDates = (state.analytics.notes || [])
        .map((n) => n.createdAt?.slice(0, 10))
        .filter(Boolean);
      drawChart(state.analytics.series, noteDates);
    }
  }).observe($('#chart'));
}

chrome.tabs.onActivated.addListener(() => {
  if (!state.needsAuth) loadContext();
});
chrome.tabs.onUpdated.addListener(async (tabId, change) => {
  if (change.status !== 'complete' || state.needsAuth) return;
  const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (active?.id === tabId) loadContext();
});

bind();
loadContext();
