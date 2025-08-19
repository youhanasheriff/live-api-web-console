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

import { SessionAudioData } from './session-audio-recorder';

export interface StoredSessionAudio {
  sessionId: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  sampleRate: number;
  audioBlob: Blob;
  mimeType: string;
  size: number;
  createdAt: Date;
}

export interface AudioStorageResult {
  success: boolean;
  error?: string;
  data?: any;
}

export interface AudioStorageStats {
  totalSessions: number;
  totalSize: number;
  oldestSession?: Date;
  newestSession?: Date;
  availableSpace: number;
  isNearLimit: boolean;
}

/**
 * SessionAudioStorage - Manages persistent storage of session audio data using IndexedDB
 * Stores large audio blobs separately from chat session metadata
 */
export class SessionAudioStorage {
  private dbName = 'gemini_session_audio';
  private dbVersion = 1;
  private storeName = 'audio_sessions';
  private db: IDBDatabase | null = null;
  private maxStorageSize = 100 * 1024 * 1024; // 100MB limit
  private maxSessions = 20; // Limit number of audio sessions

  constructor() {
    this.initializeDB();
  }

  /**
   * Initialize IndexedDB
   */
  private async initializeDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        reject(new Error('IndexedDB not supported'));
        return;
      }

      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        reject(new Error('Failed to open IndexedDB'));
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'sessionId' });
          store.createIndex('startTime', 'startTime', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
        }
      };
    });
  }

  /**
   * Ensure database is ready
   */
  private async ensureDB(): Promise<IDBDatabase> {
    if (!this.db) {
      await this.initializeDB();
    }
    if (!this.db) {
      throw new Error('Database not available');
    }
    return this.db;
  }

  /**
   * Save session audio data
   */
  async saveSessionAudio(sessionAudioData: SessionAudioData): Promise<AudioStorageResult> {
    try {
      const db = await this.ensureDB();
      
      // Check storage limits before saving
      const stats = await this.getStorageStats();
      if (stats.isNearLimit) {
        // Clean up old sessions to make space
        await this.cleanupOldSessions();
      }

      const storedAudio: StoredSessionAudio = {
        sessionId: sessionAudioData.sessionId,
        startTime: sessionAudioData.startTime,
        endTime: sessionAudioData.endTime!,
        duration: sessionAudioData.duration,
        sampleRate: sessionAudioData.sampleRate,
        audioBlob: sessionAudioData.audioBlob,
        mimeType: sessionAudioData.audioBlob.type,
        size: sessionAudioData.audioBlob.size,
        createdAt: new Date()
      };

      return new Promise((resolve) => {
        const transaction = db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        const request = store.put(storedAudio);

        request.onsuccess = () => {
          console.log(`Session audio saved: ${sessionAudioData.sessionId}`);
          resolve({ success: true, data: storedAudio });
        };

        request.onerror = () => {
          console.error('Failed to save session audio:', request.error);
          resolve({ success: false, error: request.error?.message || 'Save failed' });
        };
      });
    } catch (error) {
      console.error('Error saving session audio:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Get session audio data
   */
  async getSessionAudio(sessionId: string): Promise<AudioStorageResult> {
    try {
      const db = await this.ensureDB();

      return new Promise((resolve) => {
        const transaction = db.transaction([this.storeName], 'readonly');
        const store = transaction.objectStore(this.storeName);
        const request = store.get(sessionId);

        request.onsuccess = () => {
          if (request.result) {
            resolve({ success: true, data: request.result });
          } else {
            resolve({ success: false, error: 'Session audio not found' });
          }
        };

        request.onerror = () => {
          resolve({ success: false, error: request.error?.message || 'Get failed' });
        };
      });
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Get all session audio metadata (without blobs for performance)
   */
  async getAllSessionAudioMetadata(): Promise<AudioStorageResult> {
    try {
      const db = await this.ensureDB();

      return new Promise((resolve) => {
        const transaction = db.transaction([this.storeName], 'readonly');
        const store = transaction.objectStore(this.storeName);
        const request = store.getAll();

        request.onsuccess = () => {
          const sessions = request.result.map(session => ({
            sessionId: session.sessionId,
            startTime: session.startTime,
            endTime: session.endTime,
            duration: session.duration,
            sampleRate: session.sampleRate,
            mimeType: session.mimeType,
            size: session.size,
            createdAt: session.createdAt
          }));
          resolve({ success: true, data: sessions });
        };

        request.onerror = () => {
          resolve({ success: false, error: request.error?.message || 'Get all failed' });
        };
      });
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Delete session audio
   */
  async deleteSessionAudio(sessionId: string): Promise<AudioStorageResult> {
    try {
      const db = await this.ensureDB();

      return new Promise((resolve) => {
        const transaction = db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        const request = store.delete(sessionId);

        request.onsuccess = () => {
          console.log(`Session audio deleted: ${sessionId}`);
          resolve({ success: true });
        };

        request.onerror = () => {
          resolve({ success: false, error: request.error?.message || 'Delete failed' });
        };
      });
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Delete multiple session audio files
   */
  async deleteMultipleSessionAudio(sessionIds: string[]): Promise<AudioStorageResult> {
    try {
      const db = await this.ensureDB();
      const results: boolean[] = [];

      for (const sessionId of sessionIds) {
        const result = await new Promise<boolean>((resolve) => {
          const transaction = db.transaction([this.storeName], 'readwrite');
          const store = transaction.objectStore(this.storeName);
          const request = store.delete(sessionId);

          request.onsuccess = () => resolve(true);
          request.onerror = () => resolve(false);
        });
        results.push(result);
      }

      const successCount = results.filter(r => r).length;
      console.log(`Deleted ${successCount}/${sessionIds.length} session audio files`);
      
      return { 
        success: successCount > 0, 
        data: { deleted: successCount, total: sessionIds.length }
      };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Clear all session audio data
   */
  async clearAllSessionAudio(): Promise<AudioStorageResult> {
    try {
      const db = await this.ensureDB();

      return new Promise((resolve) => {
        const transaction = db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        const request = store.clear();

        request.onsuccess = () => {
          console.log('All session audio data cleared');
          resolve({ success: true });
        };

        request.onerror = () => {
          resolve({ success: false, error: request.error?.message || 'Clear failed' });
        };
      });
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Get storage statistics
   */
  async getStorageStats(): Promise<AudioStorageStats> {
    try {
      const db = await this.ensureDB();

      return new Promise((resolve) => {
        const transaction = db.transaction([this.storeName], 'readonly');
        const store = transaction.objectStore(this.storeName);
        const request = store.getAll();

        request.onsuccess = () => {
          const sessions = request.result;
          const totalSize = sessions.reduce((sum, session) => sum + session.size, 0);
          const dates = sessions.map(s => s.createdAt).sort();

          const stats: AudioStorageStats = {
            totalSessions: sessions.length,
            totalSize,
            oldestSession: dates.length > 0 ? dates[0] : undefined,
            newestSession: dates.length > 0 ? dates[dates.length - 1] : undefined,
            availableSpace: Math.max(0, this.maxStorageSize - totalSize),
            isNearLimit: totalSize > (this.maxStorageSize * 0.8) || sessions.length >= this.maxSessions
          };

          resolve(stats);
        };

        request.onerror = () => {
          resolve({
            totalSessions: 0,
            totalSize: 0,
            availableSpace: this.maxStorageSize,
            isNearLimit: false
          });
        };
      });
    } catch (error) {
      return {
        totalSessions: 0,
        totalSize: 0,
        availableSpace: this.maxStorageSize,
        isNearLimit: false
      };
    }
  }

  /**
   * Clean up old sessions to free space
   */
  async cleanupOldSessions(keepCount: number = 10): Promise<AudioStorageResult> {
    try {
      const db = await this.ensureDB();

      return new Promise((resolve) => {
        const transaction = db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        const index = store.index('createdAt');
        const request = index.getAll();

        request.onsuccess = () => {
          const sessions = request.result.sort((a, b) => 
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );

          if (sessions.length <= keepCount) {
            resolve({ success: true, data: { deleted: 0, kept: sessions.length } });
            return;
          }

          const sessionsToDelete = sessions.slice(keepCount);
          let deletedCount = 0;

          sessionsToDelete.forEach(session => {
            const deleteRequest = store.delete(session.sessionId);
            deleteRequest.onsuccess = () => {
              deletedCount++;
              if (deletedCount === sessionsToDelete.length) {
                console.log(`Cleaned up ${deletedCount} old session audio files`);
                resolve({ 
                  success: true, 
                  data: { deleted: deletedCount, kept: keepCount }
                });
              }
            };
          });
        };

        request.onerror = () => {
          resolve({ success: false, error: request.error?.message || 'Cleanup failed' });
        };
      });
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Download session audio file
   */
  async downloadSessionAudio(sessionId: string, filename?: string): Promise<AudioStorageResult> {
    try {
      const result = await this.getSessionAudio(sessionId);
      if (!result.success || !result.data) {
        return { success: false, error: 'Session audio not found' };
      }

      const sessionAudio: StoredSessionAudio = result.data;
      const defaultFilename = `session_${sessionId}_${sessionAudio.startTime.toISOString().replace(/[:.]/g, '-')}.webm`;
      const finalFilename = filename || defaultFilename;

      const url = URL.createObjectURL(sessionAudio.audioBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = finalFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      console.log(`Session audio downloaded: ${finalFilename}`);
      return { success: true, data: { filename: finalFilename } };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Check if session has audio
   */
  async hasSessionAudio(sessionId: string): Promise<boolean> {
    try {
      const result = await this.getSessionAudio(sessionId);
      return result.success;
    } catch (error) {
      return false;
    }
  }
}

// Export singleton instance
export const sessionAudioStorage = new SessionAudioStorage();