import { spawnSync } from 'node:child_process';
import { cp, mkdir, rm, writeFile } from 'node:fs/promises';

const env = {
  ...process.env,
  VITE_SITE_URL: process.env.VITE_SITE_URL || 'https://www.domainpulse.seanguillermo.com',
  VITE_APP_URL: process.env.VITE_APP_URL || 'https://www.domainpulse.seanguillermo.com/app',
  VITE_PROXY_URL: process.env.VITE_PROXY_URL || 'https://www.domainpulse.seanguillermo.com',
};
delete env.VITE_PASSWORD_HASH;
const result = spawnSync('npm', ['run', 'build:all'], { stdio: 'inherit', env });
if (result.status !== 0) process.exit(result.status || 1);
const output = new URL('../.cloudflare-assets/', import.meta.url);
await rm(output, { recursive: true, force: true });
await mkdir(new URL('app/', output), { recursive: true });
await cp(new URL('../dist-site/', import.meta.url), output, { recursive: true });
await cp(new URL('../dist-site/site.html', import.meta.url), new URL('index.html', output));
await cp(new URL('../dist/assets/', import.meta.url), new URL('assets/', output), { recursive: true });
await cp(new URL('../dist/index.html', import.meta.url), new URL('app/index.html', output));
await writeFile(new URL('_headers', output), `/*
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()
  Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
`);
console.log('Built Cloudflare marketing site, dashboard, and shared assets');
