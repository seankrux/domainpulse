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

export interface TechStackInfo {
  cms?: string;
  framework?: string;
  ecommerce?: string;
  analytics?: string[];
  javascriptLibraries?: string[];
  server?: string;
  adminUrl?: string;
  confidence: 'high' | 'medium' | 'low';
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
  techStack?: TechStackInfo;
  groupId?: string;
  tags: string[];
  formCheck?: { status: FormCheckStatus; lastRun?: Date; results: FormResult[] };
  callCheck?: { status: CallCheckStatus; lastRun?: Date; results: CallButtonResult[] };
  /** Google Business Profile (GMB) Place ID, set per-domain to enable GMB monitoring. */
  gmbPlaceId?: string;
  /** Latest Google Business Profile snapshot. */
  gmb?: GmbInfo;
}

// ---------------------------------------------------------------------------
// Google Business Profile (GMB) monitoring
// ---------------------------------------------------------------------------

export enum GmbStatus {
  /** Listing found and the business is operational. */
  Operational = 'OPERATIONAL',
  /** Listing found but temporarily/permanently closed. */
  Closed = 'CLOSED',
  /** No matching listing found. */
  NotFound = 'NOT_FOUND',
  /** Lookup failed (network / API / no key configured). */
  Error = 'ERROR',
  Unknown = 'UNKNOWN',
}

export interface GmbInfo {
  status: GmbStatus;
  placeId?: string;
  name?: string;
  /** Average star rating (0–5). */
  rating?: number;
  /** Total number of reviews. */
  reviewCount?: number;
  /** Raw Google business_status (OPERATIONAL | CLOSED_TEMPORARILY | CLOSED_PERMANENTLY). */
  businessStatus?: string;
  /** Whether the business is open at lookup time, when available. */
  openNow?: boolean;
  address?: string;
  phone?: string;
  website?: string;
  /** Google Maps URL for the listing. */
  mapsUrl?: string;
  lastChecked?: Date;
  error?: string;
}

// ---------------------------------------------------------------------------
// Form & Call-Button QA engine (see FORM_CALL_QA_PLAN.md Section 2)
// ---------------------------------------------------------------------------

export enum FormCheckStatus {
  Pass = 'PASS',
  Fail = 'FAIL',
  NoForms = 'NO_FORMS',
  Error = 'ERROR',
  Unknown = 'UNKNOWN'
}

export enum CallCheckStatus {
  Pass = 'PASS',
  Fail = 'FAIL',
  NoButtons = 'NO_BUTTONS',
  NotSwapped = 'NOT_SWAPPED',
  Error = 'ERROR',
  Unknown = 'UNKNOWN'
}

export interface FormResult {
  pageUrl: string;
  /** Best-effort identifier (id/name/selector). */
  formId?: string;
  fieldsFilled: number;
  submitted: boolean;
  /** Success message / thank-you detected on screen. */
  onScreenSuccess: boolean;
  /** Unique token injected into the message body. */
  marker: string;
  /** Optional destination verification. */
  delivery?: DeliveryResult;
  status: FormCheckStatus;
  notes?: string;
  /** Relative path (within the run folder) to the post-submit screenshot, if captured. */
  screenshot?: string;
}

export interface DeliveryResult {
  method: 'email' | 'webhook' | 'crm' | 'screen-only';
  delivered: boolean;
  detail?: string;
}

export interface CallButtonResult {
  pageUrl: string;
  selector: string;
  /** tel: value before CallRail swap. */
  hrefBefore?: string;
  /** tel: value after swap.js runs. */
  hrefAfter?: string;
  swapScriptPresent: boolean;
  /** hrefAfter differs from hrefBefore. */
  numberSwapped: boolean;
  status: CallCheckStatus;
  notes?: string;
}

/** Per-site QA configuration (extends CSV import + site record). */
export interface QaSiteConfig {
  url: string;
  qa?: {
    crawl?: { maxPages?: number; useSitemap?: boolean };
    form?: {
      enabled?: boolean;
      testData?: { name?: string; email?: string; phone?: string; message?: string };
      /** Marker prefix; run id + timestamp appended. */
      marker?: string;
      delivery?: {
        type: DeliveryResult['method'];
        /** Endpoint for webhook verifier. */
        endpoint?: string;
        /** Inbox identifier for email verifier (future). */
        inbox?: string;
        /** Substring to match for delivery confirmation. */
        match?: string;
      };
    };
    call?: { enabled?: boolean };
  };
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
  /** Trend direction for each KPI — computed from history mid-point split */
  trends?: {
    alive: 'up' | 'down' | 'stable';
    down: 'up' | 'down' | 'stable';
    latency: 'up' | 'down' | 'stable';
    uptime: 'up' | 'down' | 'stable';
  };
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

