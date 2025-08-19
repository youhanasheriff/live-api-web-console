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

import { createContext, FC, ReactNode, useContext, useEffect, useRef } from "react";
import { useLiveAPI, UseLiveAPIResults } from "../hooks/use-live-api";
import { useContinuousSession } from "../hooks/use-continuous-session";
import type { UseContinuousSessionResults } from "../hooks/use-continuous-session";
import { useIndependentAudioRecording } from "../hooks/use-independent-audio-recording";
import type { UseIndependentAudioRecordingResults } from "../hooks/use-independent-audio-recording";
import { LiveClientOptions } from "../types";

interface LiveAPIContextValue extends UseLiveAPIResults {
  continuousSession: UseContinuousSessionResults;
  independentAudioRecording: UseIndependentAudioRecordingResults;
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
  const continuousSession = useContinuousSession(liveAPI.model);
  const independentAudioRecording = useIndependentAudioRecording();
  const audioStreamerRef = useRef<any>(null);

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

  const contextValue: LiveAPIContextValue = {
    ...liveAPI,
    continuousSession,
    independentAudioRecording
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
