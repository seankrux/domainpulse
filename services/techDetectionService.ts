import { ServiceConfig } from '../types';
import { logger } from '../utils/logger';

export interface TechStack {
  cms?: string;
  framework?: string;
  ecommerce?: string;
  analytics?: string[];
  javascriptLibraries?: string[];
  server?: string;
  hosting?: string;
  adminUrl?: string;
  confidence: 'high' | 'medium' | 'low';
}

interface TechDetection {
  patterns: {
    cms?: Array<{ name: string; pattern: RegExp; adminUrl?: string }>;
    framework?: Array<{ name: string; pattern: RegExp }>;
    ecommerce?: Array<{ name: string; pattern: RegExp; adminUrl?: string }>;
    analytics?: Array<{ name: string; pattern: RegExp }>;
    javascriptLibraries?: Array<{ name: string; pattern: RegExp }>;
    server?: Array<{ name: string; pattern: RegExp }>;
  };
}

/**
 * Technology detection patterns (Wappalyzer-like)
 */
const TECH_PATTERNS: TechDetection = {
  patterns: {
    cms: [
      { name: 'WordPress', pattern: /wp-content|wp-includes|wordpress/i, adminUrl: '/wp-admin' },
      { name: 'Shopify', pattern: /shopify|cdn\.shopify\.com/i, adminUrl: '/admin' },
      { name: 'Wix', pattern: /wix\.com|wixstatic\.com/i, adminUrl: '/my-account' },
      { name: 'Squarespace', pattern: /squarespace\.com|squarespace-mail\.com/i, adminUrl: '/config' },
      { name: 'Webflow', pattern: /webflow\.io|webflow\.com/i, adminUrl: '/dashboard' },
      { name: 'Drupal', pattern: /drupal|sites\/default\/files/i, adminUrl: '/user/login' },
      { name: 'Joomla', pattern: /joomla|media\/joomla/i, adminUrl: '/administrator' },
      { name: 'Magento', pattern: /magento|static\/version/i, adminUrl: '/admin' },
      { name: 'PrestaShop', pattern: /prestashop/i, adminUrl: '/admin' },
      { name: 'Ghost', pattern: /ghost\.io|content\/ghost/i, adminUrl: '/ghost' },
      { name: 'TYPO3', pattern: /typo3|typo3conf/i, adminUrl: '/typo3' },
      { name: 'Craft CMS', pattern: /craftcms|craft-cms/i, adminUrl: '/admin' },
      { name: 'Strapi', pattern: /strapi/i, adminUrl: '/admin' },
      { name: 'Contentful', pattern: /contentful\.com|ctfassets\.net/i },
      { name: 'HubSpot', pattern: /hubspot\.com|hs-scripts/i },
    ],
    framework: [
      { name: 'React', pattern: /react|react-dom/i },
      { name: 'Vue.js', pattern: /vue\.js|vuejs/i },
      { name: 'Angular', pattern: /angular|ng-version/i },
      { name: 'Next.js', pattern: /next\.js|_next/i },
      { name: 'Nuxt.js', pattern: /nuxt\.js|_nuxt/i },
      { name: 'Svelte', pattern: /svelte/i },
      { name: 'jQuery', pattern: /jquery/i },
      { name: 'Bootstrap', pattern: /bootstrap/i },
      { name: 'Tailwind CSS', pattern: /tailwind/i },
    ],
    ecommerce: [
      { name: 'WooCommerce', pattern: /woocommerce/i, adminUrl: '/wp-admin' },
      { name: 'Shopify', pattern: /shopify/i, adminUrl: '/admin' },
      { name: 'Magento', pattern: /magento/i, adminUrl: '/admin' },
      { name: 'PrestaShop', pattern: /prestashop/i, adminUrl: '/admin' },
      { name: 'BigCommerce', pattern: /bigcommerce/i, adminUrl: '/admin' },
      { name: 'OpenCart', pattern: /opencart/i, adminUrl: '/admin' },
    ],
    analytics: [
      { name: 'Google Analytics', pattern: /google-analytics|gtag\.js|ga\.js/i },
      { name: 'Google Tag Manager', pattern: /googletagmanager\.com|gtm\.js/i },
      { name: 'Facebook Pixel', pattern: /facebook\.com\/tr|fbq\(\)/i },
      { name: 'Hotjar', pattern: /hotjar\.com/i },
      { name: 'Mixpanel', pattern: /mixpanel\.com/i },
      { name: 'Segment', pattern: /segment\.com/i },
    ],
    javascriptLibraries: [
      { name: 'jQuery', pattern: /jquery/i },
      { name: 'Lodash', pattern: /lodash/i },
      { name: 'Moment.js', pattern: /moment/i },
      { name: 'D3.js', pattern: /d3\.js/i },
      { name: 'Chart.js', pattern: /chart\.js/i },
    ],
    server: [
      { name: 'Nginx', pattern: /nginx/i },
      { name: 'Apache', pattern: /apache/i },
      { name: 'IIS', pattern: /iis/i },
      { name: 'Cloudflare', pattern: /cloudflare/i },
      { name: 'Varnish', pattern: /varnish/i },
    ],
  },
};

/**
 * Detect technology stack from HTML content and headers.
 */
