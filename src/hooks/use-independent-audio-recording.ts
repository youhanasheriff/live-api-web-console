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
import { SessionAudioRecorder, SessionAudioData } from '../lib/session-audio-recorder';
import { sessionAudioStorage } from '../lib/session-audio-storage';
import { AudioStreamer } from '../lib/audio-streamer';

export interface UseIndependentAudioRecordingResults {
  isRecording: boolean;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<SessionAudioData | null>;
  connectSpeakerAudio: (audioStreamer: AudioStreamer) => void;
  disconnectSpeakerAudio: (audioStreamer: AudioStreamer) => void;
  recordingStatus: {
    sessionId: string | null;
    startTime: Date | null;
    duration: number;
  };
  error: string | null;
  clearError: () => void;
}

/**
 * Independent audio recording hook that operates separately from websocket connections
 * and session management. This provides continuous audio recording functionality
 * that can be controlled independently of chat session lifecycle.
 */
export function useIndependentAudioRecording(): UseIndependentAudioRecordingResults {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recordingStatus, setRecordingStatus] = useState({
    sessionId: null as string | null,
    startTime: null as Date | null,
    duration: 0
  });
  
  const statusUpdateIntervalRef = useRef<number | null>(null);
  const connectedAudioNodesRef = useRef<Set<AudioNode>>(new Set());
  const currentRecordingIdRef = useRef<string | null>(null);
  
  // Create a separate recorder instance for independent recording
  const independentRecorderRef = useRef<SessionAudioRecorder | null>(null);
  
  // Initialize the independent recorder
  useEffect(() => {
    if (!independentRecorderRef.current) {
      independentRecorderRef.current = new SessionAudioRecorder({
        sampleRate: 48000,
        mimeType: 'audio/webm;codecs=opus',
        audioBitsPerSecond: 128000
      });
    }
    
    return () => {
      if (independentRecorderRef.current) {
        // Cleanup on unmount
        independentRecorderRef.current.removeAllListeners();
      }
    };
  }, []);

  // Update recording status periodically
  useEffect(() => {
    if (isRecording && independentRecorderRef.current) {
      statusUpdateIntervalRef.current = window.setInterval(() => {
        const status = independentRecorderRef.current!.getRecordingStatus();
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

  // Set up event listeners for the independent audio recorder
  useEffect(() => {
    if (!independentRecorderRef.current) return;
    
    const recorder = independentRecorderRef.current;
    
    const handleRecordingStarted = (data: { sessionId: string; startTime: Date }) => {
      console.log('Independent recording started:', data);
      setIsRecording(true);
      setError(null);
      currentRecordingIdRef.current = data.sessionId;
    };

    const handleRecordingCompleted = async (sessionAudioData: SessionAudioData) => {
      console.log('Independent recording completed:', sessionAudioData);
      setIsRecording(false);
      currentRecordingIdRef.current = null;
      
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
      console.error('Independent recording error:', error);
      setError(`Recording error: ${error.message || 'Unknown error'}`);
      setIsRecording(false);
      currentRecordingIdRef.current = null;
    };

    recorder.on('recording-started', handleRecordingStarted);
    recorder.on('recording-completed', handleRecordingCompleted);
    recorder.on('error', handleRecordingError);

    return () => {
      recorder.off('recording-started', handleRecordingStarted);
      recorder.off('recording-completed', handleRecordingCompleted);
      recorder.off('error', handleRecordingError);
    };
  }, []);

  // Start independent recording
  const startRecording = useCallback(async () => {
    if (isRecording) {
      console.warn('Recording already in progress');
      return;
    }

    try {
      setError(null);
      // Generate a unique recording ID independent of session management
      const recordingId = `audio_recording_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      if (independentRecorderRef.current) {
        await independentRecorderRef.current.startRecording(recordingId);
      }
    } catch (error) {
      console.error('Failed to start independent recording:', error);
      setError(`Failed to start recording: ${(error as Error).message}`);
      setIsRecording(false);
    }
  }, [isRecording]);

  // Stop independent recording
  const stopRecording = useCallback(async (): Promise<SessionAudioData | null> => {
    if (!isRecording) {
      console.warn('No recording in progress');
      return null;
    }

    try {
      setError(null);
      const sessionAudioData = independentRecorderRef.current ? await independentRecorderRef.current.stopRecording() : null;
      
      // Disconnect any connected audio nodes
      connectedAudioNodesRef.current.forEach(node => {
        try {
          if (independentRecorderRef.current) {
            independentRecorderRef.current.disconnectSpeakerAudio(node);
          }
        } catch (error) {
          console.warn('Error disconnecting audio node:', error);
        }
      });
      connectedAudioNodesRef.current.clear();
      
      return sessionAudioData;
    } catch (error) {
      console.error('Failed to stop independent recording:', error);
      setError(`Failed to stop recording: ${(error as Error).message}`);
      return null;
    }
  }, [isRecording]);

  // Connect speaker audio for recording
  const connectSpeakerAudio = useCallback((audioStreamer: AudioStreamer) => {
    if (!isRecording) {
      console.warn('Cannot connect speaker audio: no recording in progress');
      return;
    }

    try {
      // Use the gainNode from the AudioStreamer as the audio node
      if (independentRecorderRef.current) {
        independentRecorderRef.current.connectSpeakerAudio(audioStreamer.gainNode);
        connectedAudioNodesRef.current.add(audioStreamer.gainNode);
      }
      console.log('Speaker audio connected to independent recording');
    } catch (error) {
      console.error('Failed to connect speaker audio:', error);
      setError(`Failed to connect speaker audio: ${(error as Error).message}`);
    }
  }, [isRecording]);

  // Disconnect speaker audio
  const disconnectSpeakerAudio = useCallback((audioStreamer: AudioStreamer) => {
    try {
      // Disconnect the specific gainNode from the AudioStreamer
      if (connectedAudioNodesRef.current.has(audioStreamer.gainNode)) {
        if (independentRecorderRef.current) {
          independentRecorderRef.current.disconnectSpeakerAudio(audioStreamer.gainNode);
        }
        connectedAudioNodesRef.current.delete(audioStreamer.gainNode);
        console.log('Speaker audio disconnected from independent recording');
      }
    } catch (error) {
      console.error('Failed to disconnect speaker audio:', error);
    }
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (statusUpdateIntervalRef.current) {
        clearInterval(statusUpdateIntervalRef.current);
      }
      
      // Stop recording if active
      if (isRecording && currentRecordingIdRef.current && independentRecorderRef.current) {
        independentRecorderRef.current.stopRecording().catch(console.error);
      }
      
      // Disconnect all audio nodes
      connectedAudioNodesRef.current.forEach(node => {
        try {
          if (independentRecorderRef.current) {
            independentRecorderRef.current.disconnectSpeakerAudio(node);
          }
        } catch (error) {
          console.warn('Error disconnecting audio node on cleanup:', error);
        }
      });
    };
  }, [isRecording]);

  return {
    isRecording,
    startRecording,
    stopRecording,
    connectSpeakerAudio,
    disconnectSpeakerAudio,
    recordingStatus,
    error,
    clearError
  };
}