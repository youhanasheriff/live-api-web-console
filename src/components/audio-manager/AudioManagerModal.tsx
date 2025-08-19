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

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  RiCloseLine,
  RiSearchLine,
  RiDeleteBinLine,
  RiPlayLine,
  RiPauseLine,
  RiDownloadLine,
  RiTimeLine,
  RiVolumeUpLine,
  RiDeleteBin2Line,
} from 'react-icons/ri';
import { sessionAudioStorage, StoredSessionAudio, AudioStorageStats } from '../../lib/session-audio-storage';
import './audio-manager-modal.scss';

interface AudioManagerModalProps {
  open: boolean;
  onClose: () => void;
}

interface AudioListItemProps {
  audio: StoredSessionAudio;
  onPlay: () => void;
  onPause: () => void;
  onDelete: () => void;
  onDownload: () => void;
  isSelected: boolean;
  isPlaying: boolean;
  onClick: () => void;
  currentTime?: number;
  duration?: number;
}

const AudioListItem: React.FC<AudioListItemProps> = ({
  audio,
  onPlay,
  onPause,
  onDelete,
  onDownload,
  isSelected,
  isPlaying,
  onClick,
  currentTime = 0,
  duration = 0,
}) => {
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes: number) => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date));
  };

  return (
    <div
      className={`audio-list-item ${isSelected ? 'selected' : ''}`}
      onClick={onClick}
    >
      <div className="audio-info">
        <div className="audio-header">
          <div className="audio-title">
            <RiVolumeUpLine className="audio-icon" />
            <span>Recording {audio.sessionId.slice(-8)}</span>
          </div>
          <div className="audio-date">
            {formatDate(audio.startTime)}
          </div>
        </div>
        
        <div className="audio-details">
          <div className="audio-meta">
            <span className="duration">
              <RiTimeLine /> {formatDuration(audio.duration / 1000)}
            </span>
            <span className="file-size">
              {formatFileSize(audio.size)}
            </span>
            <span className="sample-rate">
              {(audio.sampleRate / 1000).toFixed(1)}kHz
            </span>
          </div>
        </div>

        {isPlaying && duration > 0 && (
          <div className="playback-progress">
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${(currentTime / duration) * 100}%` }}
              />
            </div>
            <span className="time-display">
              {formatDuration(currentTime)} / {formatDuration(duration)}
            </span>
          </div>
        )}
      </div>

      <div className="audio-actions">
        <button
          className="action-btn play-btn"
          onClick={(e) => {
            e.stopPropagation();
            isPlaying ? onPause() : onPlay();
          }}
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? <RiPauseLine /> : <RiPlayLine />}
        </button>
        
        <button
          className="action-btn download-btn"
          onClick={(e) => {
            e.stopPropagation();
            onDownload();
          }}
          title="Download"
        >
          <RiDownloadLine />
        </button>
        
        <button
          className="action-btn delete-btn"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          title="Delete"
        >
          <RiDeleteBinLine />
        </button>
      </div>
    </div>
  );
};

const StorageStatsDisplay: React.FC<{ stats: AudioStorageStats }> = ({ stats }) => {
  const formatSize = (bytes: number) => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  const usagePercentage = (stats.totalSize / (100 * 1024 * 1024)) * 100; // Assuming 100MB limit

  return (
    <div className="storage-stats">
      <div className="stats-header">
        <h3>Storage Usage</h3>
      </div>
      <div className="stats-content">
        <div className="stat-item">
          <span className="stat-label">Total Recordings:</span>
          <span className="stat-value">{stats.totalSessions}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Storage Used:</span>
          <span className="stat-value">{formatSize(stats.totalSize)}</span>
        </div>
        <div className="usage-bar">
          <div 
            className={`usage-fill ${stats.isNearLimit ? 'near-limit' : ''}`}
            style={{ width: `${Math.min(usagePercentage, 100)}%` }}
          />
        </div>
        {stats.isNearLimit && (
          <div className="warning-message">
            Storage is nearly full. Consider deleting old recordings.
          </div>
        )}
      </div>
    </div>
  );
};

export const AudioManagerModal: React.FC<AudioManagerModalProps> = ({
  open,
  onClose,
}) => {
  const [audioSessions, setAudioSessions] = useState<StoredSessionAudio[]>([]);
  const [filteredSessions, setFilteredSessions] = useState<StoredSessionAudio[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [storageStats, setStorageStats] = useState<AudioStorageStats | null>(null);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  const [playingSessionId, setPlayingSessionId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Load audio sessions
  const loadAudioSessions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await sessionAudioStorage.getAllSessionAudioMetadata();
      if (result.success && result.data) {
        const sessions = result.data.sort((a: StoredSessionAudio, b: StoredSessionAudio) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setAudioSessions(sessions);
        setFilteredSessions(sessions);
      } else {
        setError(result.error || 'Failed to load audio sessions');
      }
      
      // Load storage stats
      const statsResult = await sessionAudioStorage.getStorageStats();
      setStorageStats(statsResult);
    } catch (err) {
      setError(`Error loading audio sessions: ${(err as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Filter sessions based on search term
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredSessions(audioSessions);
    } else {
      const filtered = audioSessions.filter(session =>
        session.sessionId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        new Date(session.startTime).toLocaleDateString().includes(searchTerm)
      );
      setFilteredSessions(filtered);
    }
  }, [searchTerm, audioSessions]);

  // Load sessions when modal opens
  useEffect(() => {
    if (open) {
      loadAudioSessions();
    }
  }, [open, loadAudioSessions]);

  // Audio playback handlers
  const handlePlay = useCallback(async (sessionId: string) => {
    try {
      // Stop current audio if playing
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
      }

      const result = await sessionAudioStorage.getSessionAudio(sessionId);
      if (!result.success || !result.data) {
        setError('Failed to load audio for playback');
        return;
      }

      const audioBlob = result.data.audioBlob;
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      
      audio.addEventListener('loadedmetadata', () => {
        setDuration(audio.duration);
      });
      
      audio.addEventListener('timeupdate', () => {
        setCurrentTime(audio.currentTime);
      });
      
      audio.addEventListener('ended', () => {
        setPlayingSessionId(null);
        setCurrentTime(0);
        setDuration(0);
      });
      
      audio.addEventListener('error', () => {
        setError('Error playing audio');
        setPlayingSessionId(null);
      });

      await audio.play();
      setCurrentAudio(audio);
      setPlayingSessionId(sessionId);
      audioRef.current = audio;
    } catch (err) {
      setError(`Error playing audio: ${(err as Error).message}`);
    }
  }, [currentAudio]);

  const handlePause = useCallback(() => {
    if (currentAudio) {
      currentAudio.pause();
      setPlayingSessionId(null);
    }
  }, [currentAudio]);

  const handleDownload = useCallback(async (sessionId: string) => {
    try {
      const result = await sessionAudioStorage.downloadSessionAudio(sessionId);
      if (!result.success) {
        setError(result.error || 'Failed to download audio');
      }
    } catch (err) {
      setError(`Error downloading audio: ${(err as Error).message}`);
    }
  }, []);

  const handleDelete = useCallback(async (sessionId: string) => {
    if (!window.confirm('Are you sure you want to delete this audio recording? This action cannot be undone.')) {
      return;
    }

    try {
      // Stop playback if this session is playing
      if (playingSessionId === sessionId && currentAudio) {
        currentAudio.pause();
        setPlayingSessionId(null);
        setCurrentTime(0);
        setDuration(0);
      }

      const result = await sessionAudioStorage.deleteSessionAudio(sessionId);
      if (result.success) {
        // Reload sessions
        await loadAudioSessions();
        if (selectedSessionId === sessionId) {
          setSelectedSessionId(null);
        }
      } else {
        setError(result.error || 'Failed to delete audio');
      }
    } catch (err) {
      setError(`Error deleting audio: ${(err as Error).message}`);
    }
  }, [playingSessionId, currentAudio, selectedSessionId, loadAudioSessions]);

  const handleClearAll = useCallback(async () => {
    if (!window.confirm('Are you sure you want to delete ALL audio recordings? This action cannot be undone.')) {
      return;
    }

    try {
      // Stop any current playback
      if (currentAudio) {
        currentAudio.pause();
        setPlayingSessionId(null);
        setCurrentTime(0);
        setDuration(0);
      }

      const result = await sessionAudioStorage.clearAllSessionAudio();
      if (result.success) {
        await loadAudioSessions();
        setSelectedSessionId(null);
      } else {
        setError(result.error || 'Failed to clear all audio');
      }
    } catch (err) {
      setError(`Error clearing all audio: ${(err as Error).message}`);
    }
  }, [currentAudio, loadAudioSessions]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (currentAudio) {
        currentAudio.pause();
        URL.revokeObjectURL(currentAudio.src);
      }
    };
  }, [currentAudio]);

  if (!open) return null;

  return createPortal(
    <div className="audio-manager-modal-overlay">
      <div className="audio-manager-modal">
        <div className="modal-header">
          <h2>Audio Recordings</h2>
          <button className="close-btn" onClick={onClose}>
            <RiCloseLine />
          </button>
        </div>

        <div className="modal-content">
          {storageStats && <StorageStatsDisplay stats={storageStats} />}
          
          <div className="search-section">
            <div className="search-input-container">
              <RiSearchLine className="search-icon" />
              <input
                type="text"
                placeholder="Search recordings..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
            </div>
            
            {audioSessions.length > 0 && (
              <button
                className="clear-all-btn"
                onClick={handleClearAll}
                title="Delete all recordings"
              >
                <RiDeleteBin2Line /> Clear All
              </button>
            )}
          </div>

          {error && (
            <div className="error-message">
              {error}
              <button onClick={() => setError(null)}>×</button>
            </div>
          )}

          <div className="audio-list">
            {isLoading ? (
              <div className="loading-message">Loading audio recordings...</div>
            ) : filteredSessions.length === 0 ? (
              <div className="empty-message">
                {searchTerm ? 'No recordings match your search.' : 'No audio recordings found. Start a conversation and enable recording to see your audio here.'}
              </div>
            ) : (
              filteredSessions.map((audio) => (
                <AudioListItem
                  key={audio.sessionId}
                  audio={audio}
                  onPlay={() => handlePlay(audio.sessionId)}
                  onPause={handlePause}
                  onDelete={() => handleDelete(audio.sessionId)}
                  onDownload={() => handleDownload(audio.sessionId)}
                  isSelected={selectedSessionId === audio.sessionId}
                  isPlaying={playingSessionId === audio.sessionId}
                  onClick={() => setSelectedSessionId(audio.sessionId)}
                  currentTime={playingSessionId === audio.sessionId ? currentTime : 0}
                  duration={playingSessionId === audio.sessionId ? duration : 0}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default AudioManagerModal;