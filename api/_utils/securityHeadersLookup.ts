/**
 * Security-headers grading — SSRF-safe fetch of response headers.
 * Enrichment only; never affects liveness.
 */
import http from 'node:http';
import https from 'node:https';
import { validateOutboundUrlResolved } from './ssrfGuard.js';
import type { LetterGrade, SecurityHeaderEntry, SecurityHeadersInfo } from '../../types.js';

const CHECKED: { name: string; header: string; weight: number; recommend: string }[] = [
  { name: 'Strict-Transport-Security', header: 'strict-transport-security', weight: 25, recommend: 'max-age≥15552000; includeSubDomains' },
  { name: 'Content-Security-Policy', header: 'content-security-policy', weight: 25, recommend: 'Restrict script/default sources' },
  { name: 'X-Frame-Options', header: 'x-frame-options', weight: 15, recommend: 'DENY or SAMEORIGIN' },
  { name: 'X-Content-Type-Options', header: 'x-content-type-options', weight: 15, recommend: 'nosniff' },
  { name: 'Referrer-Policy', header: 'referrer-policy', weight: 10, recommend: 'strict-origin-when-cross-origin or stricter' },
  { name: 'Permissions-Policy', header: 'permissions-policy', weight: 10, recommend: 'Limit powerful features' },
];

function scoreToGrade(score: number, max: number): LetterGrade {
  const pct = max === 0 ? 0 : (score / max) * 100;
  if (pct >= 90) return 'A';
  if (pct >= 75) return 'B';
  if (pct >= 55) return 'C';
  if (pct >= 35) return 'D';
  return 'F';
}

function headerValue(headers: http.IncomingHttpHeaders, name: string): string | undefined {
  const v = headers[name];
  if (Array.isArray(v)) return v[0];
  return typeof v === 'string' ? v : undefined;
}

function pinnedHead(urlString: string, pinnedIp: string, userAgent: string): Promise<http.IncomingHttpHeaders> {
  const parsed = new URL(urlString);
  const isHttps = parsed.protocol === 'https:';
  const transport = isHttps ? https : http;
  const port = parsed.port ? parseInt(parsed.port, 10) : (isHttps ? 443 : 80);
  const family = pinnedIp.includes(':') ? 6 : 4;

  return new Promise((resolve, reject) => {
    const req = transport.request({
      hostname: pinnedIp,
      port,
      path: `${parsed.pathname}${parsed.search}` || '/',
      method: 'HEAD',
      headers: {
        Host: parsed.host,
        'User-Agent': userAgent,
        Accept: '*/*',
      },
      servername: parsed.hostname,
      timeout: 10000,
      lookup: (_hostname, _options, callback) => callback(null, pinnedIp, family),
      agent: isHttps ? new https.Agent({ rejectUnauthorized: false }) : undefined,
    }, (res) => {
      res.resume();
      res.on('end', () => resolve(res.headers));
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    req.end();
  });
}

function gradeHeader(name: string, value: string | undefined, weight: number): { score: number; issue?: string } {
  if (!value) return { score: 0, issue: `Missing ${name}` };

  const lower = value.toLowerCase();
  switch (name) {
    case 'Strict-Transport-Security': {
      const maxAge = lower.match(/max-age\s*=\s*(\d+)/);
      const age = maxAge ? parseInt(maxAge[1]!, 10) : 0;
      if (age >= 15552000) return { score: weight };
      if (age > 0) return { score: Math.round(weight * 0.6), issue: 'HSTS max-age is below 180 days' };
      return { score: 0, issue: 'HSTS present but invalid' };
    }
    case 'Content-Security-Policy':
      if (/unsafe-inline|unsafe-eval|\*/.test(lower) && !/script-src/.test(lower)) {
        return { score: Math.round(weight * 0.5), issue: 'CSP is weak (wildcards / unsafe)' };
      }
      return { score: weight };
    case 'X-Frame-Options':
      if (lower === 'deny' || lower === 'sameorigin') return { score: weight };
      return { score: Math.round(weight * 0.5), issue: 'X-Frame-Options value is non-standard' };
    case 'X-Content-Type-Options':
      return lower.includes('nosniff')
        ? { score: weight }
        : { score: 0, issue: 'X-Content-Type-Options should be nosniff' };
    default:
      return { score: weight };
  }
}

export async function getSecurityHeadersInfo(
  domain: string,
  opts?: { userAgent?: string },
): Promise<SecurityHeadersInfo> {
  const clean = domain.replace(/^https?:\/\//, '').split('/')[0]!.toLowerCase();
  const target = `https://${clean}/`;
  const userAgent = opts?.userAgent || 'DomainPulse/1.0 (Domain Monitor)';

  const v = await validateOutboundUrlResolved(target);
  if (!v.ok) {
    return {
      grade: 'F',
      score: 0,
      maxScore: CHECKED.reduce((s, c) => s + c.weight, 0),
      headers: CHECKED.map((c) => ({ name: c.name, present: false, score: 0 })),
      issues: [v.reason],
    };
  }

  const pinnedIp = v.addresses[0];
  if (!pinnedIp) {
    return {
      grade: 'F',
      score: 0,
      maxScore: CHECKED.reduce((s, c) => s + c.weight, 0),
      headers: CHECKED.map((c) => ({ name: c.name, present: false, score: 0 })),
      issues: ['Host did not resolve'],
    };
  }

  let headers: http.IncomingHttpHeaders;
  try {
    headers = await pinnedHead(target, pinnedIp, userAgent);
  } catch (e) {
    return {
      grade: 'F',
      score: 0,
      maxScore: CHECKED.reduce((s, c) => s + c.weight, 0),
      headers: CHECKED.map((c) => ({ name: c.name, present: false, score: 0 })),
      issues: [e instanceof Error ? e.message : 'Header fetch failed'],
    };
  }

  const issues: string[] = [];
  const entries: SecurityHeaderEntry[] = [];
  let score = 0;
  const maxScore = CHECKED.reduce((s, c) => s + c.weight, 0);

  for (const check of CHECKED) {
    const value = headerValue(headers, check.header)
      ?? (check.header === 'permissions-policy' ? headerValue(headers, 'feature-policy') : undefined);
    const graded = gradeHeader(check.name, value, check.weight);
    score += graded.score;
    if (graded.issue) issues.push(graded.issue);
    else if (!value) issues.push(`Missing ${check.name} (${check.recommend})`);
    entries.push({
      name: check.name,
      present: !!value,
      value: value?.slice(0, 240),
      score: graded.score,
    });
  }

  return {
    grade: scoreToGrade(score, maxScore),
    score,
    maxScore,
    headers: entries,
    issues,
  };
}
