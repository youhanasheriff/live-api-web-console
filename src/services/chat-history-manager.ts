/**
 * Chat History Manager
 * Handles the business logic for recording conversations and managing sessions
 */

import { EventEmitter } from 'eventemitter3';
import {
  ChatSession,
  ChatMessage,
  ChatHistoryEvents,
  TranscriptionRequest,
  TranscriptionResponse,
} from '../types/chat-history';
import { chatHistoryStorage } from './chat-history-storage';
import { TranscriptionService } from './transcription-service';
import { GenAILiveClient } from '../lib/genai-live-client';
import { LiveConnectConfig } from '@google/genai';

export class ChatHistoryManager extends EventEmitter<ChatHistoryEvents> {
  private transcriptionService: TranscriptionService;
  private currentSession: ChatSession | null = null;
  private continuousAudioStream: string = ''; // Single continuous audio stream for entire session
  private continuousUserAudioStream: string = ''; // Continuous user audio stream
  private continuousAIAudioStream: string = ''; // Continuous AI audio stream
  private currentUserAudioChunks: string[] = []; // Temporary chunks for current utterance transcription
  private currentAIAudioChunks: string[] = []; // Temporary chunks for current utterance
  private isRecording = false;
  private isUserSpeaking = false;
  private isAISpeaking = false;
  private recordingStartTime: number = 0;
  private userUtteranceStartTime: number = 0;
  private aiUtteranceStartTime: number = 0;

  constructor() {
    super();
    this.transcriptionService = new TranscriptionService();
    // Resume any active session on initialization
    this.currentSession = chatHistoryStorage.getCurrentSession();
  }

  /**
   * Start a new chat session
   */
  startSession(model: string, config: LiveConnectConfig): ChatSession {
    // End current session if exists
    if (this.currentSession && this.currentSession.status === 'active') {
      this.endSession();
    }

    this.currentSession = chatHistoryStorage.createSession(model, config);
    this.continuousAudioStream = '';
    this.continuousUserAudioStream = '';
    this.continuousAIAudioStream = '';
    this.isRecording = true;
    this.recordingStartTime = Date.now();

    console.log('Chat session started:', this.currentSession.id);
    this.emit('session:started', this.currentSession);

    return this.currentSession;
  }

  /**
   * End the current chat session
   */
  endSession(): ChatSession | null {
    if (!this.currentSession) {
      return null;
    }

    const sessionId = this.currentSession.id;

    // Calculate session duration in seconds
    const sessionDuration = Math.round(
      (Date.now() - this.recordingStartTime) / 1000
    );

    // Check if session is too short (less than 1 second)
    if (sessionDuration < 1) {
      console.log(
        'Session too short, not saving:',
        sessionId,
        'Duration:',
        sessionDuration,
        'seconds'
      );
      // Delete the session from storage since it's too short
      chatHistoryStorage.deleteSession(sessionId);

      // Reset state
      this.currentSession = null;
      this.continuousAudioStream = '';
      this.continuousUserAudioStream = '';
      this.continuousAIAudioStream = '';
      this.currentUserAudioChunks = [];
      this.currentAIAudioChunks = [];
      this.isRecording = false;

      return null;
    }

    const endedSession = chatHistoryStorage.endSession(sessionId);

    if (endedSession) {
      this.isRecording = false;

      // Save complete continuous audio recording
      if (this.continuousAudioStream.length > 0) {
        chatHistoryStorage.updateSessionAudioRecording(sessionId, {
          data: this.continuousAudioStream,
          mimeType: 'audio/pcm;rate=16000',
          duration: sessionDuration,
        });
      }

      // Save separate user audio recording
      if (this.continuousUserAudioStream.length > 0) {
        chatHistoryStorage.updateSessionUserAudioRecording(sessionId, {
          data: this.continuousUserAudioStream,
          mimeType: 'audio/pcm;rate=16000',
          duration: sessionDuration,
        });
      }

      // Save separate AI audio recording
      if (this.continuousAIAudioStream.length > 0) {
        chatHistoryStorage.updateSessionAIAudioRecording(sessionId, {
          data: this.continuousAIAudioStream,
          mimeType: 'audio/pcm;rate=24000',
          duration: sessionDuration,
        });
      }

      console.log(
        'Chat session ended:',
        sessionId,
        'Duration:',
        sessionDuration,
        'seconds'
      );
      this.emit('session:ended', endedSession);

      // Auto-transcribe if enabled
      const settings = chatHistoryStorage.getSettings();
      if (settings.autoTranscribe && this.continuousAudioStream.length > 0) {
        this.requestTranscription(sessionId);
      }
    }

    this.currentSession = null;
    this.continuousAudioStream = '';
    this.continuousUserAudioStream = '';
    this.continuousAIAudioStream = '';
    this.currentUserAudioChunks = [];
    this.currentAIAudioChunks = [];

    return endedSession;
  }

