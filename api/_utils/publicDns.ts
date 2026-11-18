import * as dns from 'node:dns';
import { isWorkerRuntime } from './workerTransport.js';

interface Answer { type: number; data: string }
interface Resolver {
  resolve4(host: string): Promise<string[]>;
  resolve6(host: string): Promise<string[]>;
  resolveNs(host: string): Promise<string[]>;
  resolveCname(host: string): Promise<string[]>;
  resolveTxt(host: string): Promise<string[][]>;
  resolveMx(host: string): Promise<dns.MxRecord[]>;
  resolveCaa(host: string): Promise<dns.CaaRecord[]>;
  resolveSoa(host: string): Promise<dns.SoaRecord>;
}

async function query(host: string, type: string, code: number): Promise<Answer[]> {
  const response = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=${type}`, {
    headers: { Accept: 'application/dns-json' }, signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`Public DNS returned HTTP ${response.status}`);
  const result = await response.json() as { Status: number; Answer?: Answer[] };
  if (result.Status !== 0 && result.Status !== 3) throw new Error(`Public DNS returned status ${result.Status}`);
  return (result.Answer ?? []).filter((answer) => answer.type === code);
}

const hostname = (value: string) => value.replace(/\.$/, '');

export function publicResolver(): Resolver {
  if (!isWorkerRuntime()) {
    const resolver = new dns.promises.Resolver();
    resolver.setServers(['8.8.8.8', '1.1.1.1']);
    return resolver;
  }
  return {
    resolve4: async (host) => (await query(host, 'A', 1)).map((r) => r.data),
    resolve6: async (host) => (await query(host, 'AAAA', 28)).map((r) => r.data),
    resolveNs: async (host) => (await query(host, 'NS', 2)).map((r) => hostname(r.data)),
    resolveCname: async (host) => (await query(host, 'CNAME', 5)).map((r) => hostname(r.data)),
    resolveTxt: async (host) => (await query(host, 'TXT', 16)).map((r) => {
      const parts = [...r.data.matchAll(/"((?:\\.|[^"\\])*)"/g)].map((m) => m[1]!.replace(/\\"/g, '"').replace(/\\\\/g, '\\'));
      return parts.length ? parts : [r.data];
    }),
    resolveMx: async (host) => (await query(host, 'MX', 15)).map((r) => {
      const [priority, exchange] = r.data.split(/\s+/);
      if (!exchange || !Number.isFinite(Number(priority))) throw new Error('Malformed MX response');
      return { priority: Number(priority), exchange: hostname(exchange) };
    }),
    resolveCaa: async (host) => (await query(host, 'CAA', 257)).map((r) => {
      const match = r.data.match(/^(\d+)\s+(\w+)\s+"?(.*?)"?$/);
      if (!match) throw new Error('Malformed CAA response');
      const record: dns.CaaRecord = { critical: Number(match[1]) };
      const tag = match[2];
      if (tag === 'issue' || tag === 'issuewild' || tag === 'iodef') record[tag] = match[3]!;
      return record;
    }),
    resolveSoa: async (host) => {
      const answer = (await query(host, 'SOA', 6))[0];
      if (!answer) throw new Error('No SOA record');
      const [nsname, hostmaster, ...numbers] = answer.data.split(/\s+/);
      if (!nsname || !hostmaster || numbers.length !== 5 || numbers.some((n) => !Number.isFinite(Number(n)))) throw new Error('Malformed SOA response');
      return { nsname: hostname(nsname), hostmaster: hostname(hostmaster), serial: Number(numbers[0]), refresh: Number(numbers[1]), retry: Number(numbers[2]), expire: Number(numbers[3]), minttl: Number(numbers[4]) };
    },
  };
}
