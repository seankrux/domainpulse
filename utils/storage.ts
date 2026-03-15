import { Domain, DomainStatus, DomainGroup, WebhookConfig, SSLStatus } from '../types';
import { SAMPLE_DOMAINS, SAMPLE_GROUPS } from '../data/seed';

const STORAGE_KEY = 'domainpulse_domains';
const SETTINGS_KEY = 'domainpulse_settings';
const GROUPS_KEY = 'domainpulse_groups';

interface StoredDomain {
  id: string;
  url: string;
  status: DomainStatus;
  statusCode?: number;
  latency?: number;
  lastChecked?: string;
  addedAt: string;
  history: StoredStatusRecord[];
  ssl?: StoredSSLInfo;
  expiry?: StoredDomainExpiry;
  groupId?: string;
  tags: string[];
}

interface StoredStatusRecord {
  timestamp: string;
  status: DomainStatus;
  statusCode: number;
  latency: number;
}

interface StoredSSLInfo {
  status: SSLStatus;
  issuer?: string;
  validFrom?: string;
  validTo?: string;
  daysUntilExpiry?: number;
}

interface StoredDomainExpiry {
  expiryDate?: string;
  createdDate?: string;
  updatedDate?: string;
  registrar?: string;
  registrarUrl?: string;
  registrarIanaId?: string;
  domainStatus?: string[];
  nameServers?: string[];
  dnssec?: string;
  daysUntilExpiry?: number;
  status: 'active' | 'expiring' | 'expired' | 'unknown';
}

interface StoredGroup {
  id: string;
  name: string;
  color: string;
}

const toStored = (domain: Domain): StoredDomain => ({
  ...domain,
  lastChecked: domain.lastChecked ? (domain.lastChecked instanceof Date ? domain.lastChecked.toISOString() : domain.lastChecked) : undefined,
  addedAt: domain.addedAt ? (domain.addedAt instanceof Date ? domain.addedAt.toISOString() : domain.addedAt) : new Date().toISOString(),
  history: domain.history.map(h => ({
    ...h,
    timestamp: h.timestamp instanceof Date ? h.timestamp.toISOString() : h.timestamp
  })),
  ssl: domain.ssl ? {
    ...domain.ssl,
    validFrom: domain.ssl.validFrom ? (domain.ssl.validFrom instanceof Date ? domain.ssl.validFrom.toISOString() : domain.ssl.validFrom) : undefined,
    validTo: domain.ssl.validTo ? (domain.ssl.validTo instanceof Date ? domain.ssl.validTo.toISOString() : domain.ssl.validTo) : undefined
  } : undefined,
  expiry: domain.expiry ? {
    ...domain.expiry,
    expiryDate: domain.expiry.expiryDate ? (domain.expiry.expiryDate instanceof Date ? domain.expiry.expiryDate.toISOString() : domain.expiry.expiryDate) : undefined,
    createdDate: domain.expiry.createdDate ? (domain.expiry.createdDate instanceof Date ? domain.expiry.createdDate.toISOString() : domain.expiry.createdDate) : undefined,
    updatedDate: domain.expiry.updatedDate ? (domain.expiry.updatedDate instanceof Date ? domain.expiry.updatedDate.toISOString() : domain.expiry.updatedDate) : undefined
  } : undefined,
  tags: domain.tags || []
});

const fromStored = (stored: StoredDomain): Domain => ({
  ...stored,
  lastChecked: stored.lastChecked ? new Date(stored.lastChecked) : undefined,
  addedAt: new Date(stored.addedAt),
  history: stored.history.map(h => ({
    ...h,
    timestamp: new Date(h.timestamp)
  })),
  ssl: stored.ssl ? {
    ...stored.ssl,
    status: stored.ssl.status as SSLStatus,
    validFrom: stored.ssl.validFrom ? new Date(stored.ssl.validFrom) : undefined,
    validTo: stored.ssl.validTo ? new Date(stored.ssl.validTo) : undefined
  } : undefined,
  expiry: stored.expiry ? {
    ...stored.expiry,
    expiryDate: stored.expiry.expiryDate ? new Date(stored.expiry.expiryDate) : undefined,
    createdDate: stored.expiry.createdDate ? new Date(stored.expiry.createdDate) : undefined,
    updatedDate: stored.expiry.updatedDate ? new Date(stored.expiry.updatedDate) : undefined
  } : undefined,
  tags: stored.tags || []
});

