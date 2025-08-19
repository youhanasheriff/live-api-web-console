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

import EventEmitter from 'eventemitter3';
import { SessionAudioRecorder, SessionAudioData } from './session-audio-recorder';
import { sessionAudioStorage } from './session-audio-storage';
import { AudioStreamer } from './audio-streamer';

export interface SessionAudioManagerOptions {
  autoSave?: boolean;
  sampleRate?: number;
  mimeType?: string;
  audioBitsPerSecond?: number;
}

export interface SessionRecordingInfo {
  sessionId: string;
  startTime: Date;
  isRecording: boolean;
  duration: number;
  connectedSpeakers: Set<AudioStreamer>;
}

export interface SessionAudioManagerEvents {
  'session-started': (info: SessionRecordingInfo) => void;
  'session-stopped': (sessionData: SessionAudioData) => void;
  'session-saved': (sessionId: string) => void;
  'session-error': (error: Error, sessionId?: string) => void;
  'speaker-connected': (sessionId: string, audioStreamer: AudioStreamer) => void;
  'speaker-disconnected': (sessionId: string, audioStreamer: AudioStreamer) => void;
}

/**
 * Comprehensive audio manager for complete call session recordings.
 * Automatically manages recording lifecycle tied to connection state.
 */
export class SessionAudioManager extends EventEmitter<SessionAudioManagerEvents> {
  private sessionRecorder: SessionAudioRecorder;
  private currentSession: SessionRecordingInfo | null = null;
  private connectedSpeakers = new Set<AudioStreamer>();
  private options: Required<SessionAudioManagerOptions>;
  private statusUpdateInterval: number | null = null;

  constructor(options: SessionAudioManagerOptions = {}) {
    super();
    
    this.options = {
      autoSave: true,
      sampleRate: 24000,
      mimeType: 'audio/webm;codecs=opus',
      audioBitsPerSecond: 128000,
      ...options
    };

    this.sessionRecorder = new SessionAudioRecorder({
      sampleRate: this.options.sampleRate,
      mimeType: this.options.mimeType,
      audioBitsPerSecond: this.options.audioBitsPerSecond
    });

    this.setupRecorderEventListeners();
  }

  /**
   * Start a new session recording
   */
  async startSession(sessionId?: string): Promise<string> {
    if (this.currentSession) {
      console.warn(`Attempting to start session while session ${this.currentSession.sessionId} is active. Stopping current session first.`);
      try {
        await this.stopSession();
      } catch (error) {
        console.error('Failed to stop existing session:', error);
        // Force cleanup
        this.currentSession = null;
        this.stopStatusUpdates();
      }
    }

    const actualSessionId = sessionId || this.generateSessionId();
    
    try {
      await this.sessionRecorder.startRecording(actualSessionId);
      
      this.currentSession = {
        sessionId: actualSessionId,
        startTime: new Date(),
        isRecording: true,
        duration: 0,
        connectedSpeakers: new Set()
      };

      // Connect any already available speakers
      this.connectedSpeakers.forEach(speaker => {
        this.connectSpeakerToSession(speaker);
      });

      this.startStatusUpdates();
      this.emit('session-started', { ...this.currentSession });
      
      console.log(`Session recording started: ${actualSessionId}`);
      return actualSessionId;
    } catch (error) {
      this.currentSession = null;
      this.emit('session-error', error as Error, actualSessionId);
      throw error;
    }
  }

  /**
   * Stop the current session recording
   */
  async stopSession(): Promise<SessionAudioData | null> {
    if (!this.currentSession) {
      console.warn('No active recording session to stop');
      return null;
    }

    const sessionId = this.currentSession.sessionId;
    
    try {
      this.stopStatusUpdates();
      
      // Disconnect all speakers
      this.currentSession.connectedSpeakers.forEach(speaker => {
        this.disconnectSpeakerFromSession(speaker);
      });

      const sessionData = await this.sessionRecorder.stopRecording();
      
      if (sessionData && this.options.autoSave) {
        await this.saveSessionData(sessionData);
      }

      this.currentSession = null;
      
      if (sessionData) {
        this.emit('session-stopped', sessionData);
        console.log(`Session recording stopped: ${sessionId}, duration: ${sessionData.duration}ms`);
      }
      
      return sessionData;
    } catch (error) {
      this.emit('session-error', error as Error, sessionId);
      this.currentSession = null;
      throw error;
    }
  }

