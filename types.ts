export enum DomainStatus {
  Unknown = 'UNKNOWN',
  Checking = 'CHECKING',
  Alive = 'ALIVE',
  Down = 'DOWN',
  Error = 'ERROR'
}

export enum SSLStatus {
  Valid = 'VALID',
  Expiring = 'EXPIRING',
  Expired = 'EXPIRED',
  Invalid = 'INVALID',
  Unknown = 'UNKNOWN'
}

export interface SSLInfo {
  status: SSLStatus;
  issuer?: string;
  validFrom?: Date;
  validTo?: Date;
  daysUntilExpiry?: number;
}

export interface DomainExpiry {
  expiryDate?: Date;
  createdDate?: Date;
  updatedDate?: Date;
  registrar?: string;
  registrarUrl?: string;
  registrarIanaId?: string;
  domainStatus?: string[];
  nameServers?: string[];
  dnssec?: string;
  daysUntilExpiry?: number;
  status: 'active' | 'expiring' | 'expired' | 'unknown';
}

export interface StatusRecord {
  timestamp: Date;
  status: DomainStatus;
  statusCode: number;
  latency: number;
}

export interface DNSInfo {
  a?: string[];
  mx?: { exchange: string; priority: number }[];
  ns?: string[];
  txt?: string[][];
  cname?: string[];
  error?: string;
}

export interface Domain {
  id: string;
  url: string;
  status: DomainStatus;
  statusCode?: number;
  latency?: number;
  lastChecked?: Date;
  addedAt: Date;
  history: StatusRecord[];
  ssl?: SSLInfo;
  expiry?: DomainExpiry;
  dns?: DNSInfo;
  groupId?: string;
  tags: string[];
}

export interface DomainGroup {
  id: string;
  name: string;
  color: string;
}

export interface DomainStats {
  total: number;
  alive: number;
  down: number;
  unknown: number;
  avgLatency: number;
  uptime: number;
}

export type SortField = 'url' | 'status' | 'latency' | 'lastChecked' | 'ssl' | 'expiry';
export type SortOrder = 'asc' | 'desc';

export interface WebhookConfig {

  id: string;

  name: string;

  url: string;

  type: 'slack' | 'discord';

  enabled: boolean;

}



// Authentication types

export interface AuthState {

  isAuthenticated: boolean;

  isLoading: boolean;

  login: (password: string) => Promise<boolean>;

  logout: () => void;

}



// Service configuration for API calls (especially for workers)



export interface ServiceConfig {



  proxyUrl?: string;



  authToken?: string;



  userAgent?: string;



  timeout?: number;



}




