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
import { UseSessionPlaybackResults, PLAYBACK_SPEEDS } from '../../hooks/use-session-playback';
import './playback-controls.scss';

interface PlaybackControlsProps {
  playback: UseSessionPlaybackResults;
  className?: string;
}

export function PlaybackControls({ playback, className = '' }: PlaybackControlsProps) {
  const { playbackState } = playback;
  const {
    isPlaying,
    isPaused,
    currentIndex,
    totalLogs,
    progress,
    speed,
    session
  } = playbackState;

  if (!session) {
    return null;
  }

  const formatTime = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const formatProgress = (): string => {
    return `${currentIndex}/${totalLogs}`;
  };

  const handleProgressClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const percentage = clickX / rect.width;
    const targetIndex = Math.floor(percentage * totalLogs);
    playback.seekTo(Math.max(0, Math.min(targetIndex, totalLogs - 1)));
  };

  const handleSpeedChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newSpeed = parseFloat(event.target.value);
    playback.setSpeed(newSpeed);
  };

  return (
    <div className={`playback-controls ${className}`}>
      {/* Session Info */}
      <div className="playback-session-info">
        <h4 className="session-title">{session.title}</h4>
        <div className="session-meta">
          <span className="session-duration">
            {formatTime(session.duration)}
          </span>
          <span className="session-logs">
            {formatProgress()} logs
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="playback-progress-container">
        <div 
          className="playback-progress-bar"
          onClick={handleProgressClick}
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          title={`${progress.toFixed(1)}% complete`}
        >
          <div 
            className="playback-progress-fill"
            style={{ width: `${progress}%` }}
          />
          <div 
            className="playback-progress-thumb"
            style={{ left: `${progress}%` }}
          />
        </div>
        <div className="playback-progress-text">
          {progress.toFixed(1)}%
        </div>
      </div>

      {/* Control Buttons */}
      <div className="playback-controls-row">
        <div className="playback-buttons">
          <button
            className="playback-btn playback-btn-skip"
            onClick={playback.skipToPrevious}
            title="Previous significant message"
            disabled={currentIndex === 0}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
            </svg>
          </button>

          <button
            className={`playback-btn playback-btn-main ${
              isPlaying ? 'playing' : isPaused ? 'paused' : 'stopped'
            }`}
            onClick={() => {
              if (isPlaying) {
                playback.pausePlayback();
              } else if (isPaused) {
                playback.resumePlayback();
              } else {
                // This shouldn't happen in normal flow, but handle it
                playback.resumePlayback();
              }
            }}
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z"/>
              </svg>
            )}
          </button>

          <button
            className="playback-btn playback-btn-stop"
            onClick={playback.stopPlayback}
            title="Stop playback"
            disabled={!isPlaying && !isPaused}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 6h12v12H6z"/>
            </svg>
          </button>

          <button
            className="playback-btn playback-btn-skip"
            onClick={playback.skipToNext}
            title="Next significant message"
            disabled={currentIndex >= totalLogs}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
            </svg>
          </button>
        </div>

        {/* Speed Control */}
        <div className="playback-speed-control">
          <label htmlFor="playback-speed" className="speed-label">
            Speed:
          </label>
          <select
            id="playback-speed"
            className="speed-select"
            value={speed}
            onChange={handleSpeedChange}
          >
            {PLAYBACK_SPEEDS.map(speedOption => (
              <option key={speedOption} value={speedOption}>
                {speedOption}x
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Status Indicator */}
      <div className="playback-status">
        {isPlaying && (
          <span className="status-playing">
            <span className="status-icon">▶️</span>
            Playing...
          </span>
        )}
        {isPaused && (
          <span className="status-paused">
            <span className="status-icon">⏸️</span>
            Paused
          </span>
        )}
        {!isPlaying && !isPaused && (
          <span className="status-stopped">
            <span className="status-icon">⏹️</span>
            Stopped
          </span>
        )}
      </div>
    </div>
  );
}