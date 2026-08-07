/**
 * Domain Health score — combines email auth, security headers, SSL, DNS, and
 * canonical HTTPS signals into a single letter grade. Enrichment only.
 */
import {
  Domain,
  DomainHealthInfo,
  EmailAuthInfo,
  LetterGrade,
  SSLStatus,
  SecurityHeadersInfo,
} from '../types';

const GRADE_POINTS: Record<LetterGrade, number> = {
  'A+': 100,
  A: 95,
  B: 80,
  C: 60,
  D: 40,
  F: 15,
};

function letterFromPct(pct: number): LetterGrade {
  if (pct >= 90) return 'A';
  if (pct >= 75) return 'B';
  if (pct >= 55) return 'C';
  if (pct >= 35) return 'D';
  return 'F';
}

export function computeDomainHealth(
  input: Pick<Domain, 'ssl' | 'dns' | 'canonical' | 'emailAuth' | 'securityHeaders'>,
): DomainHealthInfo | undefined {
  const factors: DomainHealthInfo['factors'] = [];
  let score = 0;
  let maxScore = 0;

  const email: EmailAuthInfo | undefined = input.emailAuth;
  if (email) {
    const max = 25;
    const pts = Math.round((GRADE_POINTS[email.grade] / 100) * max);
    factors.push({ name: 'Email auth', score: pts, max, note: `Grade ${email.grade}` });
    score += pts;
    maxScore += max;
  }

  const headers: SecurityHeadersInfo | undefined = input.securityHeaders;
  if (headers) {
    const max = 25;
    const pts = Math.round((headers.score / Math.max(headers.maxScore, 1)) * max);
    factors.push({ name: 'Security headers', score: pts, max, note: `Grade ${headers.grade}` });
    score += pts;
    maxScore += max;
  }

  if (input.ssl && input.ssl.status !== SSLStatus.Unknown) {
    const max = 20;
    let pts = 0;
    if (input.ssl.status === SSLStatus.Valid) pts = max;
    else if (input.ssl.status === SSLStatus.Expiring) pts = Math.round(max * 0.6);
    else if (input.ssl.status === SSLStatus.Expired || input.ssl.status === SSLStatus.Invalid) pts = 0;
    factors.push({ name: 'SSL', score: pts, max, note: input.ssl.status });
    score += pts;
    maxScore += max;
  }

  if (input.dns && !input.dns.error) {
    const max = 15;
    let pts = 0;
    if ((input.dns.a?.length ?? 0) > 0 || (input.dns.aaaa?.length ?? 0) > 0) pts += 6;
    if ((input.dns.ns?.length ?? 0) > 0) pts += 4;
    if ((input.dns.aaaa?.length ?? 0) > 0) pts += 3;
    if ((input.dns.caa?.length ?? 0) > 0) pts += 2;
    factors.push({ name: 'DNS', score: pts, max });
    score += pts;
    maxScore += max;
  }

  if (input.canonical && input.canonical.status !== 'unknown') {
    const max = 15;
    let pts = 0;
    if (input.canonical.httpsEnforced) pts += 8;
    if (input.canonical.wwwConsistent) pts += 4;
    if (input.canonical.status === 'correct') pts += 3;
    factors.push({
      name: 'Canonical HTTPS',
      score: pts,
      max,
      note: input.canonical.status,
    });
    score += pts;
    maxScore += max;
  }

  if (maxScore === 0) return undefined;

  return {
    grade: letterFromPct((score / maxScore) * 100),
    score,
    maxScore,
    factors,
  };
}
