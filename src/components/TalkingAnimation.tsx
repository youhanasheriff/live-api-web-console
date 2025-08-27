/**
 * Talking Animation Component
 * SVG animation that plays while AI audio is being played
 */

import React from 'react';
import { useHybridPipeline } from '../contexts/HybridPipelineContext';

export function TalkingAnimation() {
  const { state } = useHybridPipeline();
  const { isPlayingAudio, isConnected } = state;

  return (
    <div className={`talking-animation ${isPlayingAudio ? 'active' : ''} ${isConnected ? 'connected' : ''}`}>
      <svg 
        width="200" 
        height="200" 
        viewBox="0 0 200 200" 
        className="avatar-svg"
      >
        {/* Background circle */}
        <circle 
          cx="100" 
          cy="100" 
          r="90" 
          fill="url(#backgroundGradient)" 
          className="background-circle"
        />
        
        {/* Face outline */}
        <ellipse 
          cx="100" 
          cy="95" 
          rx="60" 
          ry="65" 
          fill="url(#faceGradient)" 
          className="face"
        />
        
        {/* Eyes */}
        <circle 
          cx="85" 
          cy="80" 
          r="6" 
          fill="#2c3e50" 
          className="eye left-eye"
        />
        <circle 
          cx="115" 
          cy="80" 
          r="6" 
          fill="#2c3e50" 
          className="eye right-eye"
        />
        
        {/* Eye highlights */}
        <circle 
          cx="87" 
          cy="78" 
          r="2" 
          fill="#ffffff" 
          className="eye-highlight"
        />
        <circle 
          cx="117" 
          cy="78" 
          r="2" 
          fill="#ffffff" 
          className="eye-highlight"
        />
        
        {/* Nose */}
        <ellipse 
          cx="100" 
          cy="95" 
          rx="3" 
          ry="5" 
          fill="#d4a574" 
          className="nose"
        />
        
        {/* Mouth - changes shape when talking */}
        <g className="mouth-group">
          {/* Closed mouth (default) */}
          <ellipse 
            cx="100" 
            cy="115" 
            rx="15" 
            ry="3" 
            fill="#8b4513" 
            className="mouth closed"
          />
          
          {/* Open mouth (talking) */}
          <ellipse 
            cx="100" 
            cy="115" 
            rx="12" 
            ry="8" 
            fill="#2c1810" 
            className="mouth open"
          />
          
          {/* Teeth */}
          <rect 
            x="92" 
            y="110" 
            width="16" 
            height="3" 
            fill="#ffffff" 
            rx="1" 
            className="teeth"
          />
        </g>
        
        {/* Sound waves (visible when talking) */}
        <g className="sound-waves">
          <path 
            d="M 140 115 Q 150 105 150 115 Q 150 125 140 115" 
            stroke="#4CAF50" 
            strokeWidth="2" 
            fill="none" 
            className="wave wave-1"
          />
          <path 
            d="M 150 115 Q 165 100 165 115 Q 165 130 150 115" 
            stroke="#4CAF50" 
            strokeWidth="2" 
            fill="none" 
            className="wave wave-2"
          />
          <path 
            d="M 165 115 Q 185 95 185 115 Q 185 135 165 115" 
            stroke="#4CAF50" 
            strokeWidth="2" 
            fill="none" 
            className="wave wave-3"
          />
        </g>
        
        {/* Connection indicator */}
        <circle 
          cx="170" 
          cy="50" 
          r="8" 
          fill="url(#statusGradient)" 
          className="status-indicator"
        />
        
        {/* Gradients */}
        <defs>
          <radialGradient id="backgroundGradient" cx="0.3" cy="0.3">
            <stop offset="0%" stopColor="rgba(255,255,255,0.1)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.05)" />
          </radialGradient>
          
          <linearGradient id="faceGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f4d1a6" />
            <stop offset="100%" stopColor="#e8c4a0" />
          </linearGradient>
          
          <radialGradient id="statusGradient" cx="0.3" cy="0.3">
            <stop offset="0%" stopColor="#4CAF50" className="status-stop-1" />
            <stop offset="100%" stopColor="#2E7D32" className="status-stop-2" />
          </radialGradient>
        </defs>
      </svg>
      
      <div className="animation-status">
        <div className="status-text">
          {isPlayingAudio ? 'AI Speaking...' : isConnected ? 'Listening' : 'Disconnected'}
        </div>
        
        {isPlayingAudio && (
          <div className="audio-visualizer">
            <div className="bar"></div>
            <div className="bar"></div>
            <div className="bar"></div>
            <div className="bar"></div>
            <div className="bar"></div>
          </div>
        )}
      </div>
    </div>
  );
}