/**
 * Chat History Storage Service
 * Handles persistence and management of chat sessions using localStorage
 */

import {
  ChatSession,
  ChatMessage,
  ChatHistoryStorage,
} from '../types/chat-history';

const STORAGE_KEY = 'live-api-chat-history';
const DEFAULT_SETTINGS = {
  maxSessions: 50,
  autoTranscribe: false,
  retentionDays: 30,
  audioQuality: 'medium' as const,
};

export class ChatHistoryStorageService {
  private storage: ChatHistoryStorage;

  constructor() {
    this.storage = this.loadFromStorage();
    this.cleanupOldSessions();
  }

  private loadFromStorage(): ChatHistoryStorage {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Convert date strings back to Date objects
        parsed.sessions = parsed.sessions.map((session: any) => ({
          ...session,
          startTime: new Date(session.startTime),
          endTime: session.endTime ? new Date(session.endTime) : undefined,
          messages: session.messages.map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp),
          })),
          transcription: session.transcription
            ? {
                ...session.transcription,
                processedAt: new Date(session.transcription.processedAt),
              }
            : undefined,
        }));
        return {
          ...parsed,
          settings: { ...DEFAULT_SETTINGS, ...parsed.settings },
        };
      }
    } catch (error) {
      console.error('Failed to load chat history from storage:', error);
    }

    return {
      sessions: [],
      settings: DEFAULT_SETTINGS,
    };
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.storage));
    } catch (error) {
      console.error('Failed to save chat history to storage:', error);
      // Handle storage quota exceeded
      if (error instanceof DOMException && error.code === 22) {
        this.cleanupOldSessions(true);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(this.storage));
        } catch (retryError) {
          console.error('Failed to save even after cleanup:', retryError);
        }
      }
    }
  }

  private cleanupOldSessions(force = false): void {
    const now = new Date();
    const retentionMs =
      this.storage.settings.retentionDays * 24 * 60 * 60 * 1000;

    const initialCount = this.storage.sessions.length;

    // Remove sessions older than retention period
    this.storage.sessions = this.storage.sessions.filter(session => {
      const age = now.getTime() - session.startTime.getTime();
      return age < retentionMs;
    });

    // If forced cleanup or too many sessions, remove oldest
    if (
      force ||
      this.storage.sessions.length > this.storage.settings.maxSessions
    ) {
      this.storage.sessions.sort(
        (a, b) => b.startTime.getTime() - a.startTime.getTime()
      );
      this.storage.sessions = this.storage.sessions.slice(
        0,
        this.storage.settings.maxSessions
      );
    }

    if (this.storage.sessions.length < initialCount) {
      console.log(
        `Cleaned up ${
          initialCount - this.storage.sessions.length
        } old chat sessions`
      );
      this.saveToStorage();
    }
  }

  createSession(model: string, config: any): ChatSession {
    const session: ChatSession = {
      id: this.generateSessionId(),
      startTime: new Date(),
      status: 'active',
      messages: [],
      metadata: {
        model,
        config,
        totalMessages: 0,
        totalDuration: 0,
      },
    };

    this.storage.sessions.unshift(session);
    this.storage.currentSessionId = session.id;
    this.saveToStorage();

    return session;
  }

  endSession(sessionId: string): ChatSession | null {
    const session = this.getSession(sessionId);
    if (session && session.status === 'active') {
      session.endTime = new Date();
      session.status = 'completed';
      session.metadata.totalDuration =
        session.endTime.getTime() - session.startTime.getTime();

      if (this.storage.currentSessionId === sessionId) {
        this.storage.currentSessionId = undefined;
      }

      this.saveToStorage();
      return session;
    }
    return null;
  }

  addMessage(
    sessionId: string,
    message: Omit<ChatMessage, 'id'>
  ): ChatMessage | null {
    const session = this.getSession(sessionId);
    if (session) {
      const fullMessage: ChatMessage = {
        ...message,
        id: this.generateMessageId(),
      };

      session.messages.push(fullMessage);
      session.metadata.totalMessages = session.messages.length;
      this.saveToStorage();

      return fullMessage;
    }
    return null;
  }

  getSession(sessionId: string): ChatSession | null {
    return this.storage.sessions.find(s => s.id === sessionId) || null;
  }

  getCurrentSession(): ChatSession | null {
    if (this.storage.currentSessionId) {
      return this.getSession(this.storage.currentSessionId);
    }
    return null;
  }

  getAllSessions(): ChatSession[] {
    return [...this.storage.sessions];
  }

  updateSessionTranscription(
    sessionId: string,
    transcription: ChatSession['transcription']
  ): boolean {
    const session = this.getSession(sessionId);
    if (session) {
      session.transcription = transcription;
      this.saveToStorage();
      return true;
    }
    return false;
  }

  updateSessionAudioRecording(
    sessionId: string,
    audioRecording: ChatSession['audioRecording']
  ): boolean {
    const session = this.getSession(sessionId);
    if (session) {
      session.audioRecording = audioRecording;
      this.saveToStorage();
      return true;
    }
    return false;
  }

  deleteSession(sessionId: string): boolean {
    const index = this.storage.sessions.findIndex(s => s.id === sessionId);
    if (index !== -1) {
      this.storage.sessions.splice(index, 1);
      if (this.storage.currentSessionId === sessionId) {
        this.storage.currentSessionId = undefined;
      }
      this.saveToStorage();
      return true;
    }
    return false;
  }

  updateSettings(settings: Partial<ChatHistoryStorage['settings']>): void {
    this.storage.settings = { ...this.storage.settings, ...settings };
    this.saveToStorage();
    this.cleanupOldSessions();
  }

  getSettings(): ChatHistoryStorage['settings'] {
    return { ...this.storage.settings };
  }

  exportSession(sessionId: string): string | null {
    const session = this.getSession(sessionId);
    if (session) {
      return JSON.stringify(session, null, 2);
    }
    return null;
  }

  importSession(sessionData: string): boolean {
    try {
      const session = JSON.parse(sessionData) as ChatSession;
      // Validate session structure
      if (session.id && session.startTime && session.messages) {
        // Convert date strings to Date objects
        session.startTime = new Date(session.startTime);
        if (session.endTime) {
          session.endTime = new Date(session.endTime);
        }
        session.messages = session.messages.map(msg => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
        }));

        // Ensure unique ID
        session.id = this.generateSessionId();

        this.storage.sessions.unshift(session);
        this.saveToStorage();
        return true;
      }
    } catch (error) {
      console.error('Failed to import session:', error);
    }
    return false;
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Get storage usage statistics
  getStorageStats(): { used: number; total: number; sessions: number } {
    const data = localStorage.getItem(STORAGE_KEY) || '';
    const used = new Blob([data]).size;
    const total = 5 * 1024 * 1024; // 5MB typical localStorage limit

    return {
      used,
      total,
      sessions: this.storage.sessions.length,
    };
  }
}

// Singleton instance
export const chatHistoryStorage = new ChatHistoryStorageService();
