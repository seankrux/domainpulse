/**
 * WHOIS lookup — single source of truth for the `/api/whois` endpoint and the
 * dev proxy. Tries multiple public WHOIS APIs and parses the raw text.
 *
 * The dev proxy used to return a hard-coded fake registrar; it now calls this
 * so local results match production.
 */
import * as https from 'https';

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
  error?: string;
  raw?: string;
}

export function getWhoisInfo(domain: string): Promise<WhoisResult> {
  return new Promise((resolve) => {
    // Try multiple WHOIS APIs in order of reliability
    const apiUrls = [
      `https://whoisapi.domainsdb.eu/whois/${domain}`,
      `https://whois.domaintools.com/whois/${domain}`,
      `https://api.whoapi.com/?domain=${domain}&r=whois`,
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

      https.get(apiUrl, { timeout: 10000 }, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const parsed = parseWhoisData(data);
            if (parsed.expiryDate || parsed.registrar || parsed.nameServers) {
              resolve(parsed);
            } else {
              tryNextApi(index + 1);
            }
          } catch {
            tryNextApi(index + 1);
          }
        });
      }).on('error', (error) => {
        lastError = error;
        tryNextApi(index + 1);
      });
    };

    tryNextApi(0);
  });
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

  const registrarMatch = data.match(/(?:Registrar|Sponsoring Registrar)[:\s]+([^\n]+)/i);
  if (registrarMatch && registrarMatch[1]) result.registrar = registrarMatch[1].trim();

  const registrarUrlMatch = data.match(/(?:Registrar URL|Registrar Information)[:\s]+([^\n]+)/i);
  if (registrarUrlMatch && registrarUrlMatch[1]) result.registrarUrl = registrarUrlMatch[1].trim();

  const registrarIanaIdMatch = data.match(/(?:Registrar IANA ID|Registrar ID)[:\s]+([^\n]+)/i);
  if (registrarIanaIdMatch && registrarIanaIdMatch[1]) result.registrarIanaId = registrarIanaIdMatch[1].trim();

  const statusMatches = data.matchAll(/(?:Domain Status|Status)[:\s]+([^\n]+)/gi);
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
