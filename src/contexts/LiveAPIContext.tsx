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

import { createContext, FC, ReactNode, useContext, useEffect } from 'react';
import { useLiveAPI, UseLiveAPIResults } from '../hooks/use-live-api';
import { useChatHistory } from './ChatHistoryContext';
import { LiveClientOptions } from '../types';

const LiveAPIContext = createContext<UseLiveAPIResults | undefined>(undefined);

export type LiveAPIProviderProps = {
  children: ReactNode;
  options: LiveClientOptions;
};

export const LiveAPIProvider: FC<LiveAPIProviderProps> = ({
  options,
  children,
}) => {
  const chatHistory = useChatHistory();

  const liveAPI = useLiveAPI(options, {
    onContent: content => {
      if (chatHistory && content.modelTurn?.parts) {
        const textParts = content.modelTurn.parts.filter(
          (part: any) => part.text
        );
        if (textParts.length > 0) {
          const message = textParts.map((part: any) => part.text).join(' ');
          chatHistory.addAssistantMessage({ text: message });
        }
      }
    },
    onToolCall: toolCall => {
      // Handle tool calls if needed for chat history
      console.log('Tool call:', toolCall);
    },
    onAIAudioChunk: audioData => {
      if (chatHistory) {
        chatHistory.recordAIAudioChunk(audioData);
      }
    },
  });

  // Handle connection state changes for chat history
  useEffect(() => {
    if (liveAPI.connected && !chatHistory?.currentSession) {
      // Start new session when connected
      chatHistory?.startSession();
    } else if (!liveAPI.connected && chatHistory?.currentSession) {
      // End session when disconnected and request transcription
      const endSessionAsync = async () => {
        chatHistory?.endSession();
        // Automatically request transcription when session ends
        if (
          chatHistory?.settings.autoTranscribe &&
          chatHistory?.currentSession
        ) {
          await chatHistory?.requestTranscription(
            chatHistory.currentSession.id
          );
        }
      };
      endSessionAsync();
    }
  }, [liveAPI.connected, chatHistory]);

  // Initialize chat history manager with LiveAPI client
  useEffect(() => {
    if (liveAPI.client && chatHistory) {
      // Setup LiveAPI listeners through chat history manager
      const chatHistoryManager =
        require('../services/chat-history-manager').chatHistoryManager;
      chatHistoryManager.setupLiveAPIListeners(liveAPI.client);
    }
  }, [liveAPI.client, chatHistory]);

  return (
    <LiveAPIContext.Provider value={liveAPI}>
      {children}
    </LiveAPIContext.Provider>
  );
};

export const useLiveAPIContext = () => {
  const context = useContext(LiveAPIContext);
  if (!context) {
    throw new Error('useLiveAPIContext must be used wihin a LiveAPIProvider');
  }
  return context;
};
