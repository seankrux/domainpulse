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
        className="text-zinc-700 text-[10px] font-bold uppercase tracking-widest hover:text-emerald-400 transition-colors"
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
        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-tight border shadow-sm transition-all hover:shadow-md hover:scale-105 bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
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
          className="p-1 text-zinc-500 hover:text-emerald-400 transition-colors"
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
    'WordPress': 'bg-blue-500/10 text-blue-400',
    'Shopify': 'bg-green-500/10 text-green-400',
    'Wix': 'bg-purple-500/10 text-purple-400',
    'Squarespace': 'bg-zinc-800 text-zinc-300',
    'Webflow': 'bg-cyan-500/10 text-cyan-400',
    'Drupal': 'bg-violet-500/10 text-violet-400',
    'Joomla': 'bg-orange-500/10 text-orange-400',
    'Magento': 'bg-red-500/10 text-red-400',
    'Ghost': 'bg-amber-500/10 text-amber-400',
  };

  return colors[cms || ''] || 'bg-emerald-500/10 text-emerald-400';
};
