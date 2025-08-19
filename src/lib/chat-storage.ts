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

import { StreamingLog } from '../types';

// Chat session interface
export interface ChatSession {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date;
  duration: number; // in milliseconds
  logs: StreamingLog[];
  metadata: {
    model: string;
    messageCount: number;
    userMessageCount: number;
    modelMessageCount: number;
  };
}

// Serialized version for storage
interface SerializedChatSession {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  duration: number;
  logs: string; // JSON stringified logs
  metadata: {
    model: string;
    messageCount: number;
    userMessageCount: number;
    modelMessageCount: number;
  };
}

// Storage configuration
interface StorageConfig {
  maxSessions: number;
  maxStorageSize: number; // in bytes
  minSessionDuration: number; // in milliseconds
  storageKey: string;
}

// Storage result types
export interface StorageResult {
  success: boolean;
  error?: string;
  data?: any;
}

export interface StorageStats {
  totalSessions: number;
  totalSize: number;
  oldestSession?: Date;
  newestSession?: Date;
  availableSpace: number;
  isNearLimit: boolean;
  needsCleanup: boolean;
}

export interface StorageNotification {
  type: 'warning' | 'cleanup' | 'error';
  message: string;
  action?: string;
}

export type StorageNotificationCallback = (notification: StorageNotification) => void;

/**
 * ChatStorageService - Manages persistent storage of chat sessions in localStorage
 */
export class ChatStorageService {
  private config: StorageConfig = {
    maxSessions: 50,
    maxStorageSize: 5 * 1024 * 1024, // 5MB
    minSessionDuration: 1000, // 1 second
    storageKey: 'gemini_chat_sessions'
  };

  private notificationCallbacks: Set<StorageNotificationCallback> = new Set();
  private readonly STORAGE_WARNING_THRESHOLD = 0.8; // Warn at 80% capacity
  private readonly STORAGE_CLEANUP_THRESHOLD = 0.9; // Auto-cleanup at 90% capacity

  private readonly STORAGE_VERSION = '1.0';
  private readonly VERSION_KEY = 'gemini_chat_storage_version';

  constructor(config?: Partial<StorageConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
    this.initializeStorage();
  }

  /**
   * Subscribe to storage notifications
   */
  public onNotification(callback: StorageNotificationCallback): () => void {
    this.notificationCallbacks.add(callback);
    return () => this.notificationCallbacks.delete(callback);
  }

  /**
   * Emit notification to all subscribers
   */
  private emitNotification(notification: StorageNotification): void {
    this.notificationCallbacks.forEach(callback => {
      try {
        callback(notification);
      } catch (error) {
        console.error('Error in storage notification callback:', error);
      }
    });
  }

  /**
   * Initialize storage and handle version migrations
   */
  private initializeStorage(): void {
    try {
      const currentVersion = localStorage.getItem(this.VERSION_KEY);
      if (!currentVersion) {
        localStorage.setItem(this.VERSION_KEY, this.STORAGE_VERSION);
        localStorage.setItem(this.config.storageKey, JSON.stringify([]));
      }
    } catch (error) {
      console.error('Failed to initialize chat storage:', error);
    }
  }

  /**
   * Validate session data before storage
   */
  private validateSession(session: ChatSession): StorageResult {
    if (!session.id || typeof session.id !== 'string') {
      return { success: false, error: 'Invalid session ID' };
    }

    if (!session.startTime || !session.endTime) {
      return { success: false, error: 'Invalid session timestamps' };
    }

    if (session.duration < this.config.minSessionDuration) {
      return { success: false, error: `Session too short (minimum ${this.config.minSessionDuration}ms)` };
    }

    if (!Array.isArray(session.logs)) {
      return { success: false, error: 'Invalid logs array' };
    }

    return { success: true };
  }

  /**
   * Serialize session for storage
   */
  private serializeSession(session: ChatSession): SerializedChatSession {
    return {
      id: session.id,
      title: session.title,
      startTime: session.startTime.toISOString(),
      endTime: session.endTime.toISOString(),
      duration: session.duration,
      logs: JSON.stringify(session.logs),
      metadata: session.metadata
    };
  }

