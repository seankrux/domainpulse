import { logger } from '../utils/logger';
import { loadSettings } from '../utils/storage';

/**
 * Browser Notification Service
 * Handles permission requests and sending notifications for domain status changes.
 */

export interface NotificationOptions {
  title: string;
  body: string;
  icon?: string;
  onClick?: () => void;
}

/**
 * Request notification permission from the user.
 */
export const requestNotificationPermission = async (): Promise<boolean> => {
  if (!('Notification' in window)) {
    logger.warn('This browser does not support notifications');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    try {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    } catch (error) {
      logger.error('Error requesting notification permission:', error);
      return false;
    }
  }

  return false;
};

/**
 * Check if notifications are supported and permission is granted.
 */
export const canSendNotifications = (): boolean => {
  if (!('Notification' in window)) {
    return false;
  }
  return Notification.permission === 'granted';
};

/**
 * Send a browser notification and external webhooks.
 */
export const sendNotification = async (options: NotificationOptions): Promise<void> => {
  // 1. Browser Notification
  if (canSendNotifications()) {
    try {
      const notification = new Notification(options.title, {
        body: options.body,
        icon: options.icon || '/favicon.ico',
        badge: '/favicon.ico',
        requireInteraction: false,
        silent: false
      });

      notification.onclick = () => {
        window.focus();
        if (options.onClick) {
          options.onClick();
        }
        notification.close();
      };

      setTimeout(() => notification.close(), 5000);
    } catch (error) {
      logger.error('Error sending browser notification:', error);
    }
  }

  // 2. External Webhooks
  const settings = loadSettings();
  if (settings.webhooks && settings.webhooks.length > 0) {
    const enabledWebhooks = settings.webhooks.filter(w => w.enabled);

    for (const webhook of enabledWebhooks) {
      // Validate webhook URL
      if (!webhook.url || !webhook.url.startsWith('http://') && !webhook.url.startsWith('https://')) {
        logger.warn(`Invalid webhook URL for ${webhook.name}: ${webhook.url}`);
        continue;
      }

      try {
        // Validate URL format
        new URL(webhook.url);
      } catch {
        logger.warn(`Malformed webhook URL for ${webhook.name}`);
        continue;
      }

      try {
        let payload = {};

        if (webhook.type === 'slack') {
          payload = { text: `*${options.title}*\n${options.body}` };
        } else if (webhook.type === 'discord') {
          payload = {
            content: null,
            embeds: [{
              title: options.title,
              description: options.body,
              color: options.title.includes('Down') ? 15548997 : 5763719 // Red or Green
            }]
          };
        }

        const response = await fetch(webhook.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          throw new Error(`Webhook responded with ${response.status}`);
        }

        logger.debug(`Webhook sent to ${webhook.name}`);
      } catch (error) {
        logger.error(`Failed to send webhook to ${webhook.name}:`, error);
      }
    }
  }
};

/**
 * Send notification when a domain goes down.
 */
export const sendDomainDownNotification = (domainUrl: string, statusCode?: number): void => {
  sendNotification({
    title: '🔴 Domain Down',
    body: `${domainUrl} is ${statusCode ? `returning ${statusCode}` : 'unreachable'}`,
    icon: '/favicon.ico',
    onClick: () => {
      window.location.href = '/';
    }
  });
};

/**
 * Send notification when a domain comes back up.
 */
export const sendDomainUpNotification = (domainUrl: string, latency?: number): void => {
  sendNotification({
    title: '🟢 Domain Back Up',
    body: `${domainUrl} is back online${latency ? ` (${latency}ms)` : ''}`,
    icon: '/favicon.ico'
  });
};

/**
 * Play a sound alert.
 */
export const playAlertSound = (): void => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) {
      logger.warn('Web Audio API not supported');
      return;
    }

    const audioContext = new AudioContextClass();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
  } catch (error) {
    logger.warn('Could not play alert sound:', error);
  }
};
