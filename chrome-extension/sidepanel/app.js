const state = {
  scope: 'page',
  pageUrl: null,
  siteUrl: null,
  sites: [],
  analytics: null,
  queryFilter: 'all',
  needsAuth: false,
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

async function api(type, payload = {}) {
  const res = await chrome.runtime.sendMessage({ type, ...payload });
  if (!res?.ok) {
    const err = new Error(res?.error || 'Request failed');
    err.code = res?.code;
    err.status = res?.status;
    throw err;
  }
  return res.result;
}

function showError(msg) {
  const el = $('#errorBanner');
  if (!msg) {
    el.classList.add('hidden');
    el.textContent = '';
    return;
  }
  el.textContent = msg;
  el.classList.remove('hidden');
}

function showStatus(msg) {
  const el = $('#statusBanner');
  if (!msg) {
    el.classList.add('hidden');
    el.textContent = '';
    return;
  }
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(showStatus._t);
  showStatus._t = setTimeout(() => el.classList.add('hidden'), 4000);
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
  if (!n) return '—';
  return n.toFixed(1);
}

function fmtDelta(n, invert = false) {
  if (n == null || Number.isNaN(n)) return '';
  const good = invert ? n < 0 : n > 0;
  const bad = invert ? n > 0 : n < 0;
  const sign = n > 0 ? '+' : '';
  const cls = good ? 'up' : bad ? 'down' : '';
  return { text: `${sign}${n.toFixed(1)}% vs prior`, cls };
}

function setAuthGate(needsAuth, hint = '') {
  state.needsAuth = needsAuth;
  $('#authHint').textContent = hint;
  if (needsAuth) {
    $$('[id^="panel-"]').forEach((p) => p.classList.add('hidden'));
    $('#authGate').classList.remove('hidden');
    return;
  }
  $('#authGate').classList.add('hidden');
  switchTab('analytics');
}

function switchTab(name) {
  $$('.tab').forEach((t) => {
    const on = t.dataset.tab === name;
    t.classList.toggle('active', on);
    t.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  $$('[id^="panel-"]').forEach((p) => {
    p.classList.toggle('hidden', p.id !== `panel-${name}`);
  });
  if (!state.needsAuth) $('#authGate').classList.add('hidden');
}

function drawChart(series) {
  const canvas = $('#chart');
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth || 360;
  const cssH = 120;
  canvas.width = cssW * dpr;
  canvas.height = cssH * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);

  if (!series?.length) {
    ctx.fillStyle = '#8b9bb0';
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

  const line = (vals, yFn, color) => {
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
  };

  ctx.strokeStyle = '#2a3441';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad.l, pad.t + h);
  ctx.lineTo(pad.l + w, pad.t + h);
  ctx.stroke();

  line(imps, yI, '#3ecf8e');
  line(clicks, yC, '#3d9cf0');
}

function renderMetrics(analytics) {
  if (!analytics) return;
  const { metrics, changes } = analytics;
  $('[data-k="clicks"]').textContent = fmtNum(metrics.clicks);
  $('[data-k="impressions"]').textContent = fmtNum(metrics.impressions);
  $('[data-k="ctr"]').textContent = fmtPct(metrics.ctr);
  $('[data-k="position"]').textContent = fmtPos(metrics.position);

  const map = [
    ['clicks', false],
    ['impressions', false],
    ['ctr', false],
    ['position', true],
  ];
  for (const [key, invert] of map) {
    const el = $(`[data-d="${key}"]`);
    const d = fmtDelta(changes[key], invert);
    el.textContent = d.text || '';
    el.className = `metric-delta ${d.cls || ''}`;
  }
  drawChart(analytics.series);
  $('#rangeHint').textContent = `${analytics.range.startDate} → ${analytics.range.endDate}`;
  renderQueries();
}

function queryRows() {
  const a = state.analytics;
  if (!a) return [];
  switch (state.queryFilter) {
    case 'growing':
      return a.deltas.growing.map((q) => ({ ...q, extra: `+${q.delta}` }));
    case 'decaying':
      return a.deltas.decaying.map((q) => ({ ...q, extra: `${q.delta}` }));
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
  if (!rows.length) {
    root.innerHTML = '<div class="muted">No queries in this view.</div>';
    return;
  }
  root.innerHTML = [
    '<div class="row head"><span>Query</span><span class="num">Clicks</span><span class="num">Impr.</span><span class="num">Pos</span></div>',
    ...rows.map(
      (q) =>
        `<div class="row" title="${escapeAttr(q.query)}"><span class="q">${escapeHtml(q.query)}</span><span class="num">${fmtNum(q.clicks)}</span><span class="num">${fmtNum(q.impressions)}</span><span class="num">${fmtPos(q.position)}</span></div>`
    ),
  ].join('');
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(s) {
  return escapeHtml(s).replace(/"/g, '&quot;');
}

function fillProperties(sites, selected) {
  const sel = $('#propertySelect');
  sel.innerHTML = '';
  if (!sites.length) {
    sel.innerHTML = '<option value="">No GSC properties</option>';
    sel.disabled = true;
    return;
  }
  for (const s of sites) {
    const opt = document.createElement('option');
    opt.value = s.siteUrl;
    opt.textContent = s.siteUrl;
    if (selected && s.siteUrl === selected) opt.selected = true;
    sel.appendChild(opt);
  }
  sel.disabled = false;
  state.siteUrl = sel.value;
}

async function loadContext() {
  showError('');
  try {
    const ctx = await api('GET_CONTEXT');
    state.pageUrl = ctx.pageUrl;
    state.sites = ctx.sites || [];
    $('#pageUrl').textContent = ctx.pageUrl || ctx.error || '—';
    $('#pageUrl').title = ctx.pageUrl || '';
    $('#scopeLabel').textContent = ctx.tabTitle || 'GSC Command Center';

    if (ctx.error && !ctx.pageUrl) {
      setAuthGate(false);
      showError(ctx.error);
      return;
    }

    if (ctx.needsAuth) {
      setAuthGate(true, 'Sign in to load analytics for this page.');
      return;
    }

    setAuthGate(false);
    fillProperties(state.sites, ctx.property?.siteUrl);
    if (!state.siteUrl) {
      showError('This URL is not under any of your Search Console properties.');
      return;
    }
    await Promise.all([loadAnalytics(), loadNotes(), loadSitemaps()]);
  } catch (err) {
    if (err.code === 'NO_CLIENT_ID') {
      setAuthGate(true, err.message);
      return;
    }
    showError(err.message);
  }
}

async function loadAnalytics() {
  if (!state.siteUrl || !state.pageUrl) return;
  const days = Number($('#rangeSelect').value);
  showStatus('Loading analytics…');
  try {
    const analytics = await api('GET_ANALYTICS', {
      siteUrl: state.siteUrl,
      pageUrl: state.pageUrl,
      scope: state.scope,
      days,
    });
    state.analytics = analytics;
    renderMetrics(analytics);
    showStatus('');
  } catch (err) {
    showError(err.message);
  }
}

async function loadSitemaps() {
  if (!state.siteUrl) return;
  const root = $('#sitemapsList');
  try {
    const list = await api('LIST_SITEMAPS', { siteUrl: state.siteUrl });
    if (!list.length) {
      root.innerHTML = '<div class="muted">No sitemaps submitted yet.</div>';
      return;
    }
    root.innerHTML = list
      .map((s) => {
        const path = s.path || s;
        const last = s.lastSubmitted || s.lastDownloaded || '';
        return `<div class="row"><span class="q">${escapeHtml(path)}</span><span class="num" style="grid-column: span 3">${escapeHtml(last)}</span></div>`;
      })
      .join('');
  } catch (err) {
    root.innerHTML = `<div class="muted">${escapeHtml(err.message)}</div>`;
  }
}

async function loadNotes() {
  const notes = await api('LIST_NOTES', {
    pageUrl: state.pageUrl,
    siteUrl: state.siteUrl,
  });
  const root = $('#notesList');
  if (!notes.length) {
    root.innerHTML = '<div class="muted">No notes yet for this page.</div>';
    return;
  }
  root.innerHTML = notes
    .map(
      (n) => `
      <article class="note" data-id="${n.id}">
        <div class="note-title">${escapeHtml(n.title)}</div>
        <div class="note-meta">${escapeHtml(new Date(n.createdAt).toLocaleString())} · ${escapeHtml(n.scope)}${n.pageUrl ? ` · ${escapeHtml(n.pageUrl)}` : ''}</div>
        <div class="note-body">${escapeHtml(n.body || '')}</div>
        <div class="note-actions"><button type="button" class="linkish del-note" data-id="${n.id}">Delete</button></div>
      </article>`
    )
    .join('');
}

function renderInspection(result) {
  const root = $('#inspectResult');
  const r = result.inspection;
  const idx = r?.indexStatusResult || {};
  const mobile = r?.mobileUsabilityResult;
  const rich = r?.richResultsResult;

  const verdict = idx.verdict || 'N/A';
  const coverage = idx.coverageState || idx.robotsTxtState || '';
  const pillClass =
    /PASS/i.test(verdict) || /Indexed/i.test(coverage)
      ? 'good'
      : /FAIL|Excluded|Error/i.test(`${verdict} ${coverage}`)
        ? 'bad'
        : 'warn';

  root.classList.remove('hidden');
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
        <dt>Crawl allowed</dt><dd>${escapeHtml(String(idx.pageFetchState || '—'))}</dd>
        <dt>Canonical (Google)</dt><dd>${escapeHtml(idx.googleCanonical || '—')}</dd>
        <dt>Canonical (user)</dt><dd>${escapeHtml(idx.userCanonical || '—')}</dd>
        <dt>Sitemap</dt><dd>${escapeHtml((idx.sitemap || []).join(', ') || '—')}</dd>
        <dt>Referring URLs</dt><dd>${escapeHtml((idx.referringUrls || []).slice(0, 5).join('\\n') || '—')}</dd>
      </dl>
      ${
        mobile
          ? `<p class="muted" style="margin-top:10px">Mobile usability: ${escapeHtml(mobile.verdict || '—')}</p>`
          : ''
      }
      ${
        rich
          ? `<p class="muted">Rich results: ${escapeHtml(rich.verdict || '—')}</p>`
          : ''
      }
      <button type="button" class="btn ghost block" id="openInspectLink">Open full report in GSC</button>
    </div>`;

  $('#openInspectLink')?.addEventListener('click', () => {
    api('OPEN_URL', { url: result.gscLink });
  });
}

function renderAudit(audit) {
  const root = $('#auditResult');
  if (!audit) {
    root.innerHTML = '<div class="muted">Could not audit this page (restricted URL?).</div>';
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
        <dt>H1</dt><dd>${escapeHtml(audit.headings.h1.join(' | ') || '—')}</dd>
        <dt>H2 / H3</dt><dd>${audit.headings.h2Count} / ${audit.headings.h3Count}</dd>
        <dt>Words</dt><dd>${fmtNum(audit.wordCount)}</dd>
        <dt>Images</dt><dd>${audit.images.total} (${audit.images.missingAlt} missing alt)</dd>
        <dt>Links</dt><dd>${audit.links.internal} internal / ${audit.links.external} external</dd>
        <dt>JSON-LD</dt><dd>${escapeHtml(audit.jsonLdTypes.join(', ') || 'none')}</dd>
      </dl>
    </div>
    <div class="card">
      <div class="card-head">Issues (${audit.issues.length})</div>
      ${
        audit.issues.length
          ? audit.issues
              .map(
                (i) =>
                  `<div class="issue ${i.severity}">${escapeHtml(i.message)}</div>`
              )
              .join('')
          : '<div class="muted">No issues flagged.</div>'
      }
    </div>`;
}

function bind() {
  $$('.tab').forEach((t) =>
    t.addEventListener('click', () => {
      if (state.needsAuth) return;
      switchTab(t.dataset.tab);
    })
  );

  $$('.seg-btn').forEach((b) =>
    b.addEventListener('click', () => {
      $$('.seg-btn').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      state.scope = b.dataset.scope;
      loadAnalytics();
    })
  );

  $$('#queryFilter .mini').forEach((b) =>
    b.addEventListener('click', () => {
      $$('#queryFilter .mini').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      state.queryFilter = b.dataset.qf;
      renderQueries();
    })
  );

  $('#rangeSelect').addEventListener('change', () => loadAnalytics());
  $('#propertySelect').addEventListener('change', (e) => {
    state.siteUrl = e.target.value;
    loadAnalytics();
    loadSitemaps();
  });

  $('#refreshBtn').addEventListener('click', () => loadContext());
  $('#settingsBtn').addEventListener('click', () => chrome.runtime.openOptionsPage());
  $('#openOptionsBtn').addEventListener('click', () => chrome.runtime.openOptionsPage());

  $('#signInBtn').addEventListener('click', async () => {
    try {
      await api('SIGN_IN');
      await loadContext();
      switchTab('analytics');
    } catch (err) {
      showError(err.message);
    }
  });

  $('#signOutBtn').addEventListener('click', async () => {
    await api('SIGN_OUT');
    setAuthGate(true, 'Signed out.');
  });

  $('#inspectBtn').addEventListener('click', async () => {
    try {
      showStatus('Inspecting URL…');
      const result = await api('INSPECT_URL', {
        siteUrl: state.siteUrl,
        pageUrl: state.pageUrl,
      });
      renderInspection(result);
      showStatus('');
    } catch (err) {
      showError(err.message);
    }
  });

  const requestIndex = async (notifyType) => {
    try {
      const out = await api('REQUEST_INDEXING', {
        siteUrl: state.siteUrl,
        pageUrl: state.pageUrl,
        notifyType,
      });
      const pre = $('#indexingOut');
      pre.classList.remove('hidden');
      pre.textContent = JSON.stringify(out.result, null, 2);
      showStatus(`${notifyType} submitted.`);
    } catch (err) {
      showError(
        `${err.message} — If Indexing API isn’t enabled for your project / property, use “Open GSC Inspection” instead.`
      );
    }
  };

  $('#indexUpdatedBtn').addEventListener('click', () => requestIndex('URL_UPDATED'));
  $('#indexDeletedBtn').addEventListener('click', () => requestIndex('URL_DELETED'));

  $('#openGscInspect').addEventListener('click', async () => {
    const resource = encodeURIComponent(state.siteUrl);
    const id = encodeURIComponent(state.pageUrl);
    await api('OPEN_URL', {
      url: `https://search.google.com/search-console/inspect?resource_id=${resource}&id=${id}`,
    });
  });

  $('#indexingMetaBtn').addEventListener('click', async () => {
    try {
      const meta = await api('INDEXING_STATUS', { pageUrl: state.pageUrl });
      const pre = $('#indexingOut');
      pre.classList.remove('hidden');
      pre.textContent = JSON.stringify(meta, null, 2);
    } catch (err) {
      showError(err.message);
    }
  });

  $('#submitSitemapBtn').addEventListener('click', async () => {
    const feedpath = $('#sitemapUrl').value.trim();
    if (!feedpath) return;
    try {
      await api('SUBMIT_SITEMAP', { siteUrl: state.siteUrl, feedpath });
      showStatus('Sitemap submitted.');
      await loadSitemaps();
    } catch (err) {
      showError(err.message);
    }
  });

  $('#openGscPerf').addEventListener('click', () => {
    if (state.analytics?.deepLink) api('OPEN_URL', { url: state.analytics.deepLink });
  });

  $('#auditBtn').addEventListener('click', async () => {
    try {
      const audit = await api('PAGE_AUDIT');
      renderAudit(audit);
    } catch (err) {
      showError(err.message);
    }
  });

  $('#saveNoteBtn').addEventListener('click', async () => {
    const title = $('#noteTitle').value.trim();
    if (!title) return;
    await api('ADD_NOTE', {
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
    showStatus('Note saved.');
  });

  $('#notesList').addEventListener('click', async (e) => {
    const btn = e.target.closest('.del-note');
    if (!btn) return;
    await api('DELETE_NOTE', { id: btn.dataset.id });
    await loadNotes();
  });
}

bind();
loadContext();
