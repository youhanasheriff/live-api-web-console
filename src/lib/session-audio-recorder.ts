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
import { AudioRecorder } from './audio-recorder';
import { AudioStreamer } from './audio-streamer';
import { audioContext } from './utils';

export interface SessionAudioData {
  sessionId: string;
  startTime: Date;
  endTime?: Date;
  audioBlob: Blob;
  duration: number;
  sampleRate: number;
}

export interface SessionRecordingOptions {
  sampleRate?: number;
  mimeType?: string;
  audioBitsPerSecond?: number;
}

/**
 * SessionAudioRecorder - Records complete chat sessions including both
 * microphone input and speaker output as a single continuous audio file
 */
export class SessionAudioRecorder extends EventEmitter {
  private mediaRecorder: MediaRecorder | null = null;
  private audioContext: AudioContext | null = null;
  private microphoneSource: MediaStreamAudioSourceNode | null = null;
  private speakerDestination: MediaStreamAudioDestinationNode | null = null;
  private mixerGain: GainNode | null = null;
  private microphoneGain: GainNode | null = null;
  private speakerGain: GainNode | null = null;
  private recordedChunks: Blob[] = [];
  private isRecording = false;
  private sessionId: string | null = null;
  private startTime: Date | null = null;
  private options: SessionRecordingOptions;

  constructor(options: SessionRecordingOptions = {}) {
    super();
    this.options = {
      sampleRate: 24000,
      mimeType: 'audio/webm;codecs=opus',
      audioBitsPerSecond: 128000,
      ...options
    };
  }

