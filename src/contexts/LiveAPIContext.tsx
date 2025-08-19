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

import { createContext, FC, ReactNode, useContext, useEffect } from "react";
import { useLiveAPI, UseLiveAPIResults } from "../hooks/use-live-api";
import { useIndependentAudioRecording } from "../hooks/use-independent-audio-recording";
import type { UseIndependentAudioRecordingResults } from "../hooks/use-independent-audio-recording";
import { useSessionAudioManager } from "../hooks/use-session-audio-manager";
import type { UseSessionAudioManagerResults } from "../hooks/use-session-audio-manager";
import { LiveClientOptions } from "../types";

interface LiveAPIContextValue extends UseLiveAPIResults {
  independentAudioRecording: UseIndependentAudioRecordingResults;
  sessionAudioManager: UseSessionAudioManagerResults;
}

const LiveAPIContext = createContext<LiveAPIContextValue | undefined>(undefined);

export type LiveAPIProviderProps = {
  children: ReactNode;
  options: LiveClientOptions;
};

export const LiveAPIProvider: FC<LiveAPIProviderProps> = ({
  options,
  children,
}) => {
  const liveAPI = useLiveAPI(options);
  const independentAudioRecording = useIndependentAudioRecording();
  const sessionAudioManager = useSessionAudioManager({
    autoSave: true,
    sampleRate: 24000,
    mimeType: 'audio/webm;codecs=opus',
    audioBitsPerSecond: 128000
  });

  // Connect speaker audio when available and recording is active (independent of session state)
  useEffect(() => {
    if (liveAPI.audioStreamer && independentAudioRecording.isRecording) {
      independentAudioRecording.connectSpeakerAudio(liveAPI.audioStreamer);
      
      return () => {
        if (liveAPI.audioStreamer) {
          independentAudioRecording.disconnectSpeakerAudio(liveAPI.audioStreamer);
        }
      };
    }
  }, [liveAPI.audioStreamer, independentAudioRecording.isRecording, independentAudioRecording]);

  // Automatically manage session recording based on connection state
  useEffect(() => {
    if (liveAPI.connected && !sessionAudioManager.isRecording) {
      // Start session recording when connected
      const sessionId = `call-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
      sessionAudioManager.startSession(sessionId).then((startedSessionId) => {
        if (startedSessionId) {
          console.log('Auto-started session recording:', startedSessionId);
        }
      }).catch((error) => {
        console.error('Failed to auto-start session recording:', error);
      });
    } else if (!liveAPI.connected && sessionAudioManager.isRecording) {
      // Stop session recording when disconnected
      sessionAudioManager.stopSession().then((sessionData) => {
        if (sessionData) {
          console.log('Auto-stopped session recording:', sessionData.sessionId);
        }
      }).catch((error) => {
        console.error('Failed to auto-stop session recording:', error);
      });
    }
  }, [liveAPI.connected, sessionAudioManager]);

  // Connect/disconnect speaker audio for session recording
  useEffect(() => {
    if (liveAPI.audioStreamer && sessionAudioManager.isRecording) {
      sessionAudioManager.connectSpeaker(liveAPI.audioStreamer);
      
      return () => {
        if (liveAPI.audioStreamer) {
          sessionAudioManager.disconnectSpeaker(liveAPI.audioStreamer);
        }
      };
    }
  }, [liveAPI.audioStreamer, sessionAudioManager.isRecording, sessionAudioManager]);

  const contextValue: LiveAPIContextValue = {
    ...liveAPI,
    independentAudioRecording,
    sessionAudioManager
  };

  return (
    <LiveAPIContext.Provider value={contextValue}>
      {children}
    </LiveAPIContext.Provider>
  );
};

export const useLiveAPIContext = () => {
  const context = useContext(LiveAPIContext);
  if (!context) {
    throw new Error("useLiveAPIContext must be used wihin a LiveAPIProvider");
  }
  return context;
};
