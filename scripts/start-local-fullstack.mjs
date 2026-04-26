import { spawn } from 'node:child_process';

const API_PORT = process.env.DOMAINPULSE_API_PORT || '3002';
const APP_PORT = process.env.DOMAINPULSE_APP_PORT || '3001';
const API_URL = `http://127.0.0.1:${API_PORT}`;
const APP_URL = `http://127.0.0.1:${APP_PORT}`;

const children = [];

const run = (name, command, args, env) => {
  const child = spawn(command, args, {
    shell: true,
    stdio: 'inherit',
    env: {
      ...process.env,
      ...env,
    },
  });

  children.push(child);
  child.on('exit', (code, signal) => {
    if (signal) {
      console.log(`[${name}] stopped by ${signal}`);
      return;
    }
    if (code !== 0) {
      console.error(`[${name}] exited with code ${code}`);
      process.exitCode = code || 1;
      stopAll();
    }
  });

  return child;
};

const stopAll = () => {
  for (const child of children) {
    if (!child.killed) {
      child.kill();
    }
  }
};

process.on('SIGINT', () => {
  stopAll();
  process.exit(130);
});

process.on('SIGTERM', () => {
  stopAll();
  process.exit(143);
});

console.log(`DomainPulse API: ${API_URL}`);
console.log(`DomainPulse app: ${APP_URL}`);

run('api', 'npm', ['run', 'server'], {
  PROXY_PORT: API_PORT,
  ALLOWED_ORIGINS: [
    `http://localhost:${APP_PORT}`,
    `http://127.0.0.1:${APP_PORT}`,
  ].join(','),
});

run('app', 'npm', ['run', 'dev:app', '--', '--host', '127.0.0.1', '--port', APP_PORT, '--strictPort'], {
  VITE_PROXY_URL: API_URL,
});
