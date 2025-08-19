/**
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { StorageNotification, chatStorage } from '../../lib/chat-storage';
import './storage-notifications.scss';

interface NotificationItem extends StorageNotification {
  id: string;
  timestamp: Date;
}

interface StorageNotificationsProps {
  maxNotifications?: number;
  autoHideDelay?: number;
}

export function StorageNotifications({ 
  maxNotifications = 3, 
  autoHideDelay = 5000 
}: StorageNotificationsProps) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  useEffect(() => {
    // Subscribe to storage notifications
    const unsubscribe = chatStorage.onNotification((notification) => {
      const notificationItem: NotificationItem = {
        ...notification,
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date()
      };

      setNotifications(prev => {
        const updated = [notificationItem, ...prev];
        // Keep only the most recent notifications
        return updated.slice(0, maxNotifications);
      });

      // Auto-hide non-error notifications
      if (notification.type !== 'error' && autoHideDelay > 0) {
        setTimeout(() => {
          setNotifications(prev => 
            prev.filter(n => n.id !== notificationItem.id)
          );
        }, autoHideDelay);
      }
    });

    return unsubscribe;
  }, [maxNotifications, autoHideDelay]);

  const dismissNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const getNotificationIcon = (type: StorageNotification['type']): string => {
    switch (type) {
      case 'warning':
        return '⚠️';
      case 'cleanup':
        return '🧹';
      case 'error':
        return '❌';
      default:
        return 'ℹ️';
    }
  };

  const getNotificationClass = (type: StorageNotification['type']): string => {
    return `storage-notification storage-notification--${type}`;
  };

  if (notifications.length === 0) {
    return null;
  }

  return createPortal(
    <div className="storage-notifications-container">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={getNotificationClass(notification.type)}
          role="alert"
          aria-live="polite"
        >
          <div className="notification-content">
            <div className="notification-header">
              <span className="notification-icon">
                {getNotificationIcon(notification.type)}
              </span>
              <span className="notification-title">
                {notification.type === 'warning' && 'Storage Warning'}
                {notification.type === 'cleanup' && 'Storage Cleanup'}
                {notification.type === 'error' && 'Storage Error'}
              </span>
              <button
                className="notification-dismiss"
                onClick={() => dismissNotification(notification.id)}
                aria-label="Dismiss notification"
                title="Dismiss"
              >
                ×
              </button>
            </div>
            <div className="notification-message">
              {notification.message}
            </div>
            {notification.action && (
              <div className="notification-action">
                <span className="action-text">{notification.action}</span>
              </div>
            )}
            <div className="notification-timestamp">
              {notification.timestamp.toLocaleTimeString()}
            </div>
          </div>
          <div className="notification-progress" />
        </div>
      ))}
    </div>,
    document.body
  );
}

export default StorageNotifications;