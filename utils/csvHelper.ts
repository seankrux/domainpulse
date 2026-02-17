import { Domain, DomainStatus } from '../types';
import { normalizeUrl } from '../services/domainService';

/**
 * Parses a CSV line handling quoted fields that may contain commas.
 */
const parseCSVLine = (line: string): string[] => {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // Field separator
      result.push(current.trim().replace(/^"|"$/g, ''));
      current = '';
    } else {
      current += char;
    }
  }

  // Add the last field
  result.push(current.trim().replace(/^"|"$/g, ''));

  return result;
};

export const parseCSV = (content: string): Partial<Domain>[] => {
  const lines = content.split(/\r?\n/).filter(line => line.trim());
  const domains: Partial<Domain>[] = [];

  for (let i = 0; i < lines.length; i++) {
    const parts = parseCSVLine(lines[i]);
    const rawUrl = parts[0];

    // Skip empty or header rows
    if (!rawUrl || (i === 0 && (rawUrl.toLowerCase() === 'domain' || rawUrl.toLowerCase() === 'url'))) {
      continue;
    }

    domains.push({
      url: normalizeUrl(rawUrl),
      status: DomainStatus.Unknown,
      addedAt: new Date(),
    });
  }

  return domains;
};

export const exportToCSV = (domains: Domain[]) => {
  const headers = ['URL', 'Status', 'Status Code', 'Latency (ms)', 'Last Checked', 'Added At'];
  const rows = domains.map(d => [
    d.url,
    d.status,
    d.statusCode || '',
    d.latency || 0,
    d.lastChecked ? d.lastChecked.toISOString() : '',
    d.addedAt.toISOString()
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `domain_export_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};