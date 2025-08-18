/**
 * Chat History Types and Interfaces
 * Defines the data models for storing and managing conversation history
 */

export interface ChatMessage {
  id: string;
  timestamp: Date;
  type: 'user' | 'assistant';
  content: {
    text?: string;
    audio?: {
      data: string; // base64 encoded audio data
      mimeType: string;
      duration?: number;
    };
    video?: {
      data: string; // base64 encoded video frame
      mimeType: string;
      timestamp: number;
    };
  };
  metadata?: {
    volume?: number;
    confidence?: number;
    processingTime?: number;
  };
}

export interface ChatSession {
  id: string;
  startTime: Date;
  endTime?: Date;
  status: 'active' | 'completed' | 'interrupted';
  messages: ChatMessage[];
  audioRecording?: {
    data: string; // base64 encoded full session audio
    mimeType: string;
    duration: number;
  };
  transcription?: {
    text: string;
    confidence: number;
    processedAt: Date;
    service: 'openai' | 'google' | 'other';
  };
  metadata: {
    model: string;
    config: any; // LiveConnectConfig
    totalMessages: number;
    totalDuration: number;
  };
}

export interface ChatHistoryStorage {
  sessions: ChatSession[];
  currentSessionId?: string;
  settings: {
    maxSessions: number;
    autoTranscribe: boolean;
    retentionDays: number;
    audioQuality: 'low' | 'medium' | 'high';
  };
}

export interface TranscriptionRequest {
  sessionId: string;
  audioData: string;
  mimeType: string;
  language?: string;
}

export interface TranscriptionResponse {
  text: string;
  confidence: number;
  segments?: {
    start: number;
    end: number;
    text: string;
    confidence: number;
  }[];
  error?: string;
}

export interface ChatHistoryEvents {
  'session:started': (session: ChatSession) => void;
  'session:ended': (session: ChatSession) => void;
  'message:added': (message: ChatMessage, sessionId: string) => void;
  'transcription:started': (sessionId: string) => void;
  'transcription:completed': (
    sessionId: string,
    transcription: TranscriptionResponse
  ) => void;
  'transcription:failed': (sessionId: string, error: string) => void;
}
