/**
 * WHOIS / RDAP lookup — single source of truth for `/api/whois` and the dev
 * proxy. Prefers RDAP via `rdapper`, then falls back to public WHOIS scrapers.
 */
import * as https from 'https';
import { lookupDomain } from 'rdapper';

export interface WhoisResult {
  expiryDate?: string;
  createdDate?: string;
  updatedDate?: string;
  registrar?: string;
  registrarUrl?: string;
  registrarIanaId?: string;
  domainStatus?: string[];
  nameServers?: string[];
  dnssec?: string;
  source?: 'rdap' | 'whois';
  error?: string;
  raw?: string;
}

function normalizeDomain(domain: string): string {
  return domain.replace(/^https?:\/\//, '').split('/')[0]!.toLowerCase();
}

function mapRdapRecord(record: {
  creationDate?: string;
  updatedDate?: string;
  expirationDate?: string;
  registrar?: { name?: string; url?: string; ianaId?: string };
  statuses?: { status?: string; raw?: string }[];
  nameservers?: { host: string }[];
  dnssec?: { enabled: boolean };
  source?: string;
}): WhoisResult {
  return {
    createdDate: record.creationDate,
    updatedDate: record.updatedDate,
    expiryDate: record.expirationDate,
    registrar: record.registrar?.name,
    registrarUrl: record.registrar?.url,
    registrarIanaId: record.registrar?.ianaId,
    domainStatus: record.statuses
      ?.map((s) => s.status || s.raw)
      .filter((s): s is string => !!s),
    nameServers: record.nameservers?.map((n) => n.host).filter(Boolean),
    dnssec: record.dnssec
      ? (record.dnssec.enabled ? 'signedDelegation' : 'unsigned')
      : undefined,
    source: 'rdap',
  };
}

function legacyWhois(domain: string): Promise<WhoisResult> {
  return new Promise((resolve) => {
    const d = encodeURIComponent(domain);
    const apiUrls = [
      `https://whoisapi.domainsdb.eu/whois/${d}`,
      `https://whois.domaintools.com/whois/${d}`,
      `https://api.whoapi.com/?domain=${d}&r=whois`,
    ];

    let lastError: Error | null = null;
    let attempts = 0;

    const tryNextApi = (index: number) => {
      if (index >= apiUrls.length) {
        resolve({
          error: `WHOIS lookup failed after ${attempts} attempts. Last error: ${lastError?.message}. Consider using a reliable WHOIS API service.`,
        });
        return;
      }

      const apiUrl = apiUrls[index] as string;
      attempts++;

      const req = https.get(apiUrl, { timeout: 10000 }, (res) => {
        let data = '';
        let bytes = 0;
        const maxBytes = 512 * 1024;
        res.on('data', (chunk) => {
          bytes += chunk.length;
          if (bytes <= maxBytes) data += chunk;
        });
        res.on('end', () => {
          try {
            const parsed = parseWhoisData(data);
            if (parsed.expiryDate || parsed.registrar || parsed.nameServers) {
              resolve({ ...parsed, source: 'whois' });
            } else {
              tryNextApi(index + 1);
            }
          } catch {
            tryNextApi(index + 1);
          }
        });
      });
      req.on('error', (error) => {
        lastError = error;
        tryNextApi(index + 1);
      });
      req.on('timeout', () => {
        req.destroy();
        lastError = new Error('Request timeout');
        tryNextApi(index + 1);
      });
    };

    tryNextApi(0);
  });
}

export async function getWhoisInfo(domain: string): Promise<WhoisResult> {
  const clean = normalizeDomain(domain);

  try {
    const result = await lookupDomain(clean);
    if (result.ok && result.record && (result.record.isRegistered || result.record.expirationDate || result.record.registrar)) {
      const mapped = mapRdapRecord(result.record);
      if (mapped.expiryDate || mapped.registrar || mapped.nameServers) {
        return mapped;
      }
    }
  } catch {
    // Fall through to legacy WHOIS scrapers.
  }

  return legacyWhois(clean);
}

/** Parse raw WHOIS text with enhanced field extraction. */
export function parseWhoisData(data: string): WhoisResult {
  const result: WhoisResult = {};

  const expiryMatch = data.match(/(?:Registry Expiry Date|Expiration Date|expires(?:-on)?|Valid Until)[:\s]+([^\n]+)/i);
  if (expiryMatch && expiryMatch[1]) {
    const date = new Date(expiryMatch[1].trim());
    if (!isNaN(date.getTime())) result.expiryDate = date.toISOString();
  }

  const createdMatch = data.match(/(?:Creation Date|Registered On|Domain Registration Date|Created On)[:\s]+([^\n]+)/i);
  if (createdMatch && createdMatch[1]) {
    const date = new Date(createdMatch[1].trim());
    if (!isNaN(date.getTime())) result.createdDate = date.toISOString();
  }

  const updatedMatch = data.match(/(?:Updated Date|Last Updated On|Domain Registration Updated Date)[:\s]+([^\n]+)/i);
  if (updatedMatch && updatedMatch[1]) {
    const date = new Date(updatedMatch[1].trim());
    if (!isNaN(date.getTime())) result.updatedDate = date.toISOString();
  }

  // Colon-anchored + multiline so we don't capture sub-fields like
  // "Registrar WHOIS Server:" / "Registrar URL:" (which precede the real
  // "Registrar:" line in Verisign/ICANN gTLD output — matching on [:\s] there
  // returned "WHOIS Server: …" as the registrar name).
  const registrarMatch = data.match(/^\s*(?:Registrar|Sponsoring Registrar):\s*([^\n]+)/im);
  if (registrarMatch && registrarMatch[1]) result.registrar = registrarMatch[1].trim();

  const registrarUrlMatch = data.match(/(?:Registrar URL|Registrar Information)[:\s]+([^\n]+)/i);
  if (registrarUrlMatch && registrarUrlMatch[1]) result.registrarUrl = registrarUrlMatch[1].trim();

  const registrarIanaIdMatch = data.match(/(?:Registrar IANA ID|Registrar ID)[:\s]+([^\n]+)/i);
  if (registrarIanaIdMatch && registrarIanaIdMatch[1]) result.registrarIanaId = registrarIanaIdMatch[1].trim();

  const statusMatches = data.matchAll(/^\s*Domain Status:\s*(\S+)/gim);
  const statuses = Array.from(statusMatches, m => m[1]?.trim()).filter((s): s is string => !!s);
  if (statuses.length > 0) result.domainStatus = statuses;

  const nsMatches = data.matchAll(/(?:Name Server|Nameserver|DNS)[:\s]+([^\n]+)/gi);
  const nameServers = Array.from(nsMatches, m => m[1]?.trim()).filter((s): s is string => !!s);
  if (nameServers.length > 0) result.nameServers = nameServers;

  const dnssecMatch = data.match(/(?:DNSSEC)[:\s]+([^\n]+)/i);
  if (dnssecMatch && dnssecMatch[1]) result.dnssec = dnssecMatch[1].trim();

  result.raw = data;
  return result;
}
