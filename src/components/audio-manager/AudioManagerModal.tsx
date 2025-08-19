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
  Play,
  Pause,
  Download,
  Trash2,
  X,
  Search,
  Clock,
  HardDrive,
  Volume2,
} from 'lucide-react';
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
  index?: number;
  totalItems?: number;
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
  index = 1,
  totalItems = 1,
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
      className={`audio-list-item ${isSelected ? 'selected' : ''} ${isPlaying ? 'playing' : ''}`}
      onClick={onClick}
      role="listitem"
      tabIndex={0}
      aria-label={`Recording ${audio.sessionId.slice(-8)}, ${formatDate(audio.startTime)}, ${formatDuration(audio.duration / 1000)}, ${formatFileSize(audio.size)}`}
      aria-posinset={index}
      aria-setsize={totalItems}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <div className="audio-info">
        <div className="audio-header">
          <div className="audio-title">
            <Volume2 className="audio-icon" />
            <span>Recording {audio.sessionId.slice(-8)}</span>
          </div>
          <div className="audio-date">
            {formatDate(audio.startTime)}
          </div>
        </div>
        
        <div className="audio-details">
          <div className="audio-meta">
            <span className="duration">
              <Clock /> {formatDuration(audio.duration / 1000)}
            </span>
            <span className="file-size">
              <HardDrive /> {formatFileSize(audio.size)}
            </span>
            <span className="sample-rate">
              <Volume2 /> {(audio.sampleRate / 1000).toFixed(1)}kHz
            </span>
          </div>
        </div>

        {isPlaying && duration > 0 && (
          <div className="playback-progress">
            <div 
              className="progress-bar"
              role="progressbar"
              aria-valuenow={Math.round((currentTime / duration) * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Playback progress: ${Math.round((currentTime / duration) * 100)}%`}
            >
              <div 
                className="progress-fill" 
                style={{ width: `${(currentTime / duration) * 100}%` }}
              />
            </div>
            <span className="time-display" aria-live="polite">
              {formatDuration(currentTime)} / {formatDuration(duration)}
            </span>
          </div>
        )}
      </div>

      <div className="audio-actions" role="group" aria-label="Audio recording actions">
        <button
          className={`action-btn play-btn ${isPlaying ? 'playing' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            isPlaying ? onPause() : onPlay();
          }}
          aria-label={`${isPlaying ? 'Pause' : 'Play'} recording from ${formatDate(audio.startTime)} (${formatDuration(audio.duration / 1000)})`}
          title={`${isPlaying ? 'Pause' : 'Play'} recording`}
          type="button"
        >
          {isPlaying ? <Pause aria-hidden="true" strokeWidth={2.5} /> : <Play aria-hidden="true" strokeWidth={2.5} />}
        </button>
        
        <button
          className="action-btn download-btn"
          onClick={(e) => {
            e.stopPropagation();
            onDownload();
          }}
          aria-label={`Download recording from ${formatDate(audio.startTime)} (${formatFileSize(audio.size)})`}
          title="Download recording as audio file"
          type="button"
        >
          <Download aria-hidden="true" strokeWidth={2.5} />
        </button>
        
        <button
          className="action-btn delete-btn"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          aria-label={`Delete recording from ${formatDate(audio.startTime)} permanently`}
          title="Delete recording permanently"
          type="button"
        >
          <Trash2 aria-hidden="true" strokeWidth={2.5} />
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
    <section className="storage-stats" aria-labelledby="storage-heading">
      <div className="stats-header">
        <h3 id="storage-heading">Storage Usage</h3>
      </div>
      <div className="stats-content">
        <div className="stat-item">
          <span className="stat-label">Total Recordings:</span>
          <span className="stat-value" aria-label={`${stats.totalSessions} recordings`}>{stats.totalSessions}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Storage Used:</span>
          <span className="stat-value" aria-label={`${formatSize(stats.totalSize)} used`}>{formatSize(stats.totalSize)}</span>
        </div>
        <div 
          className="usage-bar"
          role="progressbar"
          aria-valuenow={Math.round(usagePercentage)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Storage usage: ${Math.round(usagePercentage)}% of 100 MB limit`}
          aria-describedby={stats.isNearLimit ? "storage-warning" : undefined}
        >
          <div 
            className={`usage-fill ${stats.isNearLimit ? 'near-limit' : ''}`}
            style={{ width: `${Math.min(usagePercentage, 100)}%` }}
            aria-hidden="true"
          />
        </div>
        {stats.isNearLimit && (
          <div className="warning-message" id="storage-warning" role="alert" aria-live="polite">
            Storage is nearly full. Consider deleting old recordings.
          </div>
        )}
      </div>
      </section>
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
  const modalRef = useRef<HTMLDivElement | null>(null);
  const firstFocusableRef = useRef<HTMLButtonElement | null>(null);

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
      // Focus management
      setTimeout(() => {
        firstFocusableRef.current?.focus();
      }, 100);
    }
  }, [open, loadAudioSessions]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onClose();
      }
    };

    if (open) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [open, onClose]);

  // Focus trap
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Tab' && modalRef.current) {
      const focusableElements = modalRef.current.querySelectorAll(
        'button, input, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0] as HTMLElement;
      const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement?.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement?.focus();
      }
    }
  };

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
    <div 
      className="audio-manager-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="audio-modal-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div 
        className="audio-manager-modal"
        ref={modalRef}
        onKeyDown={handleKeyDown}
      >
        <div className="modal-header">
          <h2 id="audio-modal-title">Audio Recordings</h2>
          <button 
            ref={firstFocusableRef}
            className="close-btn" 
            onClick={onClose}
            aria-label="Close audio recordings dialog"
            type="button"
          >
            <X aria-hidden="true" />
          </button>
        </div>

        <div className="modal-content">
          {storageStats && <StorageStatsDisplay stats={storageStats} />}
          
          <div className="search-section">
            <div className="search-input-container">
              <Search className="search-icon" aria-hidden="true" />
              <input
                type="text"
                placeholder="Search recordings..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
                aria-label="Search audio recordings"
                aria-describedby="search-help"
              />
              <div id="search-help" className="sr-only">
                Type to filter recordings by session ID or date
              </div>
            </div>
            
            {audioSessions.length > 0 && (
              <button
                className="clear-all-btn"
                onClick={handleClearAll}
                aria-label="Delete all audio recordings"
                type="button"
              >
                <Trash2 aria-hidden="true" strokeWidth={2.5} /> Clear All
              </button>
            )}
          </div>

          {error && (
            <div className="error-message" role="alert" aria-live="polite">
              {error}
              <button 
                onClick={() => setError(null)}
                aria-label="Dismiss error message"
                type="button"
              >
                ×
              </button>
            </div>
          )}

          <div 
            className="audio-list"
            role="list"
            aria-label="Audio recordings list"
            aria-live="polite"
            aria-describedby="list-status"
          >
            <div id="list-status" className="sr-only">
              {isLoading ? 'Loading recordings' : 
               filteredSessions.length === 0 ? 'No recordings available' :
               `${filteredSessions.length} recording${filteredSessions.length === 1 ? '' : 's'} found`}
            </div>
            {isLoading ? (
              <div className="loading-message" aria-live="polite">Loading audio recordings...</div>
            ) : filteredSessions.length === 0 ? (
              <div className="empty-message" role="status">
                {searchTerm ? 'No recordings match your search.' : 'No audio recordings found. Start a conversation and enable recording to see your audio here.'}
              </div>
            ) : (
              filteredSessions.map((audio, index) => (
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
                  index={index + 1}
                  totalItems={filteredSessions.length}
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