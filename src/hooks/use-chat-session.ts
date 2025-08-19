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

import { useEffect, useRef, useState, useCallback } from 'react';
import { useLoggerStore } from '../lib/store-logger';
import { chatStorage, ChatSession } from '../lib/chat-storage';
import { StreamingLog } from '../types';

interface SessionState {
  isActive: boolean;
  startTime: Date | null;
  sessionId: string | null;
  logs: StreamingLog[];
}

export interface UseChatSessionResults {
  currentSession: SessionState;
  saveCurrentSession: () => Promise<boolean>;
  startNewSession: () => void;
  endCurrentSession: () => Promise<boolean>;
  isSessionActive: boolean;
}

const INACTIVITY_TIMEOUT = 30000; // 30 seconds of inactivity before auto-save
const MIN_SESSION_DURATION = 1000; // 1 second minimum duration

export function useChatSession(connected: boolean, model: string): UseChatSessionResults {
  const { logs, clearLogs } = useLoggerStore();
  const [currentSession, setCurrentSession] = useState<SessionState>({
    isActive: false,
    startTime: null,
    sessionId: null,
    logs: []
  });
  
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<Date>(new Date());
  const sessionLogsRef = useRef<StreamingLog[]>([]);

  // Generate session title from logs
  const generateSessionTitle = useCallback((sessionLogs: StreamingLog[]): string => {
    // Look for the first meaningful user message or content
    const meaningfulLog = sessionLogs.find(log => 
      log.type === 'user' || 
      (log.type === 'content' && typeof log.message === 'string' && log.message.trim().length > 0)
    );
    
    if (meaningfulLog && typeof meaningfulLog.message === 'string') {
      const message = meaningfulLog.message.trim();
      // Take first 50 characters and add ellipsis if longer
      return message.length > 50 ? `${message.substring(0, 50)}...` : message;
    }
    
    // Fallback to timestamp-based title
    const now = new Date();
    return `Chat Session ${now.toLocaleDateString()} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }, []);

  // Save current session to storage
  const saveCurrentSession = useCallback(async (): Promise<boolean> => {
    if (!currentSession.isActive || !currentSession.startTime || sessionLogsRef.current.length === 0) {
      return false;
    }

    const endTime = new Date();
    const duration = endTime.getTime() - currentSession.startTime.getTime();
    
    // Don't save sessions shorter than minimum duration
    if (duration < MIN_SESSION_DURATION) {
      console.log('Session too short, not saving');
      return false;
    }

    const result = chatStorage.saveSession(
      sessionLogsRef.current,
      model || 'unknown',
      currentSession.startTime,
      endTime
    );
    
    if (result.success) {
      console.log(`Session saved: ${sessionLogsRef.current.length} logs, ${Math.floor(duration / 1000)}s`);
      return true;
    } else {
      console.error('Failed to save session:', result.error);
      return false;
    }
  }, [currentSession, model]);

  // Start a new session
  const startNewSession = useCallback(() => {
    const now = new Date();
    const sessionId = `session_${now.getTime()}_${Math.random().toString(36).substr(2, 9)}`;
    
    setCurrentSession({
      isActive: true,
      startTime: now,
      sessionId,
      logs: []
    });
    
    sessionLogsRef.current = [];
    lastActivityRef.current = now;
    
    console.log('New chat session started:', sessionId);
  }, []);

  // End current session
  const endCurrentSession = useCallback(async (): Promise<boolean> => {
    if (!currentSession.isActive) {
      return false;
    }

    // Clear inactivity timer
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }

    // Save session before ending
    const saved = await saveCurrentSession();
    
    // Reset session state
    setCurrentSession({
      isActive: false,
      startTime: null,
      sessionId: null,
      logs: []
    });
    
    sessionLogsRef.current = [];
    
    console.log('Chat session ended');
    return saved;
  }, [currentSession.isActive, saveCurrentSession]);

  // Reset inactivity timer
  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    
    if (currentSession.isActive) {
      inactivityTimerRef.current = setTimeout(() => {
        console.log('Session inactive for 30s, auto-saving...');
        endCurrentSession();
      }, INACTIVITY_TIMEOUT);
    }
  }, [currentSession.isActive, endCurrentSession]);

  // Monitor connection status
  useEffect(() => {
    if (connected && !currentSession.isActive) {
      // Start new session when connected
      startNewSession();
    } else if (!connected && currentSession.isActive) {
      // End session when disconnected
      endCurrentSession();
    }
  }, [connected, currentSession.isActive, startNewSession, endCurrentSession]);

  // Monitor logs for activity
  useEffect(() => {
    if (!currentSession.isActive) {
      return;
    }

    // Check if new logs have been added
    const newLogs = logs.slice(sessionLogsRef.current.length);
    if (newLogs.length > 0) {
      // Update session logs
      sessionLogsRef.current = [...logs];
      lastActivityRef.current = new Date();
      
      // Update session state
      setCurrentSession(prev => ({
        ...prev,
        logs: [...logs]
      }));
      
      // Reset inactivity timer
      resetInactivityTimer();
    }
  }, [logs, currentSession.isActive, resetInactivityTimer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
      
      // Save session on unmount if active
      if (currentSession.isActive) {
        saveCurrentSession();
      }
    };
  }, [currentSession.isActive, saveCurrentSession]);

  // Handle page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (currentSession.isActive) {
        // Synchronous save on page unload
        const endTime = new Date();
        const duration = currentSession.startTime ? endTime.getTime() - currentSession.startTime.getTime() : 0;
        
        if (duration >= MIN_SESSION_DURATION && sessionLogsRef.current.length > 0) {
          // Use the storage service for synchronous save on unload
          try {
            chatStorage.saveSession(
              sessionLogsRef.current,
              model || 'unknown',
              currentSession.startTime!,
              endTime
            );
          } catch (error) {
            console.error('Failed to save session on unload:', error);
          }
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [currentSession, model, generateSessionTitle]);

  return {
    currentSession,
    saveCurrentSession,
    startNewSession,
    endCurrentSession,
    isSessionActive: currentSession.isActive
  };
}