export const detectTechStack = async (url: string, config?: ServiceConfig): Promise<TechStack> => {
  const cleanDomain = url.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  const targetUrl = url.startsWith('http') ? url : `https://${url}`;

  const proxyUrl = config?.proxyUrl || (typeof import.meta !== 'undefined' && import.meta.env?.VITE_PROXY_URL) || 'http://localhost:3001';
  let token = config?.authToken;

  if (!token && typeof localStorage !== 'undefined') {
    const storedSession = localStorage.getItem('domainpulse_auth_session');
    if (storedSession) {
      try {
        const parsed = JSON.parse(storedSession) as { token?: string; expiresAt?: number };
        if (parsed?.token && parsed.expiresAt && parsed.expiresAt > Date.now()) {
          token = parsed.token;
        }
      } catch {
        // Ignore parse errors
      }
    }
  }

  try {
    const endpoints = [
      `/api/tech-detect?url=${encodeURIComponent(targetUrl)}`,
      `${proxyUrl}/api/tech-detect?url=${encodeURIComponent(targetUrl)}`
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Authorization': token ? `Bearer ${token}` : ''
          }
        });

        if (response.status === 401) {
          throw new Error('Unauthorized');
        }

        if (response.ok) {
          return await response.json();
        }
      } catch (e) {
        if (e instanceof Error && e.message === 'Unauthorized') {
          throw e;
        }
        continue;
      }
    }
  } catch (error) {
    logger.warn(`Tech detection API unavailable for ${cleanDomain}:`, error);
  }

  // Fallback: Return unknown status
  return {
    confidence: 'low'
  };
};

/**
 * Parse HTML content and detect technologies.
 */
export const parseTechFromHTML = (html: string, headers: Record<string, string> = {}): TechStack => {
  const result: TechStack = {
    confidence: 'low'
  };

  let matchCount = 0;

  // Detect CMS
  for (const cms of TECH_PATTERNS.patterns.cms || []) {
    if (cms.pattern.test(html) || cms.pattern.test(headers['x-powered-by'] || '')) {
      result.cms = cms.name;
      if (cms.adminUrl) {
        result.adminUrl = cms.adminUrl;
      }
      matchCount++;
      break;
    }
  }

  // Detect Framework
  const frameworks: string[] = [];
  for (const fw of TECH_PATTERNS.patterns.framework || []) {
    if (fw.pattern.test(html)) {
      frameworks.push(fw.name);
      matchCount++;
    }
  }
  if (frameworks.length > 0) {
    result.framework = frameworks.join(', ');
  }

  // Detect Ecommerce
  for (const ec of TECH_PATTERNS.patterns.ecommerce || []) {
    if (ec.pattern.test(html)) {
      result.ecommerce = ec.name;
      if (ec.adminUrl && !result.adminUrl) {
        result.adminUrl = ec.adminUrl;
      }
      matchCount++;
      break;
    }
  }

  // Detect Analytics
  const analytics: string[] = [];
  for (const a of TECH_PATTERNS.patterns.analytics || []) {
    if (a.pattern.test(html)) {
      analytics.push(a.name);
      matchCount++;
    }
  }
  if (analytics.length > 0) {
    result.analytics = analytics;
  }

  // Detect JavaScript Libraries
  const jsLibs: string[] = [];
  for (const lib of TECH_PATTERNS.patterns.javascriptLibraries || []) {
    if (lib.pattern.test(html)) {
      jsLibs.push(lib.name);
      matchCount++;
    }
  }
  if (jsLibs.length > 0) {
    result.javascriptLibraries = jsLibs;
  }

  // Detect Server
  for (const srv of TECH_PATTERNS.patterns.server || []) {
    if (srv.pattern.test(headers['server'] || '')) {
      result.server = srv.name;
      matchCount++;
      break;
    }
  }

  // Set confidence level
  if (matchCount >= 5) {
    result.confidence = 'high';
  } else if (matchCount >= 2) {
    result.confidence = 'medium';
  }

  return result;
};

/**
 * Get admin URL for detected CMS/Platform.
 */
export const getAdminUrl = (domain: string, techStack?: TechStack): string | null => {
  if (!techStack?.adminUrl && !techStack?.cms) {
    return null;
  }

  const adminPaths: Record<string, string> = {
    'WordPress': '/wp-admin',
    'Shopify': '/admin',
    'WooCommerce': '/wp-admin',
    'Magento': '/admin',
    'PrestaShop': '/admin',
    'BigCommerce': '/admin',
    'OpenCart': '/admin',
    'Drupal': '/user/login',
    'Joomla': '/administrator',
    'Ghost': '/ghost',
    'TYPO3': '/typo3',
    'Craft CMS': '/admin',
    'Strapi': '/admin',
    'Webflow': '/dashboard',
    'Squarespace': '/config',
    'Wix': '/my-account',
  };

  const adminPath = techStack.adminUrl || (techStack.cms ? adminPaths[techStack.cms] : null);
  
  if (!adminPath) {
    return null;
  }

  return `https://${domain}${adminPath}`;
};

/**
 * Get CMS icon/logo URL.
 */
export const getCMSIcon = (cms?: string): string => {
  const icons: Record<string, string> = {
    'WordPress': 'https://www.w.org/style/images/about/WordPress-logotype-wmark.png',
    'Shopify': 'https://cdn.shopify.com/shopifycloud/brochure/assets/brand-assets/shopify-logo-primary.png',
    'Wix': 'https://www.wix.com/favicon.ico',
    'Squarespace': 'https://static1.squarespace.com/static/brand/favicon.ico',
    'Webflow': 'https://assets-global.website-files.com/5e2755779d8b8ea1d6373797/5f0d0c527c90680f74f0a456_Webflow-favicon.png',
    'Drupal': 'https://www.drupal.org/files/Drupal-logotype-blue.png',
    'Joomla': 'https://www.joomla.org/images/joomla-logo.svg',
    'Magento': 'https://magento.com/themes/magento/favicon.ico',
    'PrestaShop': 'https://www.prestashop.com/themes/prestashop/favicon.ico',
    'Ghost': 'https://ghost.org/images/logos/ghost-logo.png',
  };

  return icons[cms || ''] || '';
};
