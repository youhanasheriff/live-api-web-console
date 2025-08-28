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

import React from 'react';
import { HybridPipelineProvider } from './contexts/HybridPipelineContext';
import { TranscriptionDisplay } from './components/TranscriptionDisplay';
import { ChatHistory } from './components/ChatHistory';
import { TalkingAnimation } from './components/TalkingAnimation';
import HybridControlTray from './components/HybridControlTray';

function SimpleApp() {
  return (
    <div className="App">
      <HybridPipelineProvider>
        <div className="hybrid-console">
          <header className="app-header">
            <h1>AI Voice Assistant</h1>
            <p>Hybrid STT → Gemini → TTS Pipeline</p>
          </header>

          <main className="main-content">
            <div className="left-panel">
              <TalkingAnimation />
              <HybridControlTray />
            </div>

            <div className="right-panel">
              <TranscriptionDisplay />
              <ChatHistory />
            </div>
          </main>
        </div>
      </HybridPipelineProvider>
    </div>
  );
}

export default SimpleApp;
