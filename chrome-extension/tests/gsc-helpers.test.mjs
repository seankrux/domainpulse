/**
 * Pure helpers tests (no Chrome APIs) for PulseSEO GSC matching / dates.
 * Run: node --experimental-vm-modules chrome-extension/tests/gsc-helpers.test.mjs
 * Or: npm run test:ext
 */
import assert from 'node:assert/strict';
import { matchProperty } from '../lib/gsc.js';
import { defaultRange, previousRange, pctChange, formatDate } from '../lib/dates.js';

function testMatchProperty() {
  const sites = [
    { siteUrl: 'sc-domain:example.com', permissionLevel: 'siteOwner' },
    { siteUrl: 'https://www.example.com/', permissionLevel: 'siteFullUser' },
    { siteUrl: 'https://blog.example.com/', permissionLevel: 'siteFullUser' },
  ];

  const prefix = matchProperty('https://www.example.com/pricing', sites);
  assert.equal(prefix.siteUrl, 'https://www.example.com/');

  const blog = matchProperty('https://blog.example.com/post', sites);
  assert.equal(blog.siteUrl, 'https://blog.example.com/');

  const apex = matchProperty('https://shop.example.com/x', [
    { siteUrl: 'sc-domain:example.com', permissionLevel: 'siteOwner' },
  ]);
  assert.equal(apex.siteUrl, 'sc-domain:example.com');

  assert.equal(matchProperty('https://other.test/', sites), null);
}

function testDates() {
  const { startDate, endDate } = defaultRange(28);
  assert.match(startDate, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(endDate, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(startDate <= endDate);

  const prev = previousRange('2026-02-01', '2026-02-28');
  assert.equal(prev.endDate, '2026-01-31');
  assert.equal(prev.startDate, '2026-01-04');

  assert.equal(pctChange(110, 100), 10);
  assert.equal(pctChange(0, 0), 0);
  assert.equal(pctChange(5, 0), 100);

  assert.equal(formatDate(new Date('2026-08-06T15:00:00')), '2026-08-06');
}

testMatchProperty();
testDates();
console.log('pulse-seo helper tests: ok');