  /**
   * Add a user message to the current session
   */
  addUserMessage(
    content: ChatMessage['content'],
    metadata?: ChatMessage['metadata']
  ): ChatMessage | null {
    if (!this.currentSession) {
      console.warn('No active session to add user message');
      return null;
    }

    const message = chatHistoryStorage.addMessage(this.currentSession.id, {
      timestamp: new Date(),
      type: 'user',
      content,
      metadata,
    });

    if (message) {
      this.emit('message:added', message, this.currentSession.id);
    }

    return message;
  }

  /**
   * Add an assistant message to the current session
   */
  addAssistantMessage(
    content: ChatMessage['content'],
    metadata?: ChatMessage['metadata']
  ): ChatMessage | null {
    if (!this.currentSession) {
      console.warn('No active session to add assistant message');
      return null;
    }

    const message = chatHistoryStorage.addMessage(this.currentSession.id, {
      timestamp: new Date(),
      type: 'assistant',
      content,
      metadata,
    });

    if (message) {
      this.emit('message:added', message, this.currentSession.id);
    }

    return message;
  }

  /**
   * Record audio chunk for the current session
   */
  recordAudioChunk(audioData: string): void {
    if (this.isRecording && this.currentSession) {
      // Properly combine base64 audio data instead of simple concatenation
      this.continuousAudioStream = this.combineBase64AudioData(this.continuousAudioStream, audioData);

      // Also record for current user utterance
      if (this.isUserSpeaking) {
        this.currentUserAudioChunks.push(audioData);
        this.continuousUserAudioStream = this.combineBase64AudioData(this.continuousUserAudioStream, audioData);
      }
    }
  }

  /**
   * Record AI audio chunk for the current session
   */
  recordAIAudioChunk(audioData: string): void {
    if (this.isRecording && this.currentSession) {
      // Properly combine base64 audio data instead of simple concatenation
      this.continuousAudioStream = this.combineBase64AudioData(this.continuousAudioStream, audioData);

      // Also record for current AI utterance
      if (this.isAISpeaking) {
        this.currentAIAudioChunks.push(audioData);
        this.continuousAIAudioStream = this.combineBase64AudioData(this.continuousAIAudioStream, audioData);
      }
    }
  }

  /**
   * Start recording a new user utterance
   */
  startUserUtterance(): void {
    if (this.currentSession) {
      this.isUserSpeaking = true;
      this.currentUserAudioChunks = [];
      this.userUtteranceStartTime = Date.now();
      console.log('Started user utterance recording');
    }
  }

  /**
   * End current user utterance and transcribe it
   */
  async endUserUtterance(): Promise<void> {
    if (!this.currentSession || !this.isUserSpeaking) {
      return;
    }

    this.isUserSpeaking = false;

    if (this.currentUserAudioChunks.length > 0) {
      console.log(
        'Ending user utterance, audio chunks:',
        this.currentUserAudioChunks.length
      );

      // Combine audio chunks for this utterance
      const utteranceAudioData = this.combineUserAudioChunks();
      const duration = Math.round(
        (Date.now() - this.userUtteranceStartTime) / 1000
      );

      // Create user message with audio content
      const userMessage = this.addUserMessage({
        audio: {
          data: utteranceAudioData,
          mimeType: 'audio/pcm;rate=16000',
          duration,
        },
      });

      // Auto-transcribe the utterance if enabled
      const settings = chatHistoryStorage.getSettings();
      if (settings.autoTranscribe && userMessage) {
        try {
          const transcriptionRequest: TranscriptionRequest = {
            sessionId: this.currentSession.id,
            audioData: utteranceAudioData,
            mimeType: 'audio/pcm;rate=16000',
            language: 'en',
          };

          const response = await this.callTranscriptionService(
            transcriptionRequest
          );

          if (!response.error && response.text.trim()) {
            // Update the user message with transcribed text
            userMessage.content.text = response.text.trim();
            chatHistoryStorage.addMessage(this.currentSession.id, userMessage);
            console.log('User utterance transcribed:', response.text.trim());
          }
        } catch (error) {
          console.error('Failed to transcribe user utterance:', error);
        }
      }
    }

    this.currentUserAudioChunks = [];
  }

