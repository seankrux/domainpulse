import { Domain, DomainStatus } from '../types';
import { checkDomainWithSSL } from './domainService';

// Note: In a Web Worker, we don't have access to the same environment variables as the main thread
// so we'll pass the proxy URL in the configuration message.

let proxyUrl = 'http://localhost:3001';

self.onmessage = async (e: MessageEvent) => {
  const { type, domains, config } = e.data;

  if (type === 'CONFIG') {
    proxyUrl = config.proxyUrl || proxyUrl;
    return;
  }

  if (type === 'CHECK_BATCH') {
    const domainsToProcess = domains as Domain[];
    const chunkSize = 5;

    for (let i = 0; i < domainsToProcess.length; i += chunkSize) {
      const chunk = domainsToProcess.slice(i, i + chunkSize);
      
      await Promise.all(chunk.map(async (d) => {
        try {
          // Use the proxy URL from config
          (self as any).VITE_PROXY_URL = proxyUrl;
          
          const result = await checkDomainWithSSL(d.url);
          
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
