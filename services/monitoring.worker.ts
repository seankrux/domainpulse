import { Domain, ServiceConfig } from '../types';
import { checkDomainWithSSL } from './domainService';

// Note: In a Web Worker, we don't have access to the same environment variables as the main thread
// so we'll pass the proxy URL and auth token in the configuration message.

let proxyUrl = 'http://localhost:3001';
let authToken = '';
let userAgent = 'DomainPulse/1.0 (Domain Monitor)';
let timeout = 15000;

self.onmessage = async (e: MessageEvent) => {
  const { type, domains, config } = e.data;

  if (type === 'CONFIG') {
    proxyUrl = config.proxyUrl || proxyUrl;
    authToken = config.authToken || authToken;
    userAgent = config.userAgent || userAgent;
    timeout = config.timeout || timeout;
    return;
  }

  if (type === 'CHECK_BATCH') {
    const domainsToProcess = domains as Domain[];
    const currentAuthToken = config?.authToken || authToken;
    const currentProxyUrl = config?.proxyUrl || proxyUrl;
    const currentUserAgent = config?.userAgent || userAgent;
    const currentTimeout = config?.timeout || timeout;
    
    const serviceConfig: ServiceConfig = {
      proxyUrl: currentProxyUrl,
      authToken: currentAuthToken,
      userAgent: currentUserAgent,
      timeout: currentTimeout
    };

    const chunkSize = 5;

    for (let i = 0; i < domainsToProcess.length; i += chunkSize) {
      const chunk = domainsToProcess.slice(i, i + chunkSize);
      
      await Promise.all(chunk.map(async (d) => {
        try {
          const result = await checkDomainWithSSL(d.url, serviceConfig);
          
          self.postMessage({
            type: 'DOMAIN_RESULT',
            domainId: d.id,
            result
          });
        } catch (error) {
          self.postMessage({
            type: 'DOMAIN_ERROR',
            domainId: d.id,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }));
    }

    self.postMessage({ type: 'BATCH_COMPLETE' });
  }
};
