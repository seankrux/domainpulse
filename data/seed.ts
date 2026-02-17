import { Domain, DomainStatus, DomainGroup, SSLStatus } from '../types';

/**
 * Sample domains for first-time users
 */
export const SAMPLE_DOMAINS: Domain[] = [
  {
    id: 'sample-1',
    url: 'google.com',
    status: DomainStatus.Alive,
    statusCode: 200,
    latency: 45,
    lastChecked: new Date(),
    addedAt: new Date(),
    history: [],
    ssl: {
      status: SSLStatus.Valid,
      issuer: 'Google Trust Services',
      validFrom: new Date('2025-01-15'),
      validTo: new Date('2026-04-15'),
      daysUntilExpiry: 365
    },
    expiry: {
      status: 'active',
      expiryDate: new Date('2027-09-14'),
      registrar: 'MarkMonitor Inc.',
      daysUntilExpiry: 580
    },
    groupId: undefined,
    tags: ['search', 'tech']
  },
  {
    id: 'sample-2',
    url: 'github.com',
    status: DomainStatus.Alive,
    statusCode: 200,
    latency: 120,
    lastChecked: new Date(),
    addedAt: new Date(),
    history: [],
    ssl: {
      status: SSLStatus.Valid,
      issuer: 'DigiCert Inc',
      validFrom: new Date('2025-02-14'),
      validTo: new Date('2026-03-14'),
      daysUntilExpiry: 320
    },
    expiry: {
      status: 'active',
      expiryDate: new Date('2027-11-08'),
      registrar: 'NameCheap, Inc.',
      daysUntilExpiry: 630
    },
    groupId: undefined,
    tags: ['dev', 'git']
  },
  {
    id: 'sample-3',
    url: 'example.com',
    status: DomainStatus.Alive,
    statusCode: 200,
    latency: 85,
    lastChecked: new Date(),
    addedAt: new Date(),
    history: [],
    ssl: {
      status: SSLStatus.Valid,
      issuer: 'DigiCert Inc',
      validFrom: new Date('2025-01-10'),
      validTo: new Date('2026-02-10'),
      daysUntilExpiry: 290
    },
    expiry: {
      status: 'active',
      expiryDate: new Date('2027-08-14'),
      registrar: 'ICANN',
      daysUntilExpiry: 545
    },
    groupId: undefined,
    tags: ['demo']
  }
];

/**
 * Sample groups for first-time users
 */
export const SAMPLE_GROUPS: DomainGroup[] = [
  {
    id: 'group-1',
    name: 'Production',
    color: '#22c55e' // green
  },
  {
    id: 'group-2',
    name: 'Personal',
    color: '#3b82f6' // blue
  },
  {
    id: 'group-3',
    name: 'Testing',
    color: '#f59e0b' // amber
  }
];

/**
 * Generate sample history data for a domain
 */
export const generateSampleHistory = (days: number = 30): { status: DomainStatus; latency: number; timestamp: Date }[] => {
  const history: { status: DomainStatus; latency: number; timestamp: Date }[] = [];
  const now = new Date();
  
  for (let i = days; i >= 0; i--) {
    const timestamp = new Date(now);
    timestamp.setDate(timestamp.getDate() - i);
    
    // 95% uptime simulation
    const isDown = Math.random() < 0.05;
    const baseLatency = 50 + Math.random() * 150;
    
    history.push({
      status: isDown ? DomainStatus.Down : DomainStatus.Alive,
      latency: isDown ? 0 : Math.round(baseLatency),
      timestamp
    });
  }
  
  return history;
};
