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
  private audioChunks: string[] = [];
  private isRecording = false;
  private recordingStartTime: number = 0;

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
    this.audioChunks = [];
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
    const endedSession = chatHistoryStorage.endSession(sessionId);

    if (endedSession) {
      this.isRecording = false;

      // Save complete audio recording if we have chunks
      if (this.audioChunks.length > 0) {
        const audioData = this.combineAudioChunks();
        // Calculate duration in seconds
        const duration = Math.round((Date.now() - this.recordingStartTime) / 1000);

        chatHistoryStorage.updateSessionAudioRecording(sessionId, {
          data: audioData,
          mimeType: 'audio/pcm;rate=16000',
          duration,
        });
      }

      console.log('Chat session ended:', sessionId);
      this.emit('session:ended', endedSession);

      // Auto-transcribe if enabled
      const settings = chatHistoryStorage.getSettings();
      if (settings.autoTranscribe && this.audioChunks.length > 0) {
        this.requestTranscription(sessionId);
      }
    }

    this.currentSession = null;
    this.audioChunks = [];

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
      this.audioChunks.push(audioData);
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

    if (!session.audioRecording.data || session.audioRecording.data.length === 0) {
      console.warn('Empty audio data for session:', sessionId);
      this.emit('transcription:failed', sessionId, 'Empty audio data');
      return;
    }

    console.log('Starting transcription for session:', sessionId, 'Audio data length:', session.audioRecording.data.length);
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
  private combineAudioChunks(): string {
    if (this.audioChunks.length === 0) {
      return '';
    }

    try {
      // Convert each base64 chunk to binary data
      const binaryChunks = this.audioChunks.map(chunk => {
        // Remove any data URL prefixes if present
        const cleanChunk = chunk.replace(/^data:audio\/[^;]+;base64,/, '');
        const binaryString = atob(cleanChunk);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes;
      });

      // Calculate total length
      const totalLength = binaryChunks.reduce(
        (sum, chunk) => sum + chunk.length,
        0
      );

      // Combine all chunks into a single array
      const combinedArray = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of binaryChunks) {
        combinedArray.set(chunk, offset);
        offset += chunk.length;
      }

      // Convert back to base64
      let binaryString = '';
      for (let i = 0; i < combinedArray.length; i++) {
        binaryString += String.fromCharCode(combinedArray[i]);
      }
      return btoa(binaryString);
    } catch (error) {
      console.error('Error combining audio chunks:', error);
      return '';
    }
  }

  /**
   * Setup event listeners for LiveAPI client
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
          const audioData = audioParts
            .map(part => part.inlineData?.data)
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
