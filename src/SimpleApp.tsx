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

import React, { useState, useEffect } from 'react';
import { HybridPipelineProvider } from './contexts/HybridPipelineContext';
import { TranscriptionDisplay } from './components/TranscriptionDisplay';
import { ChatHistory } from './components/ChatHistory';
import { TalkingAnimation } from './components/TalkingAnimation';
import HybridControlTray from './components/HybridControlTray';

function SimpleApp() {
  const [error, setError] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);

    // Validate environment variables on client side
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

    if (typeof GEMINI_API_KEY !== 'string' || !GEMINI_API_KEY) {
      setError('GEMINI_API_KEY is not set in environment variables');
      return;
    }

    if (typeof OPENAI_API_KEY !== 'string' || !OPENAI_API_KEY) {
      setError('OPENAI_API_KEY is not set in environment variables');
      return;
    }
  }, []);

  if (!isClient) {
    return (
      <div className="App">
        <div>Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="App error-state">
        <div className="error-message">
          <h2>Configuration Error</h2>
          <p>{error}</p>
          <button onClick={() => setError(null)}>Retry</button>
        </div>
      </div>
    );
  }

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
