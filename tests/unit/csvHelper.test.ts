import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { parseCSV, exportToCSV } from '../../utils/csvHelper';
import { Domain, DomainStatus } from '../../types';

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
      expect(result[0].url).toBe('google.com');
      expect(result[1].url).toBe('github.com');
    });

    it('should handle CSV with extra whitespace', () => {
      const csvContent = `  url  ,  status  ,  latency  
  google.com  ,  ALIVE  ,  45  `;

      const result = parseCSV(csvContent);
      expect(result).toHaveLength(1);
      expect(result[0].url).toBe('google.com');
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
      expect(result[0].url).toBe('google.com');
    });

    it('should return empty array for empty content', () => {
      expect(parseCSV('')).toEqual([]);
      expect(parseCSV('   ')).toEqual([]);
    });

    it('should handle CSV with tags', () => {
      const csvContent = `url,tags
google.com,"search,tech"
github.com,"dev,git"`;

      const result = parseCSV(csvContent);
      expect(result).toHaveLength(2);
      expect(result[0].tags).toEqual(['search', 'tech']);
      expect(result[1].tags).toEqual(['dev', 'git']);
    });
  });

  describe('exportToCSV', () => {
    it('should export domains to CSV format', () => {
      const result = exportToCSV(mockDomains);
      expect(result).toContain('url,status,latency,addedAt,tags');
      expect(result).toContain('google.com,ALIVE,45');
      expect(result).toContain('github.com,ALIVE,120');
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

      const result = exportToCSV(domainsWithoutLatency);
      expect(result).toContain('example.com,UNKNOWN');
    });

    it('should handle domains with tags', () => {
      const result = exportToCSV(mockDomains);
      expect(result).toContain('google.com,ALIVE,45');
      expect(result).toContain('tags');
    });

    it('should return CSV header for empty domains array', () => {
      const result = exportToCSV([]);
      expect(result).toContain('url,status,latency,addedAt,tags');
    });

    it('should properly escape commas in tags', () => {
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

      const result = exportToCSV(domainsWithCommaTags);
      expect(result).toContain('"tag with, comma|normal-tag"');
    });
  });
});
