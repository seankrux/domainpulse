import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { loadDomains, saveDomains, loadSettings, saveSettings } from '../../utils/storage';

describe('storage', () => {
  const mockDomains = [
    {
      id: 'test-1',
      url: 'google.com',
      status: 'ALIVE',
      statusCode: 200,
      latency: 45,
      addedAt: new Date('2024-01-01').toISOString(),
      history: [],
      tags: []
    }
  ];

  const mockSettings = {
    darkMode: true,
    autoRefresh: true,
    refreshInterval: 300000,
    enableNotifications: false,
    playSound: false,
    webhooks: [],
    maxHistoryRecords: 100,
    customUserAgent: '',
    checkTimeout: 15000
  };

  beforeEach(() => {
    // Mock localStorage with proper this binding
    const store = new Map<string, string>();
    const localStorageMock = {
      getItem: vi.fn((key: string) => store.get(key) || null),
      setItem: vi.fn((key: string, value: string) => { store.set(key, value); }),
      removeItem: vi.fn((key: string) => { store.delete(key); }),
      clear: vi.fn(() => { store.clear(); })
    };
    Object.defineProperty(window, 'localStorage', { value: localStorageMock, writable: true });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('saveDomains', () => {
    it('should save domains to localStorage', () => {
      saveDomains(mockDomains as any);
      expect(window.localStorage.setItem).toHaveBeenCalledWith(
        'domainpulse_domains',
        expect.any(String)
      );
    });

    it('should handle quota exceeded error', () => {
      const localStorageMock = window.localStorage as any;
      localStorageMock.setItem.mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });

      expect(() => saveDomains(mockDomains as any)).not.toThrow();
    });
  });

  describe('loadDomains', () => {
    it('should return sample domains when no domains saved', () => {
      const domains = loadDomains();
      expect(domains.length).toBeGreaterThan(0); // Returns sample domains by default
    });

    it('should load domains from localStorage', () => {
      const storedData = JSON.stringify([{
        id: 'test-1',
        url: 'google.com',
        status: 'ALIVE',
        statusCode: 200,
        latency: 45,
        addedAt: '2024-01-01T00:00:00.000Z',
        history: [],
        tags: []
      }]);
      (window.localStorage.getItem as any).mockReturnValue(storedData);

      const domains = loadDomains();
      expect(domains.length).toBe(1);
      expect(domains[0]?.url).toBe('google.com');
    });
  });

  describe('saveSettings', () => {
    it('should save settings to localStorage', () => {
      saveSettings(mockSettings as any);
      expect(window.localStorage.setItem).toHaveBeenCalledWith(
        'domainpulse_settings',
        expect.any(String)
      );
    });
  });

  describe('loadSettings', () => {
    it('should return default settings when none saved', () => {
      const settings = loadSettings();
      expect(settings).toBeDefined();
      expect(settings.darkMode).toBe(false);
      expect(settings.autoRefresh).toBe(false); // Default is false
    });

    it('should load settings from localStorage', () => {
      const storedData = JSON.stringify({
        darkMode: true,
        autoRefresh: false,
        refreshInterval: 60000
      });
      (window.localStorage.getItem as any).mockReturnValue(storedData);

      const settings = loadSettings();
      expect(settings.darkMode).toBe(true);
      expect(settings.autoRefresh).toBe(false);
      expect(settings.refreshInterval).toBe(60000);
    });
  });
});
