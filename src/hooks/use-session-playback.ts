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

import { useState, useCallback, useRef, useEffect } from 'react';
import { ChatSession } from '../lib/chat-storage';
import { StreamingLog } from '../types';
import { useLoggerStore } from '../lib/store-logger';

export interface PlaybackState {
  isPlaying: boolean;
  isPaused: boolean;
  currentIndex: number;
  totalLogs: number;
  progress: number; // 0-100
  speed: number; // playback speed multiplier
  session: ChatSession | null;
}

export interface UseSessionPlaybackResults {
  playbackState: PlaybackState;
  startPlayback: (session: ChatSession) => void;
  pausePlayback: () => void;
  resumePlayback: () => void;
  stopPlayback: () => void;
  seekTo: (index: number) => void;
  setSpeed: (speed: number) => void;
  skipToNext: () => void;
  skipToPrevious: () => void;
}

const PLAYBACK_SPEEDS = [0.5, 1, 1.5, 2, 3, 5];
const DEFAULT_DELAY = 1000; // 1 second between logs
const MIN_DELAY = 100; // Minimum delay between logs

export function useSessionPlayback(): UseSessionPlaybackResults {
  const { clearLogs, log } = useLoggerStore();
  const [playbackState, setPlaybackState] = useState<PlaybackState>({
    isPlaying: false,
    isPaused: false,
    currentIndex: 0,
    totalLogs: 0,
    progress: 0,
    speed: 1,
    session: null
  });

  const playbackTimerRef = useRef<NodeJS.Timeout | null>(null);
  const currentSessionRef = useRef<ChatSession | null>(null);
  const isPlayingRef = useRef(false);

  // Calculate delay between logs based on original timestamps
  const calculateDelay = useCallback((currentLog: StreamingLog, nextLog?: StreamingLog): number => {
    if (!nextLog) return DEFAULT_DELAY;
    
    const timeDiff = nextLog.date.getTime() - currentLog.date.getTime();
    const adjustedDelay = Math.max(MIN_DELAY, Math.min(timeDiff, DEFAULT_DELAY * 3));
    
    return adjustedDelay / playbackState.speed;
  }, [playbackState.speed]);

  // Play next log in sequence
  const playNextLog = useCallback(() => {
    if (!currentSessionRef.current || !isPlayingRef.current) {
      return;
    }

    const session = currentSessionRef.current;
    const currentIndex = playbackState.currentIndex;
    
    if (currentIndex >= session.logs.length) {
      // Playback complete
      setPlaybackState(prev => ({
        ...prev,
        isPlaying: false,
        isPaused: false,
        progress: 100
      }));
      isPlayingRef.current = false;
      return;
    }

    // Add current log to logger
    const currentLog = session.logs[currentIndex];
    log(currentLog);

    // Update playback state
    const progress = ((currentIndex + 1) / session.logs.length) * 100;
    setPlaybackState(prev => ({
      ...prev,
      currentIndex: currentIndex + 1,
      progress
    }));

    // Schedule next log
    if (currentIndex + 1 < session.logs.length) {
      const nextLog = session.logs[currentIndex + 1];
      const delay = calculateDelay(currentLog, nextLog);
      
      playbackTimerRef.current = setTimeout(() => {
        playNextLog();
      }, delay);
    } else {
      // Playback complete
      setPlaybackState(prev => ({
        ...prev,
        isPlaying: false,
        isPaused: false,
        progress: 100
      }));
      isPlayingRef.current = false;
    }
  }, [playbackState.currentIndex, playbackState.speed, log, calculateDelay]);

  // Start playback of a session
  const startPlayback = useCallback((session: ChatSession) => {
    // Clear existing logs
    clearLogs();
    
    // Stop any existing playback
    if (playbackTimerRef.current) {
      clearTimeout(playbackTimerRef.current);
    }

    // Set up new playback
    currentSessionRef.current = session;
    isPlayingRef.current = true;
    
    setPlaybackState({
      isPlaying: true,
      isPaused: false,
      currentIndex: 0,
      totalLogs: session.logs.length,
      progress: 0,
      speed: 1,
      session
    });

    // Add session info log
    log({
      date: new Date(),
      type: 'playback.start',
      message: `🎬 Playing back session: ${session.title}`
    });

    // Start playing logs
    setTimeout(() => {
      playNextLog();
    }, 500); // Small delay before starting
  }, [clearLogs, log, playNextLog]);

  // Pause playback
  const pausePlayback = useCallback(() => {
    if (playbackTimerRef.current) {
      clearTimeout(playbackTimerRef.current);
      playbackTimerRef.current = null;
    }
    
    isPlayingRef.current = false;
    setPlaybackState(prev => ({
      ...prev,
      isPlaying: false,
      isPaused: true
    }));
  }, []);

  // Resume playback
  const resumePlayback = useCallback(() => {
    if (!currentSessionRef.current || playbackState.currentIndex >= playbackState.totalLogs) {
      return;
    }

    isPlayingRef.current = true;
    setPlaybackState(prev => ({
      ...prev,
      isPlaying: true,
      isPaused: false
    }));

    // Resume from current position
    playNextLog();
  }, [playbackState.currentIndex, playbackState.totalLogs, playNextLog]);

  // Stop playback
  const stopPlayback = useCallback(() => {
    if (playbackTimerRef.current) {
      clearTimeout(playbackTimerRef.current);
      playbackTimerRef.current = null;
    }
    
    isPlayingRef.current = false;
    currentSessionRef.current = null;
    
    setPlaybackState({
      isPlaying: false,
      isPaused: false,
      currentIndex: 0,
      totalLogs: 0,
      progress: 0,
      speed: 1,
      session: null
    });

    // Add stop log
    log({
      date: new Date(),
      type: 'playback.stop',
      message: '⏹️ Playback stopped'
    });
  }, [log]);

  // Seek to specific log index
  const seekTo = useCallback((index: number) => {
    if (!currentSessionRef.current) return;
    
    const session = currentSessionRef.current;
    const clampedIndex = Math.max(0, Math.min(index, session.logs.length));
    
    // Clear logs and replay up to the target index
    clearLogs();
    
    // Add session info log
    log({
      date: new Date(),
      type: 'playback.seek',
      message: `⏭️ Seeking to log ${clampedIndex + 1}/${session.logs.length}`
    });

    // Add all logs up to the target index instantly
    for (let i = 0; i <= clampedIndex && i < session.logs.length; i++) {
      log(session.logs[i]);
    }

    const progress = ((clampedIndex + 1) / session.logs.length) * 100;
    setPlaybackState(prev => ({
      ...prev,
      currentIndex: clampedIndex + 1,
      progress
    }));

    // If we were playing, continue from new position
    if (isPlayingRef.current && clampedIndex + 1 < session.logs.length) {
      if (playbackTimerRef.current) {
        clearTimeout(playbackTimerRef.current);
      }
      
      const nextDelay = calculateDelay(
        session.logs[clampedIndex],
        session.logs[clampedIndex + 1]
      );
      
      playbackTimerRef.current = setTimeout(() => {
        playNextLog();
      }, nextDelay);
    }
  }, [clearLogs, log, calculateDelay, playNextLog]);

  // Set playback speed
  const setSpeed = useCallback((speed: number) => {
    const validSpeed = PLAYBACK_SPEEDS.includes(speed) ? speed : 1;
    setPlaybackState(prev => ({
      ...prev,
      speed: validSpeed
    }));
  }, []);

  // Skip to next significant log (user input or model response)
  const skipToNext = useCallback(() => {
    if (!currentSessionRef.current) return;
    
    const session = currentSessionRef.current;
    const currentIndex = playbackState.currentIndex;
    
    // Find next significant log
    for (let i = currentIndex; i < session.logs.length; i++) {
      const log = session.logs[i];
      if (log.type.includes('user') || log.type.includes('model') || log.type.includes('content')) {
        seekTo(i);
        return;
      }
    }
    
    // If no significant log found, go to end
    seekTo(session.logs.length - 1);
  }, [playbackState.currentIndex, seekTo]);

  // Skip to previous significant log
  const skipToPrevious = useCallback(() => {
    if (!currentSessionRef.current) return;
    
    const session = currentSessionRef.current;
    const currentIndex = playbackState.currentIndex;
    
    // Find previous significant log
    for (let i = Math.max(0, currentIndex - 2); i >= 0; i--) {
      const log = session.logs[i];
      if (log.type.includes('user') || log.type.includes('model') || log.type.includes('content')) {
        seekTo(i);
        return;
      }
    }
    
    // If no significant log found, go to beginning
    seekTo(0);
  }, [playbackState.currentIndex, seekTo]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (playbackTimerRef.current) {
        clearTimeout(playbackTimerRef.current);
      }
    };
  }, []);

  return {
    playbackState,
    startPlayback,
    pausePlayback,
    resumePlayback,
    stopPlayback,
    seekTo,
    setSpeed,
    skipToNext,
    skipToPrevious
  };
}

export { PLAYBACK_SPEEDS };