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
    console.warn('This browser does not support notifications');
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
      console.error('Error requesting notification permission:', error);
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
 * Send a browser notification.
 */
export const sendNotification = (options: NotificationOptions): void => {
  if (!canSendNotifications()) {
    console.warn('Cannot send notification: permission not granted');
    return;
  }

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

    // Auto-close after 5 seconds
    setTimeout(() => notification.close(), 5000);
  } catch (error) {
    console.error('Error sending notification:', error);
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
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
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
    console.warn('Could not play alert sound:', error);
  }
};
