import React from 'react';
import { ExternalLink } from 'lucide-react';
import { TechStackInfo } from '../types';

interface TechStackBadgeProps {
  techStack?: TechStackInfo;
  domain?: string;
  onClick?: () => void;
}

const CMS_ICONS: Record<string, string> = {
  'WordPress': '🖋️',
  'Shopify': '🛒',
  'Wix': '🌐',
  'Squarespace': '⬜',
  'Webflow': '🌊',
  'Drupal': '🐉',
  'Joomla': '!️⃣',
  'Magento': '🔮',
  'PrestaShop': '🏪',
  'Ghost': '👻',
  'TYPO3': '3️⃣',
  'Craft CMS': '🎨',
  'Strapi': '📊',
  'Contentful': '📦',
  'HubSpot': '🧡',
};

export const TechStackBadge: React.FC<TechStackBadgeProps> = ({ techStack, domain, onClick }) => {
  if (!techStack || (!techStack.cms && !techStack.ecommerce && !techStack.framework)) {
    return (
      <button 
        onClick={onClick}
        className="text-slate-300 dark:text-slate-700 text-[10px] font-bold uppercase tracking-widest hover:text-indigo-500 transition-colors"
        title="Click to detect technology stack"
      >
        -
      </button>
    );
  }

  const platform = techStack.ecommerce || techStack.cms;
  const icon = platform ? (CMS_ICONS[platform] || '🌐') : '💻';
  
  const getAdminUrl = () => {
    if (!domain || !techStack.adminUrl) return null;
    return `https://${domain}${techStack.adminUrl}`;
  };

  const adminUrl = getAdminUrl();

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={onClick}
        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-tight border shadow-sm transition-all hover:shadow-md hover:scale-105 bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 border-indigo-200 dark:border-indigo-700"
        title={platform ? `Click to open ${platform} admin` : 'View technology stack'}
      >
        <span className="text-xs">{icon}</span>
        <span className="truncate max-w-[80px]">{platform || techStack.framework}</span>
      </button>
      
      {adminUrl && (
        <a
          href={adminUrl}
          target="_blank"
          rel="noreferrer"
          className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"
          title={`Open ${platform} admin panel`}
        >
          <ExternalLink size={10} />
        </a>
      )}
    </div>
  );
};

export const getTechStackColor = (cms?: string): string => {
  const colors: Record<string, string> = {
    'WordPress': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    'Shopify': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    'Wix': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
    'Squarespace': 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-300',
    'Webflow': 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
    'Drupal': 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
    'Joomla': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
    'Magento': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    'Ghost': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  };

  return colors[cms || ''] || 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300';
};