  /**
   * Deserialize session from storage
   */
  private deserializeSession(serialized: SerializedChatSession): ChatSession {
    return {
      id: serialized.id,
      title: serialized.title,
      startTime: new Date(serialized.startTime),
      endTime: new Date(serialized.endTime),
      duration: serialized.duration,
      logs: JSON.parse(serialized.logs),
      metadata: serialized.metadata
    };
  }

  /**
   * Calculate storage size in bytes
   */
  private calculateStorageSize(): number {
    try {
      const data = localStorage.getItem(this.config.storageKey);
      return data ? new Blob([data]).size : 0;
    } catch {
      return 0;
    }
  }

  /**
   * Get all stored sessions
   */
  private getStoredSessions(): SerializedChatSession[] {
    try {
      const data = localStorage.getItem(this.config.storageKey);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Failed to retrieve stored sessions:', error);
      return [];
    }
  }

  /**
   * Save sessions to storage
   */
  private saveStoredSessions(sessions: SerializedChatSession[]): StorageResult {
    try {
      const data = JSON.stringify(sessions);
      const size = new Blob([data]).size;
      
      if (size > this.config.maxStorageSize) {
        return { success: false, error: 'Storage size limit exceeded' };
      }

      localStorage.setItem(this.config.storageKey, data);
      return { success: true };
    } catch (error) {
      return { success: false, error: `Storage failed: ${error}` };
    }
  }

  /**
   * Enforce storage limits by cleaning up old sessions
   */
  private enforceStorageLimits(sessions: SerializedChatSession[]): SerializedChatSession[] {
    let cleanedSessions = [...sessions];
    
    // First, enforce maximum session count
    if (cleanedSessions.length > this.config.maxSessions) {
      const removedCount = cleanedSessions.length - this.config.maxSessions;
      cleanedSessions = cleanedSessions.slice(0, this.config.maxSessions);
      
      this.emitNotification({
        type: 'cleanup',
        message: `Removed ${removedCount} oldest sessions to stay within limit of ${this.config.maxSessions} sessions.`
      });
    }
    
    // Then, check storage size and remove oldest sessions if needed
    while (cleanedSessions.length > 0) {
      const testSize = this.calculateStorageSizeForSessions(cleanedSessions);
      
      if (testSize <= this.config.maxStorageSize * this.STORAGE_CLEANUP_THRESHOLD) {
        break;
      }
      
      // Remove oldest session
      const removedSession = cleanedSessions.pop();
      if (removedSession) {
        this.emitNotification({
          type: 'cleanup',
          message: `Removed session to free up storage space.`
        });
      }
    }
    
    return cleanedSessions;
  }

  /**
   * Calculate storage size for a specific set of sessions
   */
  private calculateStorageSizeForSessions(sessions: SerializedChatSession[]): number {
    try {
      return new Blob([JSON.stringify(sessions)]).size;
    } catch (error) {
      console.error('Error calculating storage size for sessions:', error);
      return 0;
    }
  }

  /**
   * Check storage warnings and emit notifications
   */
  private checkStorageWarnings(): void {
    const stats = this.getStorageStats();
    const percentage = (stats.totalSize / this.config.maxStorageSize) * 100;
    
    if (percentage >= this.STORAGE_CLEANUP_THRESHOLD * 100) {
      this.emitNotification({
        type: 'warning',
        message: `Storage is ${percentage.toFixed(1)}% full. Automatic cleanup may occur.`,
        action: 'Consider manually deleting old sessions'
      });
    } else if (percentage >= this.STORAGE_WARNING_THRESHOLD * 100) {
      this.emitNotification({
        type: 'warning',
        message: `Storage is ${percentage.toFixed(1)}% full. Consider cleaning up old sessions.`,
        action: 'Manage storage'
      });
    }
  }

