/**
 * PulseSEO helper tests — pure functions, no Chrome APIs.
 * Run: npm run test:ext
 */
import assert from 'node:assert/strict';
import {
  matchProperty,
  normalizePageUrl,
  encodeSiteUrl,
  gscInspectDeepLink,
  gscPropertyDeepLink,
  queryDeltas,
} from '../lib/gsc.js';
import { defaultRange, previousRange, pctChange, formatDate, addDaysYmd } from '../lib/dates.js';
import { validateClientId } from '../lib/auth.js';
import { isBlockedFetchHost, assertPublicHttpUrl } from '../lib/ssrf.js';

function testMatchProperty() {
  const sites = [
    { siteUrl: 'sc-domain:example.com', permissionLevel: 'siteOwner' },
    { siteUrl: 'https://www.example.com/', permissionLevel: 'siteFullUser' },
    { siteUrl: 'https://blog.example.com/', permissionLevel: 'siteFullUser' },
  ];

  assert.equal(
    matchProperty('https://www.example.com/pricing', sites).siteUrl,
    'https://www.example.com/'
  );
  assert.equal(
    matchProperty('https://blog.example.com/post', sites).siteUrl,
    'https://blog.example.com/'
  );
  assert.equal(
    matchProperty('https://shop.example.com/x', [
      { siteUrl: 'sc-domain:example.com', permissionLevel: 'siteOwner' },
    ]).siteUrl,
    'sc-domain:example.com'
  );
  assert.equal(matchProperty('https://other.test/', sites), null);
  assert.equal(matchProperty('not a url', sites), null);
  assert.equal(matchProperty('https://example.com/', []), null);

  // Host-prefix collision must NOT match
  assert.equal(
    matchProperty('https://www.example.com.evil.com/', [
      { siteUrl: 'https://www.example.com/', permissionLevel: 'siteOwner' },
    ]),
    null
  );

  // www page must NOT auto-bind apex URL-prefix property
  assert.equal(
    matchProperty('https://example.com/x', [
      { siteUrl: 'https://www.example.com/', permissionLevel: 'siteOwner' },
    ]),
    null
  );

  // Longest path prefix wins
  assert.equal(
    matchProperty('https://example.com/blog/post', [
      { siteUrl: 'https://example.com/', permissionLevel: 'siteOwner' },
      { siteUrl: 'https://example.com/blog/', permissionLevel: 'siteOwner' },
    ]).siteUrl,
    'https://example.com/blog/'
  );

  // Path not under /blog/ must not match blog property (same origin)
  assert.equal(
    matchProperty('https://www.example.com/pricing', [
      { siteUrl: 'https://www.example.com/blog/', permissionLevel: 'siteOwner' },
    ]),
    null
  );
}

function testNormalize() {
  assert.equal(
    normalizePageUrl('https://ex.com/a?utm_source=x&b=1#hash'),
    'https://ex.com/a?b=1'
  );
}

function testDates() {
  const { startDate, endDate, days } = defaultRange(28, new Date('2026-08-06T20:00:00Z'));
  assert.match(startDate, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(endDate, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(days, 28);
  assert.ok(startDate <= endDate);
  // end is ~3 PT days before "now"
  assert.equal(endDate, addDaysYmd(formatDate(new Date('2026-08-06T20:00:00Z')), -3));

  const prev = previousRange('2026-02-01', '2026-02-28');
  assert.equal(prev.endDate, '2026-01-31');
  assert.equal(prev.startDate, '2026-01-04');

  assert.equal(previousRange('2026-03-15', '2026-03-15').startDate, '2026-03-14');
  assert.equal(previousRange('2026-01-01', '2026-01-07').startDate, '2025-12-25');

  assert.equal(pctChange(110, 100), 10);
  assert.equal(pctChange(80, 100), -20);
  assert.equal(pctChange(0, 0), 0);
  assert.equal(pctChange(5, 0), 100);
}

function testDeepLinks() {
  const site = 'https://www.example.com/';
  const page = 'https://www.example.com/a';
  assert.equal(
    gscInspectDeepLink(site, page),
    `https://search.google.com/search-console/inspect?resource_id=${encodeURIComponent(site)}&id=${encodeURIComponent(page)}`
  );
  assert.ok(gscPropertyDeepLink(site).includes(encodeURIComponent(site)));
  assert.equal(encodeSiteUrl('sc-domain:example.com'), encodeURIComponent('sc-domain:example.com'));
}

function testClientId() {
  assert.equal(validateClientId('').ok, false);
  assert.equal(validateClientId('not-a-client').ok, false);
  assert.equal(validateClientId('123-abc.apps.googleusercontent.com').ok, true);
}

async function testQueryDeltas() {
  const origFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    const rows =
      calls % 2 === 1
        ? [
            { keys: ['a'], clicks: 10, impressions: 100, ctr: 0.1, position: 2 },
            { keys: ['b'], clicks: 2, impressions: 50, ctr: 0.04, position: 5 },
            { keys: ['c'], clicks: 5, impressions: 80, ctr: 0.06, position: 3 },
          ]
        : [
            { keys: ['a'], clicks: 4, impressions: 90, ctr: 0.04, position: 3 },
            { keys: ['b'], clicks: 8, impressions: 60, ctr: 0.13, position: 4 },
            { keys: ['d'], clicks: 3, impressions: 40, ctr: 0.07, position: 6 },
          ];
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ rows }),
    };
  };
  try {
    const deltas = await queryDeltas('tok', 'https://ex.com/', {
      current: { startDate: '2026-01-01', endDate: '2026-01-28' },
      previous: { startDate: '2025-12-04', endDate: '2025-12-31' },
    });
    assert.ok(deltas.growing.find((q) => q.query === 'a' && q.delta === 6));
    assert.ok(deltas.decaying.find((q) => q.query === 'b' && q.delta === -6));
    assert.ok(deltas.decaying.find((q) => q.query === 'd' && q.delta === -3));
    assert.ok(deltas.newRanking.find((q) => q.query === 'c'));
  } finally {
    globalThis.fetch = origFetch;
  }
}

function testSsrf() {
  assert.equal(isBlockedFetchHost('127.0.0.1'), true);
  assert.equal(isBlockedFetchHost('10.0.0.1'), true);
  assert.equal(isBlockedFetchHost('192.168.1.1'), true);
  assert.equal(isBlockedFetchHost('169.254.169.254'), true);
  assert.equal(isBlockedFetchHost('localhost'), true);
  assert.equal(isBlockedFetchHost('example.com'), false);
  assert.throws(() => assertPublicHttpUrl('http://127.0.0.1/sitemap.xml'));
  assert.equal(
    assertPublicHttpUrl('https://example.com/sitemap.xml'),
    'https://example.com/sitemap.xml'
  );
}

testMatchProperty();
testNormalize();
testDates();
testDeepLinks();
testClientId();
await testQueryDeltas();
testSsrf();
console.log('pulse-seo helper tests: ok');
