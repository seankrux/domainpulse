import { Domain, FormCheckStatus, CallCheckStatus, type FormResult, type CallButtonResult } from '../types';
import { logger } from './logger';

interface QaReport {
  url: string;
  formStatus: string;
  callStatus: string;
  forms: FormResult[];
  calls: CallButtonResult[];
}

interface QaResultsFile {
  generatedAt: string;
  reports: QaReport[];
}

/** Normalize a URL/domain for matching between the dashboard and QA reports. */
const normalizeKey = (raw: string): string =>
  raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '');

const asFormStatus = (s: string): FormCheckStatus =>
  (Object.values(FormCheckStatus) as string[]).includes(s) ? (s as FormCheckStatus) : FormCheckStatus.Unknown;

const asCallStatus = (s: string): CallCheckStatus =>
  (Object.values(CallCheckStatus) as string[]).includes(s) ? (s as CallCheckStatus) : CallCheckStatus.Unknown;

/**
 * Fetch the latest QA snapshot published by `npm run qa:crawl` (public/qa-results.json).
 * Returns a map keyed by normalized domain. Resolves to an empty map when no
 * snapshot exists yet (fresh deploy, crawl never run) — never throws.
 */
export const loadQaResults = async (): Promise<Map<string, { formCheck: Domain['formCheck']; callCheck: Domain['callCheck'] }>> => {
  const map = new Map<string, { formCheck: Domain['formCheck']; callCheck: Domain['callCheck'] }>();
  try {
    const res = await fetch('/qa-results.json', { cache: 'no-store' });
    if (!res.ok) return map;
    const data = (await res.json()) as QaResultsFile;
    const lastRun = data.generatedAt ? new Date(data.generatedAt) : undefined;
    for (const report of data.reports ?? []) {
      map.set(normalizeKey(report.url), {
        formCheck: { status: asFormStatus(report.formStatus), lastRun, results: report.forms ?? [] },
        callCheck: { status: asCallStatus(report.callStatus), lastRun, results: report.calls ?? [] },
      });
    }
  } catch (error) {
    logger.debug('No QA results snapshot available:', error);
  }
  return map;
};

/** Merge a QA snapshot into the domain list by normalized URL (pure, returns a new array). */
export const mergeQaResults = (
  domains: Domain[],
  results: Map<string, { formCheck: Domain['formCheck']; callCheck: Domain['callCheck'] }>,
): Domain[] => {
  if (results.size === 0) return domains;
  return domains.map((d) => {
    const match = results.get(normalizeKey(d.url));
    return match ? { ...d, formCheck: match.formCheck, callCheck: match.callCheck } : d;
  });
};
