import { DomainExpiry } from '../types';

/**
 * Check domain expiry information using WHOIS API.
 */
export const checkDomainExpiry = async (domain: string): Promise<DomainExpiry> => {
  const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  
  try {
    // Try Vercel API first
    const response = await fetch(`/api/whois?domain=${encodeURIComponent(cleanDomain)}`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });

    if (response.ok) {
      const data = await response.json();
      return parseWhoisResponse(data);
    }
  } catch (error) {
    console.warn('WHOIS API unavailable:', error);
  }

  // Fallback: return unknown status
  return {
    status: 'unknown',
    expiryDate: undefined,
    registrar: undefined,
    daysUntilExpiry: undefined
  };
};

/**
 * Parse WHOIS API response.
 */
const parseWhoisResponse = (data: any): DomainExpiry => {
  if (!data || data.error) {
    return {
      status: 'unknown',
      expiryDate: undefined,
      registrar: undefined,
      daysUntilExpiry: undefined
    };
  }

  const expiryDate = data.expiryDate ? new Date(data.expiryDate) : null;
  const daysUntilExpiry = expiryDate
    ? Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : undefined;

  let status: DomainExpiry['status'] = 'active';
  if (daysUntilExpiry !== undefined) {
    if (daysUntilExpiry <= 0) {
      status = 'expired';
    } else if (daysUntilExpiry <= 30) {
      status = 'expiring';
    }
  }

  return {
    status,
    expiryDate: expiryDate || undefined,
    registrar: data.registrar || 'Unknown',
    daysUntilExpiry
  };
};

/**
 * Get expiry status badge color.
 */
export const getExpiryStatusColor = (status: string): string => {
  switch (status) {
    case 'active':
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400';
    case 'expiring':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400';
    case 'expired':
      return 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400';
    default:
      return 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-400';
  }
};

/**
 * Get expiry status label.
 */
export const getExpiryStatusLabel = (status: string): string => {
  switch (status) {
    case 'active':
      return 'Active';
    case 'expiring':
      return 'Expiring';
    case 'expired':
      return 'Expired';
    default:
      return 'Unknown';
  }
};