  /**
   * Manual cleanup - remove sessions older than specified days
   */
  public cleanupOldSessions(daysOld: number = 30): StorageResult {
    try {
      const sessions = this.getStoredSessions();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);
      
      const filteredSessions = sessions.filter(session => 
        new Date(session.startTime).getTime() > cutoffDate.getTime()
      );
      
      const removedCount = sessions.length - filteredSessions.length;
      
      if (removedCount > 0) {
        const saveResult = this.saveStoredSessions(filteredSessions);
        if (saveResult.success) {
          this.emitNotification({
            type: 'cleanup',
            message: `Cleaned up ${removedCount} sessions older than ${daysOld} days.`
          });
          return { success: true, data: { removedCount } };
        }
        return saveResult;
      }
      
      return { success: true, data: { removedCount: 0 } };
    } catch (error) {
      this.emitNotification({
        type: 'error',
        message: 'Failed to cleanup old sessions. Please try again.'
      });
      return { success: false, error: `Cleanup failed: ${error}` };
    }
  }



  /**
   * Generate session title from logs
   */
  private generateSessionTitle(logs: StreamingLog[]): string {
    // Find first user message
    const userMessage = logs.find(log => 
      log.type.includes('client.send') && 
      typeof log.message === 'string' && 
      log.message.trim().length > 0
    );

    if (userMessage && typeof userMessage.message === 'string') {
      const text = userMessage.message.trim();
      return text.length > 50 ? text.substring(0, 47) + '...' : text;
    }

    // Fallback to timestamp
    const firstLog = logs[0];
    if (firstLog) {
      return `Chat ${firstLog.date.toLocaleDateString()} ${firstLog.date.toLocaleTimeString()}`;
    }

    return 'Untitled Chat';
  }

  /**
   * Calculate session metadata
   */
  private calculateMetadata(logs: StreamingLog[], model: string): ChatSession['metadata'] {
    let userMessageCount = 0;
    let modelMessageCount = 0;

    logs.forEach(log => {
      if (log.type.includes('client.send')) {
        userMessageCount++;
      } else if (log.type.includes('server.content')) {
        modelMessageCount++;
      }
    });

    return {
      model,
      messageCount: logs.length,
      userMessageCount,
      modelMessageCount
    };
  }

  /**
   * Save a chat session
   */
  public saveSession(logs: StreamingLog[], model: string, startTime: Date, endTime: Date): StorageResult {
    try {
      const duration = endTime.getTime() - startTime.getTime();
      
      const session: ChatSession = {
        id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        title: this.generateSessionTitle(logs),
        startTime,
        endTime,
        duration,
        logs,
        metadata: this.calculateMetadata(logs, model)
      };

      // Validate session
      const validation = this.validateSession(session);
      if (!validation.success) {
        return validation;
      }

      // Get existing sessions
      let sessions = this.getStoredSessions();
      
      // Add new session
      const serialized = this.serializeSession(session);
      sessions.push(serialized);

      // Enforce storage limits and cleanup if necessary
      sessions = this.enforceStorageLimits(sessions);

      // Save to storage
      const saveResult = this.saveStoredSessions(sessions);
      if (!saveResult.success) {
        this.emitNotification({
          type: 'error',
          message: 'Failed to save chat session. Please try again.'
        });
        return saveResult;
      }

      // Check for storage warnings
      this.checkStorageWarnings();

      return { success: true, data: session };
    } catch (error) {
      this.emitNotification({
        type: 'error',
        message: 'Failed to save chat session. Please try again.'
      });
      return { success: false, error: `Failed to save session: ${error}` };
    }
  }

  /**
   * Get all chat sessions
   */
  public getAllSessions(): StorageResult {
    try {
      const serialized = this.getStoredSessions();
      const sessions = serialized.map(s => this.deserializeSession(s));
      
      // Sort by start time (newest first)
      sessions.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
      
      return { success: true, data: sessions };
    } catch (error) {
      return { success: false, error: `Failed to retrieve sessions: ${error}` };
    }
  }

  /**
   * Get a specific session by ID
   */
  public getSession(id: string): StorageResult {
    try {
      const sessions = this.getStoredSessions();
      const serialized = sessions.find(s => s.id === id);
      
      if (!serialized) {
        return { success: false, error: 'Session not found' };
      }

      const session = this.deserializeSession(serialized);
      return { success: true, data: session };
    } catch (error) {
      return { success: false, error: `Failed to retrieve session: ${error}` };
    }
  }

  /**
   * Delete a session
   */
  public deleteSession(id: string): StorageResult {
    try {
      let sessions = this.getStoredSessions();
      const initialLength = sessions.length;
      
      sessions = sessions.filter(s => s.id !== id);
      
      if (sessions.length === initialLength) {
        return { success: false, error: 'Session not found' };
      }

      const saveResult = this.saveStoredSessions(sessions);
      return saveResult;
    } catch (error) {
      return { success: false, error: `Failed to delete session: ${error}` };
    }
  }

  /**
   * Delete multiple sessions
   */
  public deleteSessions(ids: string[]): StorageResult {
    try {
      let sessions = this.getStoredSessions();
      const initialLength = sessions.length;
      
      sessions = sessions.filter(s => !ids.includes(s.id));
      
      const deletedCount = initialLength - sessions.length;
      if (deletedCount === 0) {
        return { success: false, error: 'No sessions found to delete' };
      }

      const saveResult = this.saveStoredSessions(sessions);
      if (saveResult.success) {
        return { success: true, data: { deletedCount } };
      }
      return saveResult;
    } catch (error) {
      return { success: false, error: `Failed to delete sessions: ${error}` };
    }
  }

  /**
   * Clear all sessions
   */
  public clearAllSessions(): StorageResult {
    try {
      localStorage.setItem(this.config.storageKey, JSON.stringify([]));
      this.emitNotification({
        type: 'cleanup',
        message: 'All chat sessions have been cleared.'
      });
      return { success: true };
    } catch (error) {
      this.emitNotification({
        type: 'error',
        message: 'Failed to clear sessions. Please try again.'
      });
      return { success: false, error: `Failed to clear sessions: ${error}` };
    }
  }

  /**
   * Get storage statistics
   */
  public getStorageStats(): StorageStats {
    const sessions = this.getStoredSessions();
    const totalSize = this.calculateStorageSize();
    const percentage = (totalSize / this.config.maxStorageSize) * 100;
    
    let oldestSession: Date | undefined;
    let newestSession: Date | undefined;
    
    if (sessions.length > 0) {
      const dates = sessions.map(s => new Date(s.startTime));
      oldestSession = new Date(Math.min(...dates.map(d => d.getTime())));
      newestSession = new Date(Math.max(...dates.map(d => d.getTime())));
    }

    return {
      totalSessions: sessions.length,
      totalSize,
      oldestSession,
      newestSession,
      availableSpace: this.config.maxStorageSize - totalSize,
      isNearLimit: percentage >= this.STORAGE_WARNING_THRESHOLD * 100,
      needsCleanup: percentage >= this.STORAGE_CLEANUP_THRESHOLD * 100
    };
  }

  /**
   * Search sessions by title or content
   */
  public searchSessions(query: string): StorageResult {
    try {
      const allSessions = this.getAllSessions();
      if (!allSessions.success) {
        return allSessions;
      }

      const sessions = allSessions.data as ChatSession[];
      const lowerQuery = query.toLowerCase();
      
      const filtered = sessions.filter(session => {
        // Search in title
        if (session.title.toLowerCase().includes(lowerQuery)) {
          return true;
        }
        
        // Search in log messages
        return session.logs.some(log => {
          if (typeof log.message === 'string') {
            return log.message.toLowerCase().includes(lowerQuery);
          }
          return false;
        });
      });

      return { success: true, data: filtered };
    } catch (error) {
      return { success: false, error: `Search failed: ${error}` };
    }
  }

  /**
   * Export sessions as JSON
   */
  public exportSessions(): StorageResult {
    try {
      const result = this.getAllSessions();
      if (!result.success) {
        return result;
      }

      const exportData = {
        version: this.STORAGE_VERSION,
        exportDate: new Date().toISOString(),
        sessions: result.data
      };

      return { success: true, data: JSON.stringify(exportData, null, 2) };
    } catch (error) {
      return { success: false, error: `Export failed: ${error}` };
    }
  }

  /**
   * Check if storage is available
   */
  public isStorageAvailable(): boolean {
    try {
      const test = '__storage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  }
}

// Export singleton instance
export const chatStorage = new ChatStorageService();