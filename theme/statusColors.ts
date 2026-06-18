import { SSLStatus, DomainStatus, FormCheckStatus, CallCheckStatus, GmbStatus } from '../types';

// ─── Status color maps ─────────────────────────────────────────
// Single source of truth for all badge/indicator colors.
// Import from here everywhere — never inline color strings.

export const STATUS_COLORS: Record<DomainStatus, { bg: string; text: string; dot: string; border: string }> = {
  [DomainStatus.Alive]:  { bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-500 status-dot-green',  border: 'border-emerald-500/20' },
  [DomainStatus.Down]:   { bg: 'bg-red-500/10',     text: 'text-red-400',    dot: 'bg-red-500 status-dot-red',      border: 'border-red-500/20' },
  [DomainStatus.Checking]:  { bg: 'bg-blue-500/10', text: 'text-blue-400',   dot: 'bg-blue-500',                     border: 'border-blue-500/20' },
  [DomainStatus.Unknown]:   { bg: 'bg-zinc-800',    text: 'text-zinc-400',   dot: 'bg-zinc-500',                     border: 'border-zinc-700' },
  [DomainStatus.Error]:  { bg: 'bg-amber-500/10',   text: 'text-amber-400',  dot: 'bg-amber-500',                    border: 'border-amber-500/20' },
};

export function sslColor(status: SSLStatus): string {
  switch (status) {
    case SSLStatus.Valid:    return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400';
    case SSLStatus.Expiring: return 'bg-amber-100  text-amber-800  dark:bg-amber-900/30  dark:text-amber-400';
    case SSLStatus.Expired:  return 'bg-rose-100   text-rose-800   dark:bg-rose-900/30   dark:text-rose-400';
    case SSLStatus.Invalid:  return 'bg-red-100    text-red-800    dark:bg-red-900/30    dark:text-red-400';
    default:                 return 'bg-slate-100  text-slate-800  dark:bg-slate-700      dark:text-slate-400';
  }
}

export function sslLabel(status: SSLStatus): string {
  switch (status) {
    case SSLStatus.Valid:    return 'Valid';
    case SSLStatus.Expiring: return 'Expiring';
    case SSLStatus.Expired:  return 'Expired';
    case SSLStatus.Invalid:  return 'Invalid';
    default:                 return 'Unknown';
  }
}

export function expiryColor(status: string): string {
  switch (status) {
    case 'active':   return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400';
    case 'expiring': return 'bg-amber-100  text-amber-800  dark:bg-amber-900/30  dark:text-amber-400';
    case 'expired':  return 'bg-rose-100   text-rose-800   dark:bg-rose-900/30   dark:text-rose-400';
    default:         return 'bg-slate-100  text-slate-800  dark:bg-slate-700      dark:text-slate-400';
  }
}

export function expiryLabel(status: string): string {
  switch (status) {
    case 'active':   return 'Active';
    case 'expiring': return 'Expiring';
    case 'expired':  return 'Expired';
    default:         return 'Unknown';
  }
}

// ─── QA check colors (forms + call buttons) ───────────────────
const QA_GOOD = 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400';
const QA_BAD = 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400';
const QA_WARN = 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400';
const QA_NEUTRAL = 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-400';

export function formCheckColor(status: FormCheckStatus): string {
  switch (status) {
    case FormCheckStatus.Pass:    return QA_GOOD;
    case FormCheckStatus.Fail:    return QA_BAD;
    case FormCheckStatus.Error:   return QA_WARN;
    case FormCheckStatus.NoForms: return QA_NEUTRAL;
    default:                      return QA_NEUTRAL;
  }
}

export function formCheckLabel(status: FormCheckStatus): string {
  switch (status) {
    case FormCheckStatus.Pass:    return 'Pass';
    case FormCheckStatus.Fail:    return 'Fail';
    case FormCheckStatus.Error:   return 'Error';
    case FormCheckStatus.NoForms: return 'No Forms';
    default:                      return 'Unknown';
  }
}

export function callCheckColor(status: CallCheckStatus): string {
  switch (status) {
    case CallCheckStatus.Pass:       return QA_GOOD;
    case CallCheckStatus.Fail:       return QA_BAD;
    case CallCheckStatus.NotSwapped: return QA_WARN;
    case CallCheckStatus.Error:      return QA_WARN;
    case CallCheckStatus.NoButtons:  return QA_NEUTRAL;
    default:                         return QA_NEUTRAL;
  }
}

export function callCheckLabel(status: CallCheckStatus): string {
  switch (status) {
    case CallCheckStatus.Pass:       return 'Pass';
    case CallCheckStatus.Fail:       return 'Fail';
    case CallCheckStatus.NotSwapped: return 'No Swap';
    case CallCheckStatus.Error:      return 'Error';
    case CallCheckStatus.NoButtons:  return 'No Buttons';
    default:                         return 'Unknown';
  }
}

// ─── GMB (Google Business Profile) colors ─────────────────────
export function gmbColor(status: GmbStatus): string {
  switch (status) {
    case GmbStatus.Operational: return QA_GOOD;
    case GmbStatus.Closed:      return QA_BAD;
    case GmbStatus.NotFound:    return QA_NEUTRAL;
    case GmbStatus.Error:       return QA_WARN;
    default:                    return QA_NEUTRAL;
  }
}

export function gmbLabel(status: GmbStatus): string {
  switch (status) {
    case GmbStatus.Operational: return 'Live';
    case GmbStatus.Closed:      return 'Closed';
    case GmbStatus.NotFound:    return 'Not Found';
    case GmbStatus.Error:       return 'Error';
    default:                    return 'Unknown';
  }
}

/** Raw hex values for charts (recharts needs real colors, not tailwind classes). */
export const CHART_COLORS: Record<string, string> = {
  Alive: '#10b981',   // emerald-500
  Down: '#ef4444',    // red-500
  Unknown: '#52525b', // zinc-600
};

/** Uptime-pct → tailwind colour pair. */
export function uptimeColor(pct: number): { text: string; bg: string } {
  if (pct >= 99) return { text: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' };
  if (pct >= 95) return { text: 'text-amber-400',  bg: 'bg-amber-500/10 border-amber-500/20' };
  return { text: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' };
}

/** Latency ms → tailwind text colour. */
export function latencyColor(ms: number): string {
  return ms > 500 ? 'text-amber-400' : 'text-zinc-300';
}
