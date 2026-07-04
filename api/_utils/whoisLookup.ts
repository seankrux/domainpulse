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
    // Encode the user-supplied domain so it can only ever be a path/query
    // value on these fixed third-party hosts — never break out of the path or
    // alter the request target.
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

      let advanced = false;                        // guard against double-advance
      const next = (err?: Error) => {
        if (advanced) return;
        advanced = true;
        if (err) lastError = err;
        tryNextApi(index + 1);
      };

      const req = https.get(apiUrl, { timeout: 10000 }, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const parsed = parseWhoisData(data);
            if (parsed.expiryDate || parsed.registrar || parsed.nameServers) {
              if (!advanced) { advanced = true; resolve(parsed); }
            } else {
              next();
            }
          } catch {
            next();
          }
        });
      });
      req.on('error', (error) => next(error));
      // The `timeout` option only arms socket.setTimeout; without this handler
      // a peer that connects then stalls leaves the request hung forever
      // (leaked socket, unresolved promise). Destroy and fall through.
      req.on('timeout', () => {
        req.destroy();
        next(new Error('WHOIS request timed out'));
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
