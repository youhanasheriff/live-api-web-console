/**
 * Chat History Context
 * Provides chat history functionality throughout the application
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import { ChatSession, ChatMessage } from '../types/chat-history';
import { chatHistoryManager } from '../services/chat-history-manager';
// Removed useLiveAPIContext import to avoid circular dependency

interface ChatHistoryContextType {
  // Current session
  currentSession: ChatSession | null;

  // Session management
  startSession: () => void;
  endSession: () => void;

  // Message management
  addUserMessage: (
    content: ChatMessage['content'],
    metadata?: ChatMessage['metadata']
  ) => ChatMessage | null;
  addAssistantMessage: (
    content: ChatMessage['content'],
    metadata?: ChatMessage['metadata']
  ) => ChatMessage | null;

  // Audio recording
  recordAudioChunk: (audioData: string) => void;
  recordAIAudioChunk: (audioData: string) => void;
  recordVideoFrame: (videoData: string, timestamp: number) => void;
  startUserUtterance: () => void;
  endUserUtterance: () => Promise<void>;
  startAIUtterance: () => void;
  endAIUtterance: () => Promise<void>;

  // Session history
  allSessions: ChatSession[];
  getSession: (sessionId: string) => ChatSession | null;
  deleteSession: (sessionId: string) => boolean;
  exportSession: (sessionId: string) => string | null;

  // Transcription
  requestTranscription: (sessionId: string) => Promise<void>;

  // Settings
  settings: ReturnType<typeof chatHistoryManager.getSettings>;
  updateSettings: (
    settings: Parameters<typeof chatHistoryManager.updateSettings>[0]
  ) => void;

  // Storage stats
  storageStats: ReturnType<typeof chatHistoryManager.getStorageStats>;

  // Events
  isTranscribing: boolean;
  transcriptionError: string | null;
}

const ChatHistoryContext = createContext<ChatHistoryContextType | undefined>(
  undefined
);

export interface ChatHistoryProviderProps {
  children: ReactNode;
}

export const ChatHistoryProvider: React.FC<ChatHistoryProviderProps> = ({
  children,
}) => {
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(
    null
  );
  const [allSessions, setAllSessions] = useState<ChatSession[]>([]);
  const [settings, setSettings] = useState(chatHistoryManager.getSettings());
  const [storageStats, setStorageStats] = useState(
    chatHistoryManager.getStorageStats()
  );
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionError, setTranscriptionError] = useState<string | null>(
    null
  );

  // LiveAPI client setup will be handled by the LiveAPIProvider

  // Update current session when it changes
  useEffect(() => {
    const updateCurrentSession = () => {
      setCurrentSession(chatHistoryManager.getCurrentSession());
      setAllSessions(chatHistoryManager.getAllSessions());
      setStorageStats(chatHistoryManager.getStorageStats());
    };

    // Set up event listeners
    const handleSessionStarted = (session: ChatSession) => {
      setCurrentSession(session);
      setAllSessions(chatHistoryManager.getAllSessions());
    };

    const handleSessionEnded = (session: ChatSession) => {
      setCurrentSession(null);
      setAllSessions(chatHistoryManager.getAllSessions());
      setStorageStats(chatHistoryManager.getStorageStats());
    };

    const handleMessageAdded = (message: ChatMessage, sessionId: string) => {
      // Update the current session if it's the active one
      if (currentSession && currentSession.id === sessionId) {
        setCurrentSession({
          ...currentSession,
          messages: [...currentSession.messages, message],
        });
      }
      setAllSessions(chatHistoryManager.getAllSessions());
    };

    const handleTranscriptionStarted = (sessionId: string) => {
      setIsTranscribing(true);
      setTranscriptionError(null);
    };

    const handleTranscriptionCompleted = (sessionId: string) => {
      setIsTranscribing(false);
      setAllSessions(chatHistoryManager.getAllSessions());
    };

    const handleTranscriptionFailed = (sessionId: string, error: string) => {
      setIsTranscribing(false);
      setTranscriptionError(error);
    };

    chatHistoryManager.on('session:started', handleSessionStarted);
    chatHistoryManager.on('session:ended', handleSessionEnded);
    chatHistoryManager.on('message:added', handleMessageAdded);
    chatHistoryManager.on('transcription:started', handleTranscriptionStarted);
    chatHistoryManager.on(
      'transcription:completed',
      handleTranscriptionCompleted
    );
    chatHistoryManager.on('transcription:failed', handleTranscriptionFailed);

    // Initial update
    updateCurrentSession();

    return () => {
      chatHistoryManager.off('session:started', handleSessionStarted);
      chatHistoryManager.off('session:ended', handleSessionEnded);
      chatHistoryManager.off('message:added', handleMessageAdded);
      chatHistoryManager.off(
        'transcription:started',
        handleTranscriptionStarted
      );
      chatHistoryManager.off(
        'transcription:completed',
        handleTranscriptionCompleted
      );
      chatHistoryManager.off('transcription:failed', handleTranscriptionFailed);
    };
  }, [currentSession]);

  // Connection state changes will be handled by LiveAPIProvider

  const startSession = () => {
    // Model and config will be passed from LiveAPIProvider when needed
    const session = chatHistoryManager.startSession('gemini-2.0-flash-exp', {});
    setCurrentSession(session);
  };

  const endSession = () => {
    const endedSession = chatHistoryManager.endSession();
    if (endedSession) {
      setCurrentSession(null);
    }
  };

  const addUserMessage = (
    content: ChatMessage['content'],
    metadata?: ChatMessage['metadata']
  ) => {
    return chatHistoryManager.addUserMessage(content, metadata);
  };

  const addAssistantMessage = (
    content: ChatMessage['content'],
    metadata?: ChatMessage['metadata']
  ) => {
    return chatHistoryManager.addAssistantMessage(content, metadata);
  };

  const recordAudioChunk = (audioData: string) => {
    chatHistoryManager.recordAudioChunk(audioData);
  };

  const recordAIAudioChunk = (audioData: string) => {
    chatHistoryManager.recordAIAudioChunk(audioData);
  };

  const recordVideoFrame = (videoData: string, timestamp: number) => {
    chatHistoryManager.recordVideoFrame(videoData, timestamp);
  };

  const getSession = (sessionId: string) => {
    return chatHistoryManager.getSession(sessionId);
  };

  const deleteSession = (sessionId: string) => {
    const success = chatHistoryManager.deleteSession(sessionId);
    if (success) {
      setAllSessions(chatHistoryManager.getAllSessions());
      setStorageStats(chatHistoryManager.getStorageStats());
    }
    return success;
  };

  const exportSession = (sessionId: string) => {
    return chatHistoryManager.exportSession(sessionId);
  };

  const requestTranscription = async (sessionId: string) => {
    await chatHistoryManager.requestTranscription(sessionId);
  };

  const updateSettings = (
    newSettings: Parameters<typeof chatHistoryManager.updateSettings>[0]
  ) => {
    chatHistoryManager.updateSettings(newSettings);
    setSettings(chatHistoryManager.getSettings());
    setStorageStats(chatHistoryManager.getStorageStats());
  };

  const startUserUtterance = () => {
    chatHistoryManager.startUserUtterance();
  };

  const endUserUtterance = async () => {
    await chatHistoryManager.endUserUtterance();
  };

  const startAIUtterance = () => {
    chatHistoryManager.startAIUtterance();
  };

  const endAIUtterance = async () => {
    await chatHistoryManager.endAIUtterance();
  };

  const contextValue: ChatHistoryContextType = {
    currentSession,
    startSession,
    endSession,
    addUserMessage,
    addAssistantMessage,
    recordAudioChunk,
    recordAIAudioChunk,
    recordVideoFrame,
    startUserUtterance,
    endUserUtterance,
    startAIUtterance,
    endAIUtterance,
    allSessions,
    getSession,
    deleteSession,
    exportSession,
    requestTranscription,
    settings,
    updateSettings,
    storageStats,
    isTranscribing,
    transcriptionError,
  };

  return (
    <ChatHistoryContext.Provider value={contextValue}>
      {children}
    </ChatHistoryContext.Provider>
  );
};

export const useChatHistory = (): ChatHistoryContextType => {
  const context = useContext(ChatHistoryContext);
  if (!context) {
    throw new Error('useChatHistory must be used within a ChatHistoryProvider');
  }
  return context;
};
