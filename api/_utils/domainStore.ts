/**
 * DomainPulse persistence — Neon-backed store for domains, history, groups, settings.
 */
import { getSql } from './db';
import type { Domain, DomainGroup, StatusRecord } from '../../types';

export interface PersistedStore {
  domains: Domain[];
  groups: DomainGroup[];
  settings: Record<string, unknown>;
}

function parseDate(value: unknown): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function reviveDomain(row: Record<string, unknown>, history: StatusRecord[]): Domain {
  const ssl = row.ssl as Domain['ssl'] | null;
  const expiry = row.expiry as Domain['expiry'] | null;
  const gmb = row.gmb as Domain['gmb'] | null;
  const canonical = row.canonical as Domain['canonical'] | null;

  return {
    id: String(row.id),
    url: String(row.url),
    status: row.status as Domain['status'],
    statusCode: row.status_code != null ? Number(row.status_code) : undefined,
    latency: row.latency != null ? Number(row.latency) : undefined,
    lastChecked: parseDate(row.last_checked),
    addedAt: parseDate(row.added_at) ?? new Date(),
    history,
    ssl: ssl
      ? {
          ...ssl,
          validFrom: ssl.validFrom ? parseDate(ssl.validFrom) : undefined,
          validTo: ssl.validTo ? parseDate(ssl.validTo) : undefined,
        }
      : undefined,
    expiry: expiry
      ? {
          ...expiry,
          expiryDate: expiry.expiryDate ? parseDate(expiry.expiryDate) : undefined,
          createdDate: expiry.createdDate ? parseDate(expiry.createdDate) : undefined,
          updatedDate: expiry.updatedDate ? parseDate(expiry.updatedDate) : undefined,
        }
      : undefined,
    dns: (row.dns as Domain['dns']) ?? undefined,
    techStack: (row.tech_stack as Domain['techStack']) ?? undefined,
    canonical: canonical
      ? {
          ...canonical,
          lastChecked: canonical.lastChecked ? parseDate(canonical.lastChecked) : undefined,
        }
      : undefined,
    groupId: row.group_id ? String(row.group_id) : undefined,
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
    formCheck: (row.form_check as Domain['formCheck']) ?? undefined,
    callCheck: (row.call_check as Domain['callCheck']) ?? undefined,
    gmbPlaceId: row.gmb_place_id ? String(row.gmb_place_id) : undefined,
    gmb: gmb
      ? {
          ...gmb,
          lastChecked: gmb.lastChecked ? parseDate(gmb.lastChecked) : undefined,
        }
      : undefined,
  };
}

export async function loadStore(): Promise<PersistedStore> {
  const sql = getSql();

  const [domainRows, historyRows, groupRows, settingsRows] = await Promise.all([
    sql`SELECT * FROM domains ORDER BY added_at ASC`,
    sql`SELECT domain_id, timestamp, status, status_code, latency
        FROM domain_history
        ORDER BY timestamp ASC`,
    sql`SELECT id, name, color FROM groups ORDER BY name ASC`,
    sql`SELECT settings FROM app_settings WHERE id = 'default' LIMIT 1`,
  ]);

  const historyByDomain = new Map<string, StatusRecord[]>();
  for (const row of historyRows) {
    const domainId = String(row.domain_id);
    const list = historyByDomain.get(domainId) ?? [];
    list.push({
      timestamp: parseDate(row.timestamp) ?? new Date(),
      status: row.status as StatusRecord['status'],
      statusCode: Number(row.status_code) || 0,
      latency: Number(row.latency) || 0,
    });
    historyByDomain.set(domainId, list);
  }

  const domains = domainRows.map((row) =>
    reviveDomain(row as Record<string, unknown>, historyByDomain.get(String(row.id)) ?? []),
  );

  const groups: DomainGroup[] = groupRows.map((g) => ({
    id: String(g.id),
    name: String(g.name),
    color: String(g.color),
  }));

  const settings =
    settingsRows[0]?.settings && typeof settingsRows[0].settings === 'object'
      ? (settingsRows[0].settings as Record<string, unknown>)
      : {};

  return { domains, groups, settings };
}

/**
 * Replace the full store atomically enough for a single-tenant dashboard.
 * Upsert groups → upsert domains/history → prune deleted domains → prune groups.
 */
export async function saveStore(store: PersistedStore): Promise<void> {
  const sql = getSql();
  const { domains, groups, settings } = store;

  for (const g of groups) {
    await sql`
      INSERT INTO groups (id, name, color, updated_at)
      VALUES (${g.id}, ${g.name}, ${g.color}, now())
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        color = EXCLUDED.color,
        updated_at = now()
    `;
  }

  const domainIds = domains.map((d) => d.id);

  for (const d of domains) {
    await sql`
      INSERT INTO domains (
        id, url, status, status_code, latency, last_checked, added_at,
        group_id, tags, ssl, expiry, dns, tech_stack, canonical,
        form_check, call_check, gmb_place_id, gmb, updated_at
      ) VALUES (
        ${d.id},
        ${d.url},
        ${d.status},
        ${d.statusCode ?? null},
        ${d.latency ?? null},
        ${d.lastChecked ? d.lastChecked.toISOString() : null},
        ${d.addedAt.toISOString()},
        ${d.groupId ?? null},
        ${d.tags ?? []},
        ${d.ssl ?? null},
        ${d.expiry ?? null},
        ${d.dns ?? null},
        ${d.techStack ?? null},
        ${d.canonical ?? null},
        ${d.formCheck ?? null},
        ${d.callCheck ?? null},
        ${d.gmbPlaceId ?? null},
        ${d.gmb ?? null},
        now()
      )
      ON CONFLICT (id) DO UPDATE SET
        url = EXCLUDED.url,
        status = EXCLUDED.status,
        status_code = EXCLUDED.status_code,
        latency = EXCLUDED.latency,
        last_checked = EXCLUDED.last_checked,
        added_at = EXCLUDED.added_at,
        group_id = EXCLUDED.group_id,
        tags = EXCLUDED.tags,
        ssl = EXCLUDED.ssl,
        expiry = EXCLUDED.expiry,
        dns = EXCLUDED.dns,
        tech_stack = EXCLUDED.tech_stack,
        canonical = EXCLUDED.canonical,
        form_check = EXCLUDED.form_check,
        call_check = EXCLUDED.call_check,
        gmb_place_id = EXCLUDED.gmb_place_id,
        gmb = EXCLUDED.gmb,
        updated_at = now()
    `;

    await sql`DELETE FROM domain_history WHERE domain_id = ${d.id}`;
    for (const h of d.history) {
      await sql`
        INSERT INTO domain_history (domain_id, timestamp, status, status_code, latency)
        VALUES (
          ${d.id},
          ${h.timestamp.toISOString()},
          ${h.status},
          ${h.statusCode},
          ${h.latency}
        )
      `;
    }
  }

  if (domainIds.length > 0) {
    await sql`DELETE FROM domains WHERE NOT (id = ANY(${domainIds}))`;
  } else {
    await sql`DELETE FROM domains`;
  }

  const groupIds = groups.map((g) => g.id);
  if (groupIds.length > 0) {
    await sql`DELETE FROM groups WHERE NOT (id = ANY(${groupIds}))`;
  } else {
    await sql`DELETE FROM groups`;
  }

  await sql`
    INSERT INTO app_settings (id, settings, updated_at)
    VALUES ('default', ${settings ?? {}}, now())
    ON CONFLICT (id) DO UPDATE SET
      settings = EXCLUDED.settings,
      updated_at = now()
  `;
}