  /**
   * Start recording a new session
   */
  async startRecording(sessionId: string): Promise<void> {
    if (this.isRecording) {
      throw new Error('Recording already in progress');
    }

    try {
      this.sessionId = sessionId;
      this.startTime = new Date();
      this.recordedChunks = [];

      // Create audio context
      this.audioContext = await audioContext({ 
        sampleRate: this.options.sampleRate,
        id: 'session-recorder'
      });

      // Get microphone stream
      const microphoneStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: this.options.sampleRate,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        }
      });

      // Create audio nodes for mixing
      this.microphoneSource = this.audioContext.createMediaStreamSource(microphoneStream);
      this.speakerDestination = this.audioContext.createMediaStreamDestination();
      this.mixerGain = this.audioContext.createGain();
      this.microphoneGain = this.audioContext.createGain();
      this.speakerGain = this.audioContext.createGain();

      // Set gain levels (adjust as needed)
      this.microphoneGain.gain.value = 1.0; // Full microphone volume
      this.speakerGain.gain.value = 0.8; // Slightly reduced speaker volume to avoid feedback
      this.mixerGain.gain.value = 1.0;

      // Connect microphone to mixer
      this.microphoneSource.connect(this.microphoneGain);
      this.microphoneGain.connect(this.mixerGain);

      // Connect speaker audio to mixer (this will be connected when audio streamer is available)
      this.speakerGain.connect(this.mixerGain);

      // Connect mixer to destination
      this.mixerGain.connect(this.speakerDestination);

      // Create MediaRecorder with the mixed stream
      const mixedStream = this.speakerDestination.stream;
      
      if (!MediaRecorder.isTypeSupported(this.options.mimeType!)) {
        console.warn(`MIME type ${this.options.mimeType} not supported, falling back to default`);
        this.mediaRecorder = new MediaRecorder(mixedStream);
      } else {
        this.mediaRecorder = new MediaRecorder(mixedStream, {
          mimeType: this.options.mimeType,
          audioBitsPerSecond: this.options.audioBitsPerSecond
        });
      }

      // Handle recorded data
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        this.handleRecordingStop();
      };

      this.mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        this.emit('error', event);
      };

      // Start recording
      this.mediaRecorder.start(1000); // Collect data every second
      this.isRecording = true;

      console.log(`Session audio recording started for session: ${sessionId}`);
      this.emit('recording-started', { sessionId, startTime: this.startTime });

    } catch (error) {
      console.error('Failed to start session recording:', error);
      this.cleanup();
      throw error;
    }
  }

  /**
   * Connect speaker audio source to the recording mixer
   */
  connectSpeakerAudio(audioNode: AudioNode): void {
    if (!this.isRecording || !this.speakerGain) {
      console.warn('Cannot connect speaker audio: recording not active');
      return;
    }

    try {
      audioNode.connect(this.speakerGain);
      console.log('Speaker audio connected to session recorder');
    } catch (error) {
      console.error('Failed to connect speaker audio:', error);
    }
  }

  /**
   * Disconnect speaker audio source from the recording mixer
   */
  disconnectSpeakerAudio(audioNode: AudioNode): void {
    if (!this.speakerGain) {
      return;
    }

    try {
      audioNode.disconnect(this.speakerGain);
      console.log('Speaker audio disconnected from session recorder');
    } catch (error) {
      console.error('Failed to disconnect speaker audio:', error);
    }
  }

  /**
   * Stop recording and return the session audio data
   */
  async stopRecording(): Promise<SessionAudioData | null> {
    if (!this.isRecording || !this.mediaRecorder) {
      console.warn('No active recording to stop');
      return null;
    }

    return new Promise((resolve) => {
      const handleStop = () => {
        const endTime = new Date();
        const duration = this.startTime ? endTime.getTime() - this.startTime.getTime() : 0;

        if (this.recordedChunks.length === 0) {
          console.warn('No audio data recorded');
          resolve(null);
          return;
        }

        const audioBlob = new Blob(this.recordedChunks, {
          type: this.options.mimeType
        });

        const sessionAudioData: SessionAudioData = {
          sessionId: this.sessionId!,
          startTime: this.startTime!,
          endTime,
          audioBlob,
          duration,
          sampleRate: this.options.sampleRate!
        };

        console.log(`Session audio recording completed: ${duration}ms, ${audioBlob.size} bytes`);
        this.emit('recording-completed', sessionAudioData);
        
        this.cleanup();
        resolve(sessionAudioData);
      };

      // Set up one-time listener for stop event
      this.mediaRecorder!.addEventListener('stop', handleStop, { once: true });
      
      // Stop the recording
      this.mediaRecorder!.stop();
      this.isRecording = false;
    });
  }

  /**
   * Handle recording stop event
   */
  private handleRecordingStop(): void {
    console.log('MediaRecorder stopped');
  }

  /**
   * Clean up resources
   */
  private cleanup(): void {
    if (this.microphoneSource) {
      this.microphoneSource.disconnect();
      this.microphoneSource = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.speakerDestination = null;
    this.mixerGain = null;
    this.microphoneGain = null;
    this.speakerGain = null;
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.sessionId = null;
    this.startTime = null;
    this.isRecording = false;
  }

  /**
   * Get current recording status
   */
  getRecordingStatus(): {
    isRecording: boolean;
    sessionId: string | null;
    startTime: Date | null;
    duration: number;
  } {
    const duration = this.startTime ? Date.now() - this.startTime.getTime() : 0;
    
    return {
      isRecording: this.isRecording,
      sessionId: this.sessionId,
      startTime: this.startTime,
      duration
    };
  }

  /**
   * Save session audio data to file
   */
  static saveSessionAudio(sessionAudioData: SessionAudioData, filename?: string): void {
    const defaultFilename = `session_${sessionAudioData.sessionId}_${sessionAudioData.startTime.toISOString().replace(/[:.]/g, '-')}.webm`;
    const finalFilename = filename || defaultFilename;

    const url = URL.createObjectURL(sessionAudioData.audioBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = finalFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    console.log(`Session audio saved as: ${finalFilename}`);
  }
}

// Export singleton instance
export const sessionAudioRecorder = new SessionAudioRecorder();