export const loadDomains = (): Domain[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      // First time user - seed with sample domains
      saveDomains(SAMPLE_DOMAINS);
      return SAMPLE_DOMAINS;
    }
    const parsed: StoredDomain[] = JSON.parse(stored);
    return parsed.map(fromStored);
  } catch (error) {
    console.error('Failed to load domains from localStorage:', error);
    return [];
  }
};

export const saveDomains = (domains: Domain[]): void => {
  try {
    let stored = domains.map(toStored);
    let serialized = JSON.stringify(stored);

    // Protection against LocalStorage QuotaExceededError (typically 5MB)
    if (serialized.length > 4 * 1024 * 1024) {
      console.warn('LocalStorage limit approaching, trimming history records...');
      stored = stored.map(d => ({
        ...d,
        history: d.history.slice(-20)
      }));
      serialized = JSON.stringify(stored);
    }

    localStorage.setItem(STORAGE_KEY, serialized);
  } catch (error) {
    if (error instanceof Error && error.name === 'QuotaExceededError') {
      console.error('LocalStorage quota exceeded! Clearing old history...');
      const domains = loadDomains();
      const trimmed = domains.map(d => ({ ...d, history: d.history.slice(-5) }));
      saveDomains(trimmed);
    } else {
      console.error('Failed to save domains to localStorage:', error);
    }
  }
};

export const clearDomains = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear domains from localStorage:', error);
  }
};

// Groups management
export const loadGroups = (): DomainGroup[] => {
  try {
    const stored = localStorage.getItem(GROUPS_KEY);
    if (!stored) {
      saveGroups(SAMPLE_GROUPS);
      return SAMPLE_GROUPS;
    }
    const parsed: StoredGroup[] = JSON.parse(stored);
    return parsed;
  } catch (error) {
    console.error('Failed to load groups from localStorage:', error);
    return [];
  }
};

export const saveGroups = (groups: DomainGroup[]): void => {
  try {
    localStorage.setItem(GROUPS_KEY, JSON.stringify(groups));
  } catch (error) {
    console.error('Failed to save groups to localStorage:', error);
  }
};

export const addGroup = (group: DomainGroup): void => {
  const groups = loadGroups();
  groups.push(group);
  saveGroups(groups);
};

export const removeGroup = (groupId: string): void => {
  const groups = loadGroups().filter(g => g.id !== groupId);
  saveGroups(groups);
  const domains = loadDomains().map(d => 
    d.groupId === groupId ? { ...d, groupId: undefined } : d
  );
  saveDomains(domains);
};

export const updateGroup = (groupId: string, updates: Partial<DomainGroup>): void => {
  const groups = loadGroups().map(g => 
    g.id === groupId ? { ...g, ...updates } : g
  );
  saveGroups(groups);
};

// Settings management
export const loadSettings = (): AppSettings => {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (!stored) return defaultSettings;
    const parsed = JSON.parse(stored);
    return {
      ...defaultSettings,
      ...parsed
    };
  } catch (error) {
    console.error('Failed to load settings:', error);
    return defaultSettings;
  }
};

export const saveSettings = (settings: AppSettings): void => {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('Failed to save settings:', error);
  }
};

export interface AppSettings {
  autoRefresh: boolean;
  refreshInterval: number;
  darkMode: boolean;
  maxHistoryRecords: number;
  enableNotifications: boolean;
  playSound: boolean;
  webhooks: WebhookConfig[];
  customUserAgent: string;
  latencyThreshold: number;
  checkTimeout: number;
}

export const defaultSettings: AppSettings = {
  autoRefresh: false,
  refreshInterval: 300000, // 5 minutes
  darkMode: false,
  maxHistoryRecords: 100,
  enableNotifications: false,
  playSound: false,
  webhooks: [],
  customUserAgent: 'DomainPulse/1.0',
  latencyThreshold: 1000,
  checkTimeout: 15000
};