  /**
   * Start recording a new AI utterance
   */
  startAIUtterance(): void {
    if (this.currentSession) {
      this.isAISpeaking = true;
      this.currentAIAudioChunks = [];
      this.aiUtteranceStartTime = Date.now();
      console.log('Started AI utterance recording');
    }
  }

  /**
   * End current AI utterance and store it
   */
  async endAIUtterance(): Promise<void> {
    if (!this.currentSession || !this.isAISpeaking) {
      return;
    }

    this.isAISpeaking = false;

    if (this.currentAIAudioChunks.length > 0) {
      console.log(
        'Ending AI utterance, audio chunks:',
        this.currentAIAudioChunks.length
      );

      // Combine audio chunks for this utterance
      const utteranceAudioData = this.combineAIAudioChunks();
      const duration = Math.round(
        (Date.now() - this.aiUtteranceStartTime) / 1000
      );

      // Create assistant message with audio content
      this.addAssistantMessage({
        audio: {
          data: utteranceAudioData,
          mimeType: 'audio/pcm;rate=24000',
          duration,
        },
      });
    }

    this.currentAIAudioChunks = [];
  }

  /**
   * Combine AI audio chunks into a single base64 string
   */
  private combineAIAudioChunks(): string {
    if (this.currentAIAudioChunks.length === 0) {
      return '';
    }

    try {
      // Convert each base64 chunk to binary data
      const binaryChunks = this.currentAIAudioChunks.map((chunk, index) => {
        // Remove any data URL prefixes if present
        const cleanChunk = chunk.replace(/^data:audio\/[^;]+;base64,/, '');
        
        // Validate base64 format
        const base64Pattern = /^[A-Za-z0-9+/]*={0,2}$/;
        if (!base64Pattern.test(cleanChunk)) {
          console.warn(`Invalid base64 format in AI audio chunk ${index}:`, cleanChunk.substring(0, 50));
          return new Uint8Array(0); // Return empty array for invalid chunks
        }
        
        let binaryString: string;
        try {
          binaryString = atob(cleanChunk);
        } catch (error) {
          console.warn(`Failed to decode base64 AI audio chunk ${index}:`, error);
          return new Uint8Array(0); // Return empty array for failed decoding
        }
        
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes;
      }).filter(chunk => chunk.length > 0); // Filter out empty chunks

      // Calculate total length
      const totalLength = binaryChunks.reduce(
        (sum, chunk) => sum + chunk.length,
        0
      );

      // Combine all chunks
      const combinedData = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of binaryChunks) {
        combinedData.set(chunk, offset);
        offset += chunk.length;
      }

      // Convert back to base64
      const binaryString = Array.from(combinedData)
        .map(byte => String.fromCharCode(byte))
        .join('');
      return btoa(binaryString);
    } catch (error) {
      console.error('Error combining AI audio chunks:', error);
      return '';
    }
  }

  /**
   * Record video frame for the current session
   */
  recordVideoFrame(videoData: string, timestamp: number): void {
    if (!this.currentSession) return;

    // Add video frame as part of user message content
    // This could be optimized to batch frames or sample at intervals
    const existingMessages = this.currentSession.messages;
    const lastMessage = existingMessages[existingMessages.length - 1];

    // If last message is recent user message, append video to it
    if (
      lastMessage &&
      lastMessage.type === 'user' &&
      Date.now() - lastMessage.timestamp.getTime() < 1000
    ) {
      lastMessage.content.video = {
        data: videoData,
        mimeType: 'image/jpeg',
        timestamp,
      };
      chatHistoryStorage.addMessage(this.currentSession.id, lastMessage);
    }
  }

  /**
   * Get the current active session
   */
  getCurrentSession(): ChatSession | null {
    return this.currentSession;
  }

  /**
   * Get all chat sessions
   */
  getAllSessions(): ChatSession[] {
    return chatHistoryStorage.getAllSessions();
  }

  /**
   * Get a specific session by ID
   */
  getSession(sessionId: string): ChatSession | null {
    return chatHistoryStorage.getSession(sessionId);
  }

  /**
   * Delete a session
   */
  deleteSession(sessionId: string): boolean {
    return chatHistoryStorage.deleteSession(sessionId);
  }

  /**
   * Export session data
   */
  exportSession(sessionId: string): string | null {
    return chatHistoryStorage.exportSession(sessionId);
  }

  /**
   * Request transcription for a session
   */
  async requestTranscription(sessionId: string): Promise<void> {
    const session = chatHistoryStorage.getSession(sessionId);
    if (!session || !session.audioRecording) {
      console.warn('No audio recording found for session:', sessionId);
      this.emit('transcription:failed', sessionId, 'No audio recording found');
      return;
    }

    if (
      !session.audioRecording.data ||
      session.audioRecording.data.length === 0
    ) {
      console.warn('Empty audio data for session:', sessionId);
      this.emit('transcription:failed', sessionId, 'Empty audio data');
      return;
    }

    // Validate base64 format to prevent InvalidCharacterError
    const base64Pattern = /^[A-Za-z0-9+/]*={0,2}$/;
    if (!base64Pattern.test(session.audioRecording.data)) {
      console.warn('Invalid base64 audio data format for session:', sessionId);
      this.emit('transcription:failed', sessionId, 'Invalid audio data format');
      return;
    }

    // Test base64 decoding to catch any encoding issues
    try {
      atob(session.audioRecording.data);
    } catch (error) {
      console.warn('Base64 decoding failed for session:', sessionId, error);
      this.emit('transcription:failed', sessionId, 'Base64 decoding failed');
      return;
    }

    console.log(
      'Starting transcription for session:',
      sessionId,
      'Audio data length:',
      session.audioRecording.data.length
    );
    this.emit('transcription:started', sessionId);

    try {
      const transcriptionRequest: TranscriptionRequest = {
        sessionId,
        audioData: session.audioRecording.data,
        mimeType: session.audioRecording.mimeType,
        language: 'en', // Could be configurable
      };

      const response = await this.callTranscriptionService(
        transcriptionRequest
      );

      if (response.error) {
        throw new Error(response.error);
      }

      const transcription = {
        text: response.text,
        confidence: response.confidence,
        processedAt: new Date(),
        service: 'openai' as const,
      };

      chatHistoryStorage.updateSessionTranscription(sessionId, transcription);
      this.emit('transcription:completed', sessionId, response);

      console.log('Transcription completed for session:', sessionId);
    } catch (error) {
      console.error('Transcription failed:', error);
      this.emit(
        'transcription:failed',
        sessionId,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  /**
   * Call the transcription service
   */
  private async callTranscriptionService(
    request: TranscriptionRequest
  ): Promise<TranscriptionResponse> {
    return await this.transcriptionService.transcribeAudio(request);
  }

  /**
   * Combine audio chunks into a single base64 string
   */
  /**
   * Properly combine two base64 audio data strings
   */
  private combineBase64AudioData(existing: string, newData: string): string {
    if (!existing) {
      return newData;
    }
    if (!newData) {
      return existing;
    }

    try {
      // Clean and validate both base64 strings
      const cleanExisting = existing.replace(/^data:audio\/[^;]+;base64,/, '');
      const cleanNew = newData.replace(/^data:audio\/[^;]+;base64,/, '');
      
      const base64Pattern = /^[A-Za-z0-9+/]*={0,2}$/;
      if (!base64Pattern.test(cleanExisting) || !base64Pattern.test(cleanNew)) {
        console.warn('Invalid base64 format in audio data');
        return existing; // Return existing data if new data is invalid
      }

      // Decode both to binary
      const existingBinary = atob(cleanExisting);
      const newBinary = atob(cleanNew);
      
      // Convert to Uint8Arrays
      const existingBytes = new Uint8Array(existingBinary.length);
      const newBytes = new Uint8Array(newBinary.length);
      
      for (let i = 0; i < existingBinary.length; i++) {
        existingBytes[i] = existingBinary.charCodeAt(i);
      }
      for (let i = 0; i < newBinary.length; i++) {
        newBytes[i] = newBinary.charCodeAt(i);
      }
      
      // Combine the arrays
      const combined = new Uint8Array(existingBytes.length + newBytes.length);
      combined.set(existingBytes, 0);
      combined.set(newBytes, existingBytes.length);
      
      // Convert back to base64
      const combinedBinary = Array.from(combined)
        .map(byte => String.fromCharCode(byte))
        .join('');
      return btoa(combinedBinary);
    } catch (error) {
      console.warn('Error combining base64 audio data:', error);
      return existing; // Return existing data on error
    }
  }

  private combineUserAudioChunks(): string {
    if (this.currentUserAudioChunks.length === 0) {
      return '';
    }

    try {
      // Convert each base64 chunk to binary data
      const binaryChunks = this.currentUserAudioChunks.map((chunk, index) => {
        // Remove any data URL prefixes if present
        const cleanChunk = chunk.replace(/^data:audio\/[^;]+;base64,/, '');
        
        // Validate base64 format
        const base64Pattern = /^[A-Za-z0-9+/]*={0,2}$/;
        if (!base64Pattern.test(cleanChunk)) {
          console.warn(`Invalid base64 format in audio chunk ${index}:`, cleanChunk.substring(0, 50));
          return new Uint8Array(0); // Return empty array for invalid chunks
        }
        
        let binaryString: string;
        try {
          binaryString = atob(cleanChunk);
        } catch (error) {
          console.warn(`Failed to decode base64 audio chunk ${index}:`, error);
          return new Uint8Array(0); // Return empty array for failed decoding
        }
        
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes;
      }).filter(chunk => chunk.length > 0); // Filter out empty chunks

      // Calculate total length
      const totalLength = binaryChunks.reduce(
        (sum, chunk) => sum + chunk.length,
        0
      );

      // Combine all chunks
      const combinedData = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of binaryChunks) {
        combinedData.set(chunk, offset);
        offset += chunk.length;
      }

      // Convert back to base64
      const binaryString = Array.from(combinedData)
        .map(byte => String.fromCharCode(byte))
        .join('');
      return btoa(binaryString);
    } catch (error) {
      console.error('Error combining user audio chunks:', error);
      return '';
    }
  }

  // Note: Old chunk combination methods removed - using continuous streams instead

  /**
   * Setup Live API event listeners for audio recording
   */
  setupLiveAPIListeners(client: GenAILiveClient): void {
    // Listen for content from the server (assistant messages)
    client.on('content', data => {
      if (data.modelTurn && data.modelTurn.parts) {
        const textParts = data.modelTurn.parts
          .filter(part => part.text)
          .map(part => part.text)
          .join(' ');

        if (textParts.trim()) {
          this.addAssistantMessage({
            text: textParts,
          });
        }

        // Handle audio parts
        const audioParts = data.modelTurn.parts.filter(
          part =>
            part.inlineData && part.inlineData.mimeType?.startsWith('audio/')
        );

        if (audioParts.length > 0) {
          // Start AI utterance when we receive the first audio part
          if (!this.isAISpeaking) {
            this.startAIUtterance();
          }

          const audioData = audioParts
            .map(part => {
              // Record each audio chunk for the AI utterance
              if (part.inlineData?.data) {
                this.recordAIAudioChunk(part.inlineData.data);
              }
              return part.inlineData?.data;
            })
            .join('');
          this.addAssistantMessage({
            audio: {
              data: audioData,
              mimeType: audioParts[0].inlineData?.mimeType || 'audio/pcm',
            },
          });
        }
      }
    });

    // Listen for connection events
    client.on('open', () => {
      const config = client.getConfig();
      const model = client.model || 'unknown';
      this.startSession(model, config);
    });

    client.on('close', () => {
      this.endSession();
    });

    // Listen for errors
    client.on('error', error => {
      if (this.currentSession) {
        this.currentSession.status = 'interrupted';
        chatHistoryStorage.endSession(this.currentSession.id);
      }
    });

    // Listen for turn completion events to track user utterances
    client.on('turncomplete', () => {
      console.log('Turn complete - ending user utterance');
      this.endUserUtterance();
      // Also end AI utterance if it's active
      if (this.isAISpeaking) {
        console.log('Turn complete - ending AI utterance');
        this.endAIUtterance();
      }
    });

    // Listen for interruption events
    client.on('interrupted', () => {
      console.log('Turn interrupted - ending user utterance');
      this.endUserUtterance();
      // Also end AI utterance if it's active
      if (this.isAISpeaking) {
        console.log('Turn interrupted - ending AI utterance');
        this.endAIUtterance();
      }
    });
  }

  /**
   * Get storage statistics
   */
  getStorageStats() {
    return chatHistoryStorage.getStorageStats();
  }

  /**
   * Update chat history settings
   */
  updateSettings(
    settings: Parameters<typeof chatHistoryStorage.updateSettings>[0]
  ) {
    chatHistoryStorage.updateSettings(settings);
  }

  /**
   * Get current settings
   */
  getSettings() {
    return chatHistoryStorage.getSettings();
  }
}

// Singleton instance
export const chatHistoryManager = new ChatHistoryManager();
