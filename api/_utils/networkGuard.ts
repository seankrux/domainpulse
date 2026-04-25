import { lookup } from 'dns/promises';
import net from 'net';

const DEFAULT_TIMEOUT_MS = 10000;
const MIN_TIMEOUT_MS = 1000;
const MAX_TIMEOUT_MS = 15000;

const privateIPv4Ranges: Array<[string, number]> = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4]
];

const ipv4ToNumber = (ip: string): number => (
  ip.split('.').reduce((acc, octet) => (acc << 8) + Number(octet), 0) >>> 0
);

const isIPv4InRange = (ip: string, base: string, prefixLength: number): boolean => {
  const mask = prefixLength === 0 ? 0 : (0xffffffff << (32 - prefixLength)) >>> 0;
  return (ipv4ToNumber(ip) & mask) === (ipv4ToNumber(base) & mask);
};

const isBlockedIPv4 = (ip: string): boolean => (
  privateIPv4Ranges.some(([base, prefixLength]) => isIPv4InRange(ip, base, prefixLength))
);

const mappedIPv4 = (ip: string): string | null => {
  const match = ip.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i);
  return match?.[1] || null;
};

const isBlockedIPv6 = (ip: string): boolean => {
  const lower = ip.toLowerCase();
  return lower === '::'
    || lower === '::1'
    || lower.startsWith('fc')
    || lower.startsWith('fd')
    || lower.startsWith('fe8')
    || lower.startsWith('fe9')
    || lower.startsWith('fea')
    || lower.startsWith('feb');
};

const isBlockedAddress = (address: string): boolean => {
  const version = net.isIP(address);
  if (version === 4) return isBlockedIPv4(address);

  if (version === 6) {
    const mapped = mappedIPv4(address);
    return mapped ? isBlockedIPv4(mapped) : isBlockedIPv6(address);
  }

  return true;
};

const normalizeQueryValue = (value: string | string[] | undefined): string | undefined => (
  Array.isArray(value) ? value[0] : value
);

export const normalizeTimeoutMs = (
  value: string | string[] | undefined,
  fallback = DEFAULT_TIMEOUT_MS
): number => {
  const parsed = Number.parseInt(normalizeQueryValue(value) || '', 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, MIN_TIMEOUT_MS), MAX_TIMEOUT_MS);
};

export const normalizePublicHttpTarget = async (rawUrl: string): Promise<string> => {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    throw new Error('URL is required');
  }

  const parsed = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only HTTP and HTTPS URLs are supported');
  }

  if (parsed.username || parsed.password) {
    throw new Error('URL credentials are not supported');
  }

  if (parsed.port && parsed.port !== '80' && parsed.port !== '443') {
    throw new Error('Only standard HTTP and HTTPS ports are supported');
  }

  const hostname = parsed.hostname.toLowerCase();
  if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost')) {
    throw new Error('Localhost targets are not allowed');
  }

  const directIpVersion = net.isIP(hostname);
  if (directIpVersion > 0) {
    if (isBlockedAddress(hostname)) {
      throw new Error('Private or reserved network targets are not allowed');
    }
  } else {
    const addresses = await lookup(hostname, { all: true, verbatim: true });
    if (!addresses.length || addresses.some(({ address }) => isBlockedAddress(address))) {
      throw new Error('Target resolves to a private or reserved network address');
    }
  }

  parsed.username = '';
  parsed.password = '';
  parsed.hash = '';
  parsed.search = '';
  parsed.pathname = '/';

  return parsed.toString();
};