  /**
   * Connect a speaker audio source to the current session
   */
  connectSpeaker(audioStreamer: AudioStreamer): void {
    this.connectedSpeakers.add(audioStreamer);
    
    if (this.currentSession) {
      this.connectSpeakerToSession(audioStreamer);
    }
  }

  /**
   * Disconnect a speaker audio source from the current session
   */
  disconnectSpeaker(audioStreamer: AudioStreamer): void {
    this.connectedSpeakers.delete(audioStreamer);
    
    if (this.currentSession) {
      this.disconnectSpeakerFromSession(audioStreamer);
    }
  }

  /**
   * Get current session information
   */
  getCurrentSession(): SessionRecordingInfo | null {
    return this.currentSession ? { ...this.currentSession } : null;
  }

  /**
   * Check if a session is currently recording
   */
  isRecording(): boolean {
    return this.currentSession?.isRecording ?? false;
  }

  /**
   * Get session recording statistics
   */
  getSessionStats(): {
    isRecording: boolean;
    sessionId: string | null;
    startTime: Date | null;
    duration: number;
    connectedSpeakers: number;
  } {
    if (!this.currentSession) {
      return {
        isRecording: false,
        sessionId: null,
        startTime: null,
        duration: 0,
        connectedSpeakers: 0
      };
    }

    return {
      isRecording: this.currentSession.isRecording,
      sessionId: this.currentSession.sessionId,
      startTime: this.currentSession.startTime,
      duration: this.currentSession.duration,
      connectedSpeakers: this.currentSession.connectedSpeakers.size
    };
  }

  /**
   * Manually save session data
   */
  async saveSessionData(sessionData: SessionAudioData): Promise<void> {
    try {
      const result = await sessionAudioStorage.saveSessionAudio(sessionData);
      if (!result.success) {
        throw new Error(result.error || 'Failed to save session audio');
      }
      this.emit('session-saved', sessionData.sessionId);
      console.log(`Session audio saved: ${sessionData.sessionId}`);
    } catch (error) {
      this.emit('session-error', error as Error, sessionData.sessionId);
      throw error;
    }
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.currentSession) {
      this.stopSession().catch(console.error);
    }
    
    this.stopStatusUpdates();
    this.connectedSpeakers.clear();
    this.removeAllListeners();
  }

  // Private methods

  private setupRecorderEventListeners(): void {
    this.sessionRecorder.on('recording-started', (data) => {
      console.log('SessionAudioRecorder: Recording started', data);
    });

    this.sessionRecorder.on('recording-stopped', (data) => {
      console.log('SessionAudioRecorder: Recording stopped', data);
    });

    this.sessionRecorder.on('error', (error) => {
      console.error('SessionAudioRecorder: Error', error);
      this.emit('session-error', error, this.currentSession?.sessionId);
    });
  }

  private connectSpeakerToSession(audioStreamer: AudioStreamer): void {
    if (!this.currentSession) return;
    
    try {
      this.sessionRecorder.connectSpeakerAudio(audioStreamer.gainNode);
      this.currentSession.connectedSpeakers.add(audioStreamer);
      this.emit('speaker-connected', this.currentSession.sessionId, audioStreamer);
      console.log(`Speaker connected to session: ${this.currentSession.sessionId}`);
    } catch (error) {
      console.error('Failed to connect speaker to session:', error);
      this.emit('session-error', error as Error, this.currentSession.sessionId);
    }
  }

  private disconnectSpeakerFromSession(audioStreamer: AudioStreamer): void {
    if (!this.currentSession) return;
    
    try {
      this.sessionRecorder.disconnectSpeakerAudio(audioStreamer.gainNode);
      this.currentSession.connectedSpeakers.delete(audioStreamer);
      this.emit('speaker-disconnected', this.currentSession.sessionId, audioStreamer);
      console.log(`Speaker disconnected from session: ${this.currentSession.sessionId}`);
    } catch (error) {
      console.error('Failed to disconnect speaker from session:', error);
    }
  }

  private startStatusUpdates(): void {
    this.statusUpdateInterval = window.setInterval(() => {
      if (this.currentSession) {
        this.currentSession.duration = Date.now() - this.currentSession.startTime.getTime();
      }
    }, 1000);
  }

  private stopStatusUpdates(): void {
    if (this.statusUpdateInterval) {
      clearInterval(this.statusUpdateInterval);
      this.statusUpdateInterval = null;
    }
  }

  private generateSessionId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `session-${timestamp}-${random}`;
  }
}

// Export a singleton instance
export const sessionAudioManager = new SessionAudioManager();