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
import { useHybridPipeline } from '../contexts/HybridPipelineContext';

const HybridControlTray: React.FC = () => {
  const {
    state: {
      isConnected,
      isListening,
      isMuted,
      isProcessing,
      isPlayingAudio,
    },
    connect,
    disconnect,
    toggleMute,
  } = useHybridPipeline();

  const handleCallToggle = () => {
    if (isConnected) {
      disconnect();
    } else {
      connect();
    }
  };

  const getCallButtonText = () => {
    if (isProcessing) return 'Processing...';
    if (isPlayingAudio) return 'AI Speaking...';
    if (isConnected && isListening) return 'Listening...';
    if (isConnected) return 'Connected';
    return 'Start Call';
  };

  const getCallButtonClass = () => {
    let baseClass = 'call-button';
    if (isConnected) baseClass += ' connected';
    if (isListening) baseClass += ' listening';
    if (isProcessing) baseClass += ' processing';
    if (isPlayingAudio) baseClass += ' playing';
    return baseClass;
  };

  return (
    <div className="hybrid-control-tray">
      <div className="control-buttons">
        <button
          className={getCallButtonClass()}
          onClick={handleCallToggle}
          disabled={isProcessing}
        >
          {isConnected ? (
            <>
              <span className="icon">📞</span>
              <span className="text">{getCallButtonText()}</span>
            </>
          ) : (
            <>
              <span className="icon">🎤</span>
              <span className="text">Start Call</span>
            </>
          )}
        </button>

        {isConnected && (
          <button
            className={`mute-button ${isMuted ? 'muted' : 'unmuted'}`}
            onClick={toggleMute}
            disabled={isProcessing || isPlayingAudio}
          >
            <span className="icon">{isMuted ? '🔇' : '🔊'}</span>
            <span className="text">{isMuted ? 'Unmute' : 'Mute'}</span>
          </button>
        )}
      </div>

      <div className="status-indicators">
        {isConnected && (
          <div className="status-item">
            <span className={`indicator ${isConnected ? 'active' : ''}`}></span>
            <span className="label">Connected</span>
          </div>
        )}
        
        {isConnected && (
          <div className="status-item">
            <span className={`indicator ${isListening && !isMuted ? 'active' : ''}`}></span>
            <span className="label">Listening</span>
          </div>
        )}
        
        {isProcessing && (
          <div className="status-item">
            <span className="indicator processing"></span>
            <span className="label">Processing</span>
          </div>
        )}
        
        {isPlayingAudio && (
          <div className="status-item">
            <span className="indicator playing"></span>
            <span className="label">AI Speaking</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default HybridControlTray;