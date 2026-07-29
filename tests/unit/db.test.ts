import { describe, it, expect } from 'vitest';
import { isDatabaseConfigured } from '../../api/_utils/db';

describe('db config', () => {
  it('reports unconfigured when DATABASE_URL is missing', () => {
    const prev = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    expect(isDatabaseConfigured()).toBe(false);
    if (prev !== undefined) process.env.DATABASE_URL = prev;
  });

  it('reports configured when DATABASE_URL is set', () => {
    const prev = process.env.DATABASE_URL;
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost/db';
    expect(isDatabaseConfigured()).toBe(true);
    if (prev !== undefined) process.env.DATABASE_URL = prev;
    else delete process.env.DATABASE_URL;
  });
});
