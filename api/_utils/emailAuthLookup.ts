/**
 * Email authentication lookup — SPF / DKIM / DMARC from public DNS.
 * Enrichment only; never affects liveness.
 */
import * as dns from 'dns';
import type { EmailAuthInfo, LetterGrade } from '../../types.js';

const COMMON_DKIM_SELECTORS = [
  'google',
  'selector1',
  'selector2',
  'default',
  'k1',
  's1',
  's2',
  'mail',
  'dkim',
];

function flattenTxt(records: string[][]): string[] {
  return records.map((parts) => parts.join(''));
}

function findSpf(txts: string[]): string | undefined {
  return txts.find((t) => /^v=spf1\b/i.test(t.trim()));
}

function findDmarc(txts: string[]): string | undefined {
  return txts.find((t) => /^v=DMARC1\b/i.test(t.trim()));
}

function parseDmarcPolicy(raw: string): string | undefined {
  const m = raw.match(/(?:^|;)\s*p\s*=\s*([^;\s]+)/i);
  return m?.[1]?.toLowerCase();
}

function gradeFromScores(spf: boolean, dkim: boolean, dmarc: boolean, policy?: string): LetterGrade {
  if (spf && dkim && dmarc && (policy === 'reject' || policy === 'quarantine')) return 'A';
  if (spf && dkim && dmarc) return 'B';
  if (spf && dmarc) return 'C';
  if (spf || dmarc) return 'D';
  return 'F';
}

export async function getEmailAuthInfo(domain: string): Promise<EmailAuthInfo> {
  const clean = domain.replace(/^https?:\/\//, '').split('/')[0]!.toLowerCase();
  const resolver = new dns.promises.Resolver();
  resolver.setServers(['8.8.8.8', '1.1.1.1']);

  const issues: string[] = [];

  const [apexTxt, dmarcTxt] = await Promise.allSettled([
    resolver.resolveTxt(clean),
    resolver.resolveTxt(`_dmarc.${clean}`),
  ]);

  const apex = apexTxt.status === 'fulfilled' ? flattenTxt(apexTxt.value) : [];
  const dmarcRecords = dmarcTxt.status === 'fulfilled' ? flattenTxt(dmarcTxt.value) : [];

  const spfRaw = findSpf(apex);
  const dmarcRaw = findDmarc(dmarcRecords);
  const dmarcPolicy = dmarcRaw ? parseDmarcPolicy(dmarcRaw) : undefined;

  if (!spfRaw) issues.push('No SPF record (v=spf1) on apex');
  else if (/[+?]all\b/i.test(spfRaw) || !/\s-all\b|\s~all\b/i.test(spfRaw)) {
    issues.push('SPF lacks a restrictive terminal (~all / -all)');
  }

  if (!dmarcRaw) issues.push('No DMARC record at _dmarc');
  else if (!dmarcPolicy || dmarcPolicy === 'none') {
    issues.push('DMARC policy is missing or p=none (monitor-only)');
  }

  const foundSelectors: string[] = [];
  const dkimRaws: string[] = [];
  const selectorChecks = await Promise.allSettled(
    COMMON_DKIM_SELECTORS.map(async (sel) => {
      const records = await resolver.resolveTxt(`${sel}._domainkey.${clean}`);
      const flat = flattenTxt(records);
      // Require a non-empty public key (p=...). Bare `v=DKIM1; p=` is a
      // placeholder some domains publish and must not count as present.
      const dkim = flat.find((t) => /\bp\s*=\s*[A-Za-z0-9+/]+=*/i.test(t) && !/\bp\s*=\s*;/i.test(t) && !/\bp\s*=\s*$/i.test(t.trim()));
      if (dkim) {
        foundSelectors.push(sel);
        dkimRaws.push(dkim);
      }
    }),
  );
  void selectorChecks;

  if (foundSelectors.length === 0) {
    issues.push('No DKIM key found for common selectors');
  }

  const spfPresent = !!spfRaw;
  const dkimPresent = foundSelectors.length > 0;
  const dmarcPresent = !!dmarcRaw;

  return {
    grade: gradeFromScores(spfPresent, dkimPresent, dmarcPresent, dmarcPolicy),
    spf: {
      present: spfPresent,
      raw: spfRaw,
      detail: spfRaw ? spfRaw.slice(0, 200) : undefined,
    },
    dkim: {
      present: dkimPresent,
      selectors: foundSelectors,
      raw: dkimRaws[0],
      detail: foundSelectors.length
        ? `Found selectors: ${foundSelectors.join(', ')}`
        : undefined,
    },
    dmarc: {
      present: dmarcPresent,
      raw: dmarcRaw,
      policy: dmarcPolicy,
      detail: dmarcRaw ? dmarcRaw.slice(0, 200) : undefined,
    },
    issues,
  };
}
