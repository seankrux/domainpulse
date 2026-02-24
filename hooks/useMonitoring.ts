import { useState, useEffect, useCallback, useRef } from 'react';
import { Domain, DomainStatus, StatusRecord, ServiceConfig } from '../types';
import { checkDomainWithSSL } from '../services/domainService';
import { logger } from '../utils/logger';

interface MonitoringHookProps {
  domains: Domain[];
  setDomains: React.Dispatch<React.SetStateAction<Domain[]>>;
  maxHistoryRecords: number;
  customUserAgent?: string;
  checkTimeout?: number;
  showSuccess: (msg: string) => void;
  showError: (msg: string) => void;
  showInfo: (msg: string) => void;
}

export const useMonitoring = ({
  domains,
  setDomains,
  maxHistoryRecords,
  customUserAgent,
  checkTimeout,
  showSuccess
}: MonitoringHookProps) => {
  const [isCheckingAll, setIsCheckingAll] = useState(false);
  const [checkProgress, setCheckProgress] = useState({ current: 0, total: 0 });
  const workerRef = useRef<Worker | null>(null);
  const domainsRef = useRef(domains);

  useEffect(() => {
    domainsRef.current = domains;
  }, [domains]);

  const addHistoryRecord = useCallback((domainId: string, result: { status: DomainStatus; statusCode: number; latency: number }) => {
    const newRecord: StatusRecord = {
      timestamp: new Date(),
      status: result.status,
      statusCode: result.statusCode,
      latency: result.latency
    };

    setDomains(prev => prev.map(d => {
      if (d.id !== domainId) return d;
      
      const newHistory = [...d.history, newRecord];
      if (newHistory.length > maxHistoryRecords) {
        newHistory.shift();
      }
      
      return { ...d, history: newHistory };
    }));
  }, [maxHistoryRecords, setDomains]);

  const dispatchAuthInvalid = useCallback(() => {
    window.dispatchEvent(new CustomEvent('domainpulse:auth-invalid'));
  }, []);

  const checkBatch = useCallback(async (domainsToProcess: Domain[]) => {
    if (domainsToProcess.length === 0) return;
    
    const idsToCheck = new Set(domainsToProcess.map(d => d.id));
    setCheckProgress({ current: 0, total: domainsToProcess.length });
    
    // Set all domains to Checking state first
    setDomains(prev => prev.map(d => 
      idsToCheck.has(d.id) ? { ...d, status: DomainStatus.Checking } : d
    ));

    // Get auth token and proxy URL
    let authToken = '';
    const storedSession = localStorage.getItem('domainpulse_auth_session');
    if (storedSession) {
      try {
        const session = JSON.parse(storedSession) as { token?: string; expiresAt?: number };
        if (session?.token && session.expiresAt && session.expiresAt > Date.now()) {
          authToken = session.token;
        }
      } catch {
        localStorage.removeItem('domainpulse_auth_session');
      }
    }
    const proxyUrl = import.meta.env.VITE_PROXY_URL || 'http://localhost:3001';

    const serviceConfig = {
      proxyUrl,
      authToken,
      userAgent: customUserAgent,
      timeout: checkTimeout
    };

    const processDomainResult = async (domain: Domain) => {
      try {
        const result = await checkDomainWithSSL(domain.url, serviceConfig);
        setDomains(prev => prev.map(d =>
          d.id === domain.id ? {
            ...d,
            status: result.status,
            statusCode: result.statusCode,
            latency: result.latency,
            ssl: result.ssl,
            expiry: result.expiry,
            dns: result.dns,
            lastChecked: new Date()
          } : d
        ));
        setCheckProgress(prev => ({ ...prev, current: prev.current + 1 }));
      } catch (error) {
        if (error instanceof Error && error.message === 'Unauthorized') {
          dispatchAuthInvalid();
          logger.warn(`Authentication failed for domain: ${domain.url}`);
        } else {
          logger.error(`Failed to check domain: ${domain.url}`, error);
        }

        setDomains(prev => prev.map(d =>
          d.id === domain.id ? { ...d, status: DomainStatus.Error, lastChecked: new Date() } : d
        ));
        setCheckProgress(prev => ({ ...prev, current: prev.current + 1 }));
      }
    };

    if (!workerRef.current) {
      setIsCheckingAll(true);
      try {
        for (const domain of domainsToProcess) {
          await processDomainResult(domain);
        }
      } finally {
        setIsCheckingAll(false);
        setCheckProgress({ current: 0, total: 0 });
      }
      return;
    }

    // Send to worker
    workerRef.current.postMessage({
      type: 'CHECK_BATCH',
      domains: domainsToProcess,
      config: serviceConfig
    });
  }, [setDomains, customUserAgent, checkTimeout, dispatchAuthInvalid, maxHistoryRecords, setCheckProgress]);

  const checkAllDomains = useCallback(async (silent = false) => {
    if (isCheckingAll) return;
    if (!silent) setIsCheckingAll(true);
    const domainsToCheck = domainsRef.current.filter(d => d.status !== DomainStatus.Checking);
    await checkBatch(domainsToCheck);
  }, [isCheckingAll, checkBatch]);

  const checkSingleDomain = useCallback(async (id: string, url: string) => {
    setDomains(prev => prev.map(d => d.id === id ? { ...d, status: DomainStatus.Checking } : d));

    try {
      const serviceConfig: ServiceConfig = {
        userAgent: customUserAgent,
        timeout: checkTimeout
      };
      const result = await checkDomainWithSSL(url, serviceConfig);
      setDomains(prev => prev.map(d =>
        d.id === id ? {
          ...d,
          status: result.status,
          statusCode: result.statusCode,
          latency: result.latency,
          ssl: result.ssl,
          expiry: result.expiry,
          dns: result.dns,
          lastChecked: new Date()
        } : d
      ));
      addHistoryRecord(id, result);
    } catch (error) {
      if (error instanceof Error && error.message === 'Unauthorized') {
        dispatchAuthInvalid();
        logger.warn(`Authentication failed for domain: ${url}`);
      } else {
        logger.error(`Failed to check single domain: ${url}`, error);
      }
      setDomains(prev => prev.map(d =>
        d.id === id ? { ...d, status: DomainStatus.Error, lastChecked: new Date() } : d
      ));
    }
  }, [addHistoryRecord, setDomains, customUserAgent, checkTimeout, dispatchAuthInvalid]);

  // Initialize Worker
  useEffect(() => {
    const MonitoringWorker = new Worker(new URL('../services/monitoring.worker.ts', import.meta.url), {
      type: 'module'
    });
    
    MonitoringWorker.onmessage = (e) => {
      if (!e?.data || typeof e.data !== 'object' || typeof e.data.type !== 'string') {
        return;
      }
      const { type, domainId, result } = e.data;
      
      if (type === 'DOMAIN_RESULT') {
        setDomains(prev => 
          prev.map(d =>
            d.id === domainId ? {
              ...d,
              status: result.status,
              statusCode: result.statusCode,
              latency: result.latency,
              ssl: result.ssl,
              expiry: result.expiry,
              dns: result.dns,
              lastChecked: new Date()
            } : d
          )
        );
        addHistoryRecord(domainId, result);
        setCheckProgress(prev => ({ ...prev, current: prev.current + 1 }));
      } else if (type === 'DOMAIN_ERROR') {
        if (e.data.error === 'Unauthorized') {
          dispatchAuthInvalid();
          logger.warn(`Worker: Authentication failed for domain ID: ${domainId}`);
        } else {
          logger.error(`Worker: Failed to check domain ID: ${domainId}`, e.data.error);
        }
        setDomains(prev =>
          prev.map(d =>
            d.id === domainId ? { ...d, status: DomainStatus.Error, lastChecked: new Date() } : d
          )
        );
        setCheckProgress(prev => ({ ...prev, current: prev.current + 1 }));
      } else if (type === 'BATCH_COMPLETE') {
        setIsCheckingAll(false);
        setCheckProgress({ current: 0, total: 0 });
        showSuccess('Domain check complete');
      }
    };

    // Configure worker with proxy URL and initial auth token
    MonitoringWorker.postMessage({
      type: 'CONFIG',
      config: {
        proxyUrl: import.meta.env.VITE_PROXY_URL || 'http://localhost:3001',
        authToken: (() => {
          try {
            const storedSession = localStorage.getItem('domainpulse_auth_session');
            if (!storedSession) return '';
            const parsed = JSON.parse(storedSession) as { token?: string; expiresAt?: number };
            if (!parsed?.token || !parsed.expiresAt || parsed.expiresAt <= Date.now()) return '';
            return parsed.token;
          } catch {
            return '';
          }
        })(),
        userAgent: customUserAgent,
        timeout: checkTimeout
      }
    });

    workerRef.current = MonitoringWorker;

    return () => {
      MonitoringWorker.terminate();
    };
  }, [addHistoryRecord, showSuccess, setDomains, customUserAgent, checkTimeout]);

  return {
    isCheckingAll,
    checkProgress,
    checkBatch,
    checkAllDomains,
    checkSingleDomain
  };
};
