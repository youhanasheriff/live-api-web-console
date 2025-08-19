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

import { useCallback, useEffect, useRef, useState } from 'react';
import { sessionAudioRecorder, SessionAudioData } from '../lib/session-audio-recorder';
import { sessionAudioStorage } from '../lib/session-audio-storage';
import { AudioStreamer } from '../lib/audio-streamer';

export interface UseSessionAudioRecordingResults {
  isRecording: boolean;
  startRecording: (sessionId: string) => Promise<void>;
  stopRecording: () => Promise<SessionAudioData | null>;
  connectSpeakerAudio: (audioStreamer: AudioStreamer) => void;
  disconnectSpeakerAudio: (audioStreamer: AudioStreamer) => void;
  recordingStatus: {
    sessionId: string | null;
    startTime: Date | null;
    duration: number;
  };
  error: string | null;
}

/**
 * Hook for managing session audio recording
 * Integrates with chat session lifecycle and audio infrastructure
 */
export function useSessionAudioRecording(): UseSessionAudioRecordingResults {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recordingStatus, setRecordingStatus] = useState({
    sessionId: null as string | null,
    startTime: null as Date | null,
    duration: 0
  });
  
  const statusUpdateIntervalRef = useRef<number | null>(null);
  const connectedAudioNodesRef = useRef<Set<AudioNode>>(new Set());

  // Update recording status periodically
  useEffect(() => {
    if (isRecording) {
      statusUpdateIntervalRef.current = window.setInterval(() => {
        const status = sessionAudioRecorder.getRecordingStatus();
        setRecordingStatus({
          sessionId: status.sessionId,
          startTime: status.startTime,
          duration: status.duration
        });
      }, 1000);
    } else {
      if (statusUpdateIntervalRef.current) {
        clearInterval(statusUpdateIntervalRef.current);
        statusUpdateIntervalRef.current = null;
      }
    }

    return () => {
      if (statusUpdateIntervalRef.current) {
        clearInterval(statusUpdateIntervalRef.current);
      }
    };
  }, [isRecording]);

  // Set up event listeners for the session audio recorder
  useEffect(() => {
    const handleRecordingStarted = (data: { sessionId: string; startTime: Date }) => {
      console.log('Session recording started:', data);
      setIsRecording(true);
      setError(null);
    };

    const handleRecordingCompleted = async (sessionAudioData: SessionAudioData) => {
      console.log('Session recording completed:', sessionAudioData);
      setIsRecording(false);
      
      // Save the audio data to storage
      try {
        const result = await sessionAudioStorage.saveSessionAudio(sessionAudioData);
        if (!result.success) {
          console.error('Failed to save session audio:', result.error);
          setError(`Failed to save audio: ${result.error}`);
        } else {
          console.log('Session audio saved successfully');
        }
      } catch (error) {
        console.error('Error saving session audio:', error);
        setError(`Error saving audio: ${(error as Error).message}`);
      }
    };

    const handleRecordingError = (error: any) => {
      console.error('Session recording error:', error);
      setError(`Recording error: ${error.message || 'Unknown error'}`);
      setIsRecording(false);
    };

    sessionAudioRecorder.on('recording-started', handleRecordingStarted);
    sessionAudioRecorder.on('recording-completed', handleRecordingCompleted);
    sessionAudioRecorder.on('error', handleRecordingError);

    return () => {
      sessionAudioRecorder.off('recording-started', handleRecordingStarted);
      sessionAudioRecorder.off('recording-completed', handleRecordingCompleted);
      sessionAudioRecorder.off('error', handleRecordingError);
    };
  }, []);

  // Start recording for a session
  const startRecording = useCallback(async (sessionId: string) => {
    if (isRecording) {
      console.warn('Recording already in progress');
      return;
    }

    try {
      setError(null);
      await sessionAudioRecorder.startRecording(sessionId);
    } catch (error) {
      console.error('Failed to start recording:', error);
      setError(`Failed to start recording: ${(error as Error).message}`);
      setIsRecording(false);
    }
  }, [isRecording]);

  // Stop recording and return session data
  const stopRecording = useCallback(async (): Promise<SessionAudioData | null> => {
    if (!isRecording) {
      console.warn('No recording in progress');
      return null;
    }

    try {
      setError(null);
      const sessionAudioData = await sessionAudioRecorder.stopRecording();
      
      // Disconnect any connected audio nodes
      connectedAudioNodesRef.current.forEach(node => {
        sessionAudioRecorder.disconnectSpeakerAudio(node);
      });
      connectedAudioNodesRef.current.clear();
      
      return sessionAudioData;
    } catch (error) {
      console.error('Failed to stop recording:', error);
      setError(`Failed to stop recording: ${(error as Error).message}`);
      return null;
    }
  }, [isRecording]);

  // Connect speaker audio to recording
  const connectSpeakerAudio = useCallback((audioStreamer: AudioStreamer) => {
    if (!isRecording) {
      console.warn('Cannot connect speaker audio: no recording in progress');
      return;
    }

    try {
      // Connect the gain node from the audio streamer to the session recorder
      sessionAudioRecorder.connectSpeakerAudio(audioStreamer.gainNode);
      connectedAudioNodesRef.current.add(audioStreamer.gainNode);
      console.log('Speaker audio connected to session recorder');
    } catch (error) {
      console.error('Failed to connect speaker audio:', error);
      setError(`Failed to connect speaker audio: ${(error as Error).message}`);
    }
  }, [isRecording]);

  // Disconnect speaker audio from recording
  const disconnectSpeakerAudio = useCallback((audioStreamer: AudioStreamer) => {
    try {
      sessionAudioRecorder.disconnectSpeakerAudio(audioStreamer.gainNode);
      connectedAudioNodesRef.current.delete(audioStreamer.gainNode);
      console.log('Speaker audio disconnected from session recorder');
    } catch (error) {
      console.error('Failed to disconnect speaker audio:', error);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isRecording) {
        stopRecording();
      }
    };
  }, []);

  return {
    isRecording,
    startRecording,
    stopRecording,
    connectSpeakerAudio,
    disconnectSpeakerAudio,
    recordingStatus,
    error
  };
}