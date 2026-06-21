/**
 * DNS lookup — single source of truth for the `/api/dns` endpoint and the dev
 * proxy. Uses public resolvers (8.8.8.8 / 1.1.1.1) for reliability.
 */
import * as dns from 'dns';

export interface DNSResult {
  a: string[];
  mx: { exchange: string; priority: number }[];
  ns: string[];
  txt: string[][];
  cname: string[];
}

export async function getDNSInfo(domain: string): Promise<DNSResult> {
  const resolver = new dns.promises.Resolver();
  resolver.setServers(['8.8.8.8', '1.1.1.1']);

  const [a, mx, ns, txt, cname] = await Promise.allSettled([
    resolver.resolve4(domain),
    resolver.resolveMx(domain),
    resolver.resolveNs(domain),
    resolver.resolveTxt(domain),
    resolver.resolveCname(domain).catch(() => []), // CNAME might not exist
  ]);

  return {
    a: a.status === 'fulfilled' ? a.value : [],
    mx: mx.status === 'fulfilled' ? mx.value : [],
    ns: ns.status === 'fulfilled' ? ns.value : [],
    txt: txt.status === 'fulfilled' ? txt.value : [],
    cname: cname.status === 'fulfilled' ? cname.value : [],
  };
}
