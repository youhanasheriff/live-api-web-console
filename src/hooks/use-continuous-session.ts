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

import { useState, useEffect, useCallback, useRef } from 'react';
import { StreamingLog } from '../types';

import { useLoggerStore } from '../lib/store-logger';

interface ContinuousSessionState {
  sessionId: string;
  startTime: Date;
  isActive: boolean;
  totalLogs: number;
  lastSaveTime: Date | null;
}

export interface UseContinuousSessionResults {
  currentSession: ContinuousSessionState;
  saveSession: () => Promise<boolean>;
  resetSession: () => void;
  isSessionActive: boolean;
}

const AUTO_SAVE_INTERVAL = 30000; // Auto-save every 30 seconds
const MIN_LOGS_FOR_SAVE = 5; // Minimum logs before saving

/**
 * Hook for managing a single continuous session that persists across websocket connections
 * This replaces the previous session management that created separate sessions per connection
 */
export function useContinuousSession(model: string): UseContinuousSessionResults {
  const { logs } = useLoggerStore();
  const [currentSession, setCurrentSession] = useState<ContinuousSessionState>(() => {
    // Initialize with a persistent session
    const sessionId = `continuous_session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return {
      sessionId,
      startTime: new Date(),
      isActive: true,
      totalLogs: 0,
      lastSaveTime: null
    };
  });
  
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedLogCountRef = useRef<number>(0);

  // Auto-save session periodically
  const saveSession = useCallback(async (): Promise<boolean> => {
    if (!currentSession.isActive || logs.length < MIN_LOGS_FOR_SAVE) {
      return false;
    }

    // Only save if there are new logs since last save
    const newLogsCount = logs.length - lastSavedLogCountRef.current;
    if (newLogsCount === 0) {
      return false;
    }

    const now = new Date();
    const duration = now.getTime() - currentSession.startTime.getTime();
    
    // Chat storage functionality removed
    lastSavedLogCountRef.current = logs.length;
    setCurrentSession(prev => ({
      ...prev,
      lastSaveTime: now,
      totalLogs: logs.length
    }));
    console.log(`Continuous session completed: ${logs.length} total logs, ${Math.floor(duration / 1000)}s duration`);
    return true;
  }, [currentSession, logs, model]);

  // Reset session (start fresh)
  const resetSession = useCallback(() => {
    const sessionId = `continuous_session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    setCurrentSession({
      sessionId,
      startTime: new Date(),
      isActive: true,
      totalLogs: 0,
      lastSaveTime: null
    });
    lastSavedLogCountRef.current = 0;
    console.log('Continuous session reset:', sessionId);
  }, []);

  // Set up auto-save timer
  useEffect(() => {
    if (currentSession.isActive) {
      autoSaveTimerRef.current = setInterval(() => {
        saveSession();
      }, AUTO_SAVE_INTERVAL);
    }

    return () => {
      if (autoSaveTimerRef.current) {
        clearInterval(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
    };
  }, [currentSession.isActive, saveSession]);

  // Update session state when logs change
  useEffect(() => {
    if (currentSession.isActive) {
      setCurrentSession(prev => ({
        ...prev,
        totalLogs: logs.length
      }));
    }
  }, [logs.length, currentSession.isActive]);

  // Save session on unmount
  useEffect(() => {
    return () => {
      if (currentSession.isActive && logs.length >= MIN_LOGS_FOR_SAVE) {
        // Chat storage functionality removed
        console.log('Continuous session ended on unmount');
      }
    };
  }, [currentSession, logs, model]);

  // Handle page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (currentSession.isActive && logs.length >= MIN_LOGS_FOR_SAVE) {
        // Chat storage functionality removed
        console.log('Continuous session ended on page unload');
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [currentSession, logs, model]);

  return {
    currentSession,
    saveSession,
    resetSession,
    isSessionActive: currentSession.isActive
  };
}