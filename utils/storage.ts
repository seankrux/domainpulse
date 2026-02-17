import { Domain, DomainStatus, StatusRecord, SSLInfo, DomainExpiry, DomainGroup } from '../types';
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
  status: string;
  issuer?: string;
  validFrom?: string;
  validTo?: string;
  daysUntilExpiry?: number;
}

interface StoredDomainExpiry {
  expiryDate?: string;
  registrar?: string;
  daysUntilExpiry?: number;
  status: 'active' | 'expiring' | 'expired' | 'unknown';
}

interface StoredSettings {
  autoRefresh: boolean;
  refreshInterval: number;
  darkMode: boolean;
  maxHistoryRecords: number;
  enableNotifications: boolean;
  playSound: boolean;
}

interface StoredGroup {
  id: string;
  name: string;
  color: string;
}

const toStored = (domain: Domain): StoredDomain => ({
  ...domain,
  lastChecked: domain.lastChecked?.toISOString(),
  addedAt: domain.addedAt?.toISOString() ?? new Date().toISOString(),
  history: domain.history.map(h => ({
    ...h,
    timestamp: h.timestamp.toISOString()
  })),
  ssl: domain.ssl ? {
    ...domain.ssl,
    validFrom: domain.ssl.validFrom?.toISOString(),
    validTo: domain.ssl.validTo?.toISOString()
  } : undefined,
  expiry: domain.expiry ? {
    ...domain.expiry,
    expiryDate: domain.expiry.expiryDate?.toISOString()
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
    validFrom: stored.ssl.validFrom ? new Date(stored.ssl.validFrom) : undefined,
    validTo: stored.ssl.validTo ? new Date(stored.ssl.validTo) : undefined
  } : undefined,
  expiry: stored.expiry ? {
    ...stored.expiry,
    expiryDate: stored.expiry.expiryDate ? new Date(stored.expiry.expiryDate) : undefined
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
    const stored = domains.map(toStored);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch (error) {
    console.error('Failed to save domains to localStorage:', error);
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
      // First time user - seed with sample groups
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
  // Remove groupId from domains
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
    const parsed: StoredSettings = JSON.parse(stored);
    return {
      autoRefresh: parsed.autoRefresh ?? false,
      refreshInterval: parsed.refreshInterval ?? 300000,
      darkMode: parsed.darkMode ?? false,
      maxHistoryRecords: parsed.maxHistoryRecords ?? 100,
      enableNotifications: parsed.enableNotifications ?? false,
      playSound: parsed.playSound ?? false
    };
  } catch (error) {
    console.error('Failed to load settings:', error);
    return defaultSettings;
  }
};

export const saveSettings = (settings: AppSettings): void => {
  try {
    const stored: StoredSettings = {
      autoRefresh: settings.autoRefresh,
      refreshInterval: settings.refreshInterval,
      darkMode: settings.darkMode,
      maxHistoryRecords: settings.maxHistoryRecords,
      enableNotifications: settings.enableNotifications,
      playSound: settings.playSound
    };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(stored));
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
}

export const defaultSettings: AppSettings = {
  autoRefresh: false,
  refreshInterval: 300000, // 5 minutes
  darkMode: false,
  maxHistoryRecords: 100,
  enableNotifications: false,
  playSound: false
};
