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

import { useCallback, useEffect, useState, useRef } from 'react';
import { 
  SessionAudioManager, 
  SessionRecordingInfo, 
  SessionAudioManagerOptions 
} from '../lib/session-audio-manager';
import { SessionAudioData } from '../lib/session-audio-recorder';
import { AudioStreamer } from '../lib/audio-streamer';

export interface UseSessionAudioManagerResults {
  // Recording state
  isRecording: boolean;
  currentSession: SessionRecordingInfo | null;
  error: string | null;
  
  // Recording controls
  startSession: (sessionId?: string) => Promise<string | null>;
  stopSession: () => Promise<SessionAudioData | null>;
  
  // Speaker management
  connectSpeaker: (audioStreamer: AudioStreamer) => void;
  disconnectSpeaker: (audioStreamer: AudioStreamer) => void;
  
  // Session info
  getSessionStats: () => {
    isRecording: boolean;
    sessionId: string | null;
    startTime: Date | null;
    duration: number;
    connectedSpeakers: number;
  };
  
  // Error handling
  clearError: () => void;
}

export interface UseSessionAudioManagerOptions extends SessionAudioManagerOptions {
  autoStartOnConnection?: boolean;
  autoStopOnDisconnection?: boolean;
}

/**
 * Hook for managing comprehensive session audio recording
 * Provides integration with connection lifecycle and speaker management
 */
export function useSessionAudioManager(
  options: UseSessionAudioManagerOptions = {}
): UseSessionAudioManagerResults {
  const [isRecording, setIsRecording] = useState(false);
  const [currentSession, setCurrentSession] = useState<SessionRecordingInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const managerRef = useRef<SessionAudioManager | null>(null);
  const optionsRef = useRef(options);
  
  // Update options ref when options change
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  // Initialize session audio manager
  useEffect(() => {
    if (!managerRef.current) {
      managerRef.current = new SessionAudioManager({
        autoSave: optionsRef.current.autoSave ?? true,
        sampleRate: optionsRef.current.sampleRate ?? 24000,
        mimeType: optionsRef.current.mimeType ?? 'audio/webm;codecs=opus',
        audioBitsPerSecond: optionsRef.current.audioBitsPerSecond ?? 128000
      });

      // Set up event listeners
      const manager = managerRef.current;
      
      const handleSessionStarted = (info: SessionRecordingInfo) => {
        setIsRecording(true);
        setCurrentSession(info);
        setError(null);
        console.log('Session started:', info.sessionId);
      };

      const handleSessionStopped = (sessionData: SessionAudioData) => {
        setIsRecording(false);
        setCurrentSession(null);
        console.log('Session stopped:', sessionData.sessionId);
      };

      const handleSessionError = (error: Error, sessionId?: string) => {
        setError(error.message);
        console.error('Session error:', error, sessionId);
      };

      const handleSessionSaved = (sessionId: string) => {
        console.log('Session saved:', sessionId);
      };

      const handleSpeakerConnected = (sessionId: string, audioStreamer: AudioStreamer) => {
        console.log('Speaker connected to session:', sessionId);
      };

      const handleSpeakerDisconnected = (sessionId: string, audioStreamer: AudioStreamer) => {
        console.log('Speaker disconnected from session:', sessionId);
      };

      manager.on('session-started', handleSessionStarted);
      manager.on('session-stopped', handleSessionStopped);
      manager.on('session-error', handleSessionError);
      manager.on('session-saved', handleSessionSaved);
      manager.on('speaker-connected', handleSpeakerConnected);
      manager.on('speaker-disconnected', handleSpeakerDisconnected);

      // Cleanup function
      return () => {
        manager.off('session-started', handleSessionStarted);
        manager.off('session-stopped', handleSessionStopped);
        manager.off('session-error', handleSessionError);
        manager.off('session-saved', handleSessionSaved);
        manager.off('speaker-connected', handleSpeakerConnected);
        manager.off('speaker-disconnected', handleSpeakerDisconnected);
        manager.destroy();
      };
    }
  }, []);

  // Start session recording
  const startSession = useCallback(async (sessionId?: string): Promise<string | null> => {
    if (!managerRef.current) {
      setError('Session audio manager not initialized');
      return null;
    }

    try {
      setError(null);
      const actualSessionId = await managerRef.current.startSession(sessionId);
      return actualSessionId;
    } catch (error) {
      const errorMessage = `Failed to start session: ${(error as Error).message}`;
      setError(errorMessage);
      console.error('Failed to start session:', error);
      return null;
    }
  }, []);

  // Stop session recording
  const stopSession = useCallback(async (): Promise<SessionAudioData | null> => {
    if (!managerRef.current) {
      setError('Session audio manager not initialized');
      return null;
    }

    try {
      setError(null);
      const sessionData = await managerRef.current.stopSession();
      return sessionData;
    } catch (error) {
      const errorMessage = `Failed to stop session: ${(error as Error).message}`;
      setError(errorMessage);
      console.error('Failed to stop session:', error);
      return null;
    }
  }, []);

  // Connect speaker to session
  const connectSpeaker = useCallback((audioStreamer: AudioStreamer) => {
    if (!managerRef.current) {
      console.warn('Session audio manager not initialized');
      return;
    }

    try {
      managerRef.current.connectSpeaker(audioStreamer);
    } catch (error) {
      const errorMessage = `Failed to connect speaker: ${(error as Error).message}`;
      setError(errorMessage);
      console.error('Failed to connect speaker:', error);
    }
  }, []);

  // Disconnect speaker from session
  const disconnectSpeaker = useCallback((audioStreamer: AudioStreamer) => {
    if (!managerRef.current) {
      console.warn('Session audio manager not initialized');
      return;
    }

    try {
      managerRef.current.disconnectSpeaker(audioStreamer);
    } catch (error) {
      console.error('Failed to disconnect speaker:', error);
    }
  }, []);

  // Get session statistics
  const getSessionStats = useCallback(() => {
    if (!managerRef.current) {
      return {
        isRecording: false,
        sessionId: null,
        startTime: null,
        duration: 0,
        connectedSpeakers: 0
      };
    }

    return managerRef.current.getSessionStats();
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Update current session info periodically
  useEffect(() => {
    if (isRecording && managerRef.current) {
      const interval = setInterval(() => {
        const session = managerRef.current?.getCurrentSession();
        if (session) {
          setCurrentSession({ ...session });
        }
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [isRecording]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (managerRef.current) {
        managerRef.current.destroy();
      }
    };
  }, []);

  return {
    isRecording,
    currentSession,
    error,
    startSession,
    stopSession,
    connectSpeaker,
    disconnectSpeaker,
    getSessionStats,
    clearError
  };
}