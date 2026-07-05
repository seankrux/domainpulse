#!/usr/bin/env node
/**
 * Generate the env values that turn on the login portal.
 *
 * Usage:
 *   npm run auth:hash -- 'your-password-here'
 *
 * Prints a PBKDF2 `hash:salt` for VITE_PASSWORD_HASH (the same derivation
 * api/login.ts and server/proxy.ts verify against) plus a fresh JWT_SECRET.
 * Put both in `.env.local` (dev) or the deployment env (production).
 */
import crypto from 'node:crypto';

const password = process.argv[2];

if (!password) {
  console.error("Usage: npm run auth:hash -- 'your-password-here'");
  process.exit(1);
}
if (password.length < 8) {
  console.error('Password must be at least 8 characters.');
  process.exit(1);
}

const salt = crypto.randomBytes(16).toString('hex');
const hash = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256').toString('hex');
const jwtSecret = crypto.randomBytes(32).toString('hex');

console.log('# Add these to .env.local (dev) or your deployment environment:');
console.log(`VITE_PASSWORD_HASH=${hash}:${salt}`);
console.log(`JWT_SECRET=${jwtSecret}`);
