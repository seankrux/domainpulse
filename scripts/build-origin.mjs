import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const result = spawnSync('esbuild', ['server/cloudflare-tls-origin.ts', '--bundle', '--platform=node', '--format=cjs', '--packages=bundle', '--outfile=.cloudflare-origin/server.cjs'], { stdio: 'inherit' });
if (result.status !== 0) process.exit(result.status || 1);
const sha = process.env.GITHUB_SHA || spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim();
const sha256 = createHash('sha256').update(readFileSync('.cloudflare-origin/server.cjs')).digest('hex');
writeFileSync('.cloudflare-origin/release.json', JSON.stringify({ commit: sha, sha256 }) + '\n');
