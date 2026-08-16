/**
 * DNS lookup — single source of truth for the `/api/dns` endpoint and the dev
 * proxy. Uses public resolvers (8.8.8.8 / 1.1.1.1) for reliability.
 */
import * as dns from 'dns';

export interface DNSResult {
  a: string[];
  aaaa: string[];
  mx: { exchange: string; priority: number }[];
  ns: string[];
  txt: string[][];
  cname: string[];
  caa: { critical: number; issue?: string; issuewild?: string; iodef?: string; raw: string }[];
  soa?: {
    nsname: string;
    hostmaster: string;
    serial: number;
    refresh: number;
    retry: number;
    expire: number;
    minttl: number;
  };
}

function mapCaa(
  records: dns.CaaRecord[],
): DNSResult['caa'] {
  return records.map((r) => {
    const issue = typeof r.issue === 'string' ? r.issue : undefined;
    const issuewild = typeof r.issuewild === 'string' ? r.issuewild : undefined;
    const iodef = typeof r.iodef === 'string' ? r.iodef : undefined;
    const parts = [
      `flags=${r.critical}`,
      issue !== undefined ? `issue=${issue}` : null,
      issuewild !== undefined ? `issuewild=${issuewild}` : null,
      iodef !== undefined ? `iodef=${iodef}` : null,
    ].filter(Boolean);
    return {
      critical: r.critical,
      issue,
      issuewild,
      iodef,
      raw: parts.join('; '),
    };
  });
}

export async function getDNSInfo(domain: string): Promise<DNSResult> {
  const resolver = new dns.promises.Resolver();
  resolver.setServers(['8.8.8.8', '1.1.1.1']);

  const clean = domain.replace(/^https?:\/\//, '').split('/')[0]!.toLowerCase();

  const [a, aaaa, mx, ns, txt, cname, caa, soa] = await Promise.allSettled([
    resolver.resolve4(clean),
    resolver.resolve6(clean),
    resolver.resolveMx(clean),
    resolver.resolveNs(clean),
    resolver.resolveTxt(clean),
    resolver.resolveCname(clean).catch(() => [] as string[]),
    resolver.resolveCaa(clean).catch(() => [] as dns.CaaRecord[]),
    resolver.resolveSoa(clean),
  ]);

  return {
    a: a.status === 'fulfilled' ? a.value : [],
    aaaa: aaaa.status === 'fulfilled' ? aaaa.value : [],
    mx: mx.status === 'fulfilled' ? mx.value : [],
    ns: ns.status === 'fulfilled' ? ns.value : [],
    txt: txt.status === 'fulfilled' ? txt.value : [],
    cname: cname.status === 'fulfilled' ? cname.value : [],
    caa: caa.status === 'fulfilled' ? mapCaa(caa.value) : [],
    soa: soa.status === 'fulfilled'
      ? {
          nsname: soa.value.nsname,
          hostmaster: soa.value.hostmaster,
          serial: soa.value.serial,
          refresh: soa.value.refresh,
          retry: soa.value.retry,
          expire: soa.value.expire,
          minttl: soa.value.minttl,
        }
      : undefined,
  };
}
