/**
 * Transcription Display Component
 * Shows live transcriptions and transcription history
 */

import React from 'react';
import { useHybridPipeline } from '../contexts/HybridPipelineContext';

export function TranscriptionDisplay() {
  const { state } = useHybridPipeline();
  const { currentTranscription, transcriptions, isProcessing, vadEnergy, isVoiceActive } = state;

  return (
    <div className="transcription-display">
      <div className="transcription-header">
        <h3>Live Transcription</h3>
        <div className="vad-indicator">
          <div 
            className={`vad-meter ${isVoiceActive ? 'active' : ''}`}
            style={{ '--energy': Math.min(vadEnergy * 100, 100) } as React.CSSProperties}
          >
            <div className="vad-bar"></div>
          </div>
          <span className="vad-status">
            {isVoiceActive ? 'Speaking' : 'Listening'}
          </span>
        </div>
      </div>

      <div className="current-transcription">
        {isProcessing && (
          <div className="processing-indicator">
            <div className="spinner"></div>
            <span>Processing audio...</span>
          </div>
        )}
        
        {currentTranscription && (
          <div className="live-text">
            <span className="live-indicator">●</span>
            {currentTranscription}
          </div>
        )}
        
        {!currentTranscription && !isProcessing && (
          <div className="idle-state">
            {isVoiceActive ? 'Listening...' : 'Start speaking to see transcription'}
          </div>
        )}
      </div>

      <div className="transcription-history">
        <h4>Transcription History</h4>
        <div className="history-list">
          {transcriptions.length === 0 ? (
            <div className="empty-history">
              No transcriptions yet
            </div>
          ) : (
            transcriptions.map((transcription) => (
              <div key={transcription.id} className="transcription-item">
                <div className="transcription-text">
                  {transcription.text}
                </div>
                <div className="transcription-meta">
                  <span className="timestamp">
                    {new Date(transcription.timestamp).toLocaleTimeString()}
                  </span>
                  {transcription.confidence && (
                    <span className="confidence">
                      {Math.round(transcription.confidence * 100)}% confidence
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}