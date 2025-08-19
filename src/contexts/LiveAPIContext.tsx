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

import { createContext, FC, ReactNode, useContext } from "react";
import { useLiveAPI, UseLiveAPIResults } from "../hooks/use-live-api";
import { useChatSession } from "../hooks/use-chat-session";
import type { UseChatSessionResults } from "../hooks/use-chat-session";
import { LiveClientOptions } from "../types";

interface LiveAPIContextValue extends UseLiveAPIResults {
  chatSession: UseChatSessionResults;
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
  const chatSession = useChatSession(liveAPI.connected, liveAPI.model);

  const contextValue: LiveAPIContextValue = {
    ...liveAPI,
    chatSession
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
