import { createServer } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { getSSLCertificate } from '../api/_utils/sslLookup.js';
import { isBlockedHost, validateOutboundUrlResolved } from '../api/_utils/ssrfGuard.js';

const token = process.env.SSL_ORIGIN_TOKEN;
if (!token) throw new Error('SSL_ORIGIN_TOKEN is required');

createServer(async (request, response) => {
  response.setHeader('Content-Type', 'application/json');
  response.setHeader('Cache-Control', 'no-store');
  const supplied = Buffer.from(request.headers.authorization ?? '');
  const expected = Buffer.from(`Bearer ${token}`);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    response.writeHead(401).end(JSON.stringify({ error: 'Unauthorized' }));
    return;
  }
  const url = new URL(request.url ?? '/', 'http://localhost');
  if (request.method !== 'GET' || url.pathname !== '/ssl') {
    response.writeHead(404).end(JSON.stringify({ error: 'Not found' }));
    return;
  }
  const domain = url.searchParams.get('domain');
  if (!domain || isBlockedHost(domain) || !(await validateOutboundUrlResolved(`https://${domain}`)).ok) {
    response.writeHead(400).end(JSON.stringify({ error: 'Invalid or blocked domain' }));
    return;
  }
  try {
    const result = await getSSLCertificate(domain);
    response.writeHead(200).end(JSON.stringify(result));
  } catch {
    response.writeHead(502).end(JSON.stringify({ error: 'Certificate lookup failed' }));
  }
}).listen(Number(process.env.PORT ?? 4059), '127.0.0.1', () => {
  process.stdout.write('DomainPulse protected certificate origin listening on loopback\n');
});
