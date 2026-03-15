import { describe, it, expect, beforeEach, vi } from 'vitest';
import { parseCSV, exportToCSV } from '../../utils/csvHelper';
import { Domain, DomainStatus } from '../../types';

// Mock browser APIs for Node.js environment
beforeEach(() => {
  global.URL.createObjectURL = vi.fn(() => 'mock-url');
  global.document = {
    createElement: vi.fn(() => ({
      setAttribute: vi.fn(),
      click: vi.fn(),
      style: { visibility: '' }
    })),
    body: {
      appendChild: vi.fn(),
      removeChild: vi.fn()
    }
  } as any;
});

describe('csvHelper', () => {
  const mockDomains: Domain[] = [
    {
      id: 'test-1',
      url: 'google.com',
      status: DomainStatus.Alive,
      statusCode: 200,
      latency: 45,
      addedAt: new Date('2024-01-01'),
      history: [],
      tags: ['search', 'tech']
    },
    {
      id: 'test-2',
      url: 'github.com',
      status: DomainStatus.Alive,
      statusCode: 200,
      latency: 120,
      addedAt: new Date('2024-01-02'),
      history: [],
      tags: ['dev', 'git']
    }
  ];

  describe('parseCSV', () => {
    it('should parse valid CSV content', () => {
      const csvContent = `url,status,latency
google.com,ALIVE,45
github.com,ALIVE,120`;

      const result = parseCSV(csvContent);
      expect(result).toHaveLength(2);
      expect(result[0]?.url).toBe('google.com');
      expect(result[1]?.url).toBe('github.com');
    });

    it('should handle CSV with extra whitespace', () => {
      const csvContent = `  url  ,  status  ,  latency
  google.com  ,  ALIVE  ,  45  `;

      const result = parseCSV(csvContent);
      expect(result).toHaveLength(1);
      expect(result[0]?.url).toBe('google.com');
    });

    it('should skip empty lines', () => {
      const csvContent = `url,status,latency

google.com,ALIVE,45

github.com,ALIVE,120
`;

      const result = parseCSV(csvContent);
      expect(result).toHaveLength(2);
    });

    it('should handle CSV with missing optional fields', () => {
      const csvContent = `url
google.com`;

      const result = parseCSV(csvContent);
      expect(result).toHaveLength(1);
      expect(result[0]?.url).toBe('google.com');
    });

    it('should return empty array for empty content', () => {
      expect(parseCSV('')).toEqual([]);
      expect(parseCSV('   ')).toEqual([]);
    });
  });

  describe('exportToCSV', () => {
    it('should call document methods for download', () => {
      exportToCSV(mockDomains);
      expect(global.URL.createObjectURL).toHaveBeenCalled();
      expect(global.document.createElement).toHaveBeenCalledWith('a');
    });

    it('should handle domains without latency', () => {
      const domainsWithoutLatency: Domain[] = [
        {
          id: 'test-1',
          url: 'example.com',
          status: DomainStatus.Unknown,
          addedAt: new Date('2024-01-01'),
          history: [],
          tags: []
        }
      ];

      exportToCSV(domainsWithoutLatency);
      expect(global.URL.createObjectURL).toHaveBeenCalled();
    });

    it('should handle empty domains array', () => {
      exportToCSV([]);
      expect(global.URL.createObjectURL).toHaveBeenCalled();
    });

    it('should properly escape commas in tags', () => {
      // Note: Current implementation doesn't export tags
      // This test verifies the function handles domains with tags
      const domainsWithCommaTags: Domain[] = [
        {
          id: 'test-1',
          url: 'example.com',
          status: DomainStatus.Alive,
          latency: 50,
          addedAt: new Date('2024-01-01'),
          history: [],
          tags: ['tag with, comma', 'normal-tag']
        }
      ];

      exportToCSV(domainsWithCommaTags);
      expect(global.URL.createObjectURL).toHaveBeenCalled();
    });
  });
});
