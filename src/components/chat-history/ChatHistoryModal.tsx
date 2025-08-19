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
  RiDownloadLine,
  RiTimeLine,
} from 'react-icons/ri';
import { ChatSession, chatStorage, StorageStats } from '../../lib/chat-storage';
import { useSessionPlayback } from '../../hooks/use-session-playback';
import { PlaybackControls } from './PlaybackControls';
import './chat-history-modal.scss';

interface ChatHistoryModalProps {
  open: boolean;
  onClose: () => void;
  onPlayback?: (session: ChatSession) => void;
}

interface SessionListItemProps {
  session: ChatSession;
  onPlay: () => void;
  onDelete: () => void;
  isSelected: boolean;
  onClick: () => void;
}

const SessionListItem: React.FC<SessionListItemProps> = ({
  session,
  onPlay,
  onDelete,
  isSelected,
  onClick,
}) => {
  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const formatDate = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return `Today ${date.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })}`;
    } else if (diffDays === 1) {
      return `Yesterday ${date.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })}`;
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  return (
    <div
      className={`session-item ${isSelected ? 'selected' : ''}`}
      onClick={onClick}
      role="listitem"
      aria-selected={isSelected}
      tabIndex={0}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <div className="session-header">
        <div className="session-title">{session.title}</div>
        <div className="session-actions">
          <button
            className="action-button play-button"
            onClick={e => {
              e.stopPropagation();
              onPlay();
            }}
            title="Replay session"
            aria-label="Replay session"
          >
            <RiPlayLine size={16} />
          </button>
          <button
            className="action-button delete-button"
            onClick={e => {
              e.stopPropagation();
              onDelete();
            }}
            title="Delete session"
            aria-label="Delete session"
          >
            <RiDeleteBinLine size={16} />
          </button>
        </div>
      </div>

      <div className="session-meta">
        <span className="session-date">{formatDate(session.startTime)}</span>
        <span className="session-duration">
          <RiTimeLine size={12} /> {formatDuration(session.duration)}
        </span>
        <span className="session-count">
          {session.metadata.messageCount} messages
        </span>
      </div>
    </div>
  );
};

const StorageStatsDisplay: React.FC<{ stats: StorageStats }> = ({ stats }) => {
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const usagePercentage = ((stats.totalSize / (5 * 1024 * 1024)) * 100).toFixed(
    1
  );

  return (
    <div className="storage-stats">
      <div className="stats-row">
        <span>Sessions: {stats.totalSessions}</span>
        <span>
          Storage: {formatBytes(stats.totalSize)} ({usagePercentage}%)
        </span>
      </div>
      <div
        className="storage-bar"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(100, parseFloat(usagePercentage))}
        aria-label="Storage usage"
      >
        <div
          className="storage-used"
          style={{ width: `${Math.min(100, parseFloat(usagePercentage))}%` }}
        />
      </div>
    </div>
  );
};

export const ChatHistoryModal: React.FC<ChatHistoryModalProps> = ({
  open,
  onClose,
  onPlayback,
}) => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [filteredSessions, setFilteredSessions] = useState<ChatSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<ChatSession | null>(
    null
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const playback = useSessionPlayback();

  // Filter sessions based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredSessions(sessions);
    } else {
      const result = chatStorage.searchSessions(searchQuery);
      if (result.success) {
        setFilteredSessions(result.data);
      } else {
        setError(result.error || 'Search failed');
      }
    }
  }, [searchQuery, sessions]);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = chatStorage.getAllSessions();
      if (result.success) {
        setSessions(result.data);
      } else {
        setError(result.error || 'Failed to load sessions');
      }
    } catch (err) {
      setError('Failed to load sessions');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadStats = useCallback(() => {
    const storageStats = chatStorage.getStorageStats();
    setStats(storageStats);
  }, []);

  const handleDeleteSession = useCallback(
    async (sessionId: string) => {
      if (deleteConfirm !== sessionId) {
        setDeleteConfirm(sessionId);
        // Auto-clear confirmation after 3 seconds
        setTimeout(() => setDeleteConfirm(null), 3000);
        return;
      }

      const result = chatStorage.deleteSession(sessionId);
      if (result.success) {
        setSessions(prev => prev.filter(s => s.id !== sessionId));
        if (selectedSession?.id === sessionId) {
          setSelectedSession(null);
        }
        loadStats();
      } else {
        setError(result.error || 'Failed to delete session');
      }
      setDeleteConfirm(null);
    },
    [deleteConfirm, loadStats, selectedSession?.id]
  );

  const handlePlaySession = useCallback(
    (session: ChatSession) => {
      playback.startPlayback(session);
      setSelectedSession(session);
      if (onPlayback) {
        onPlayback(session);
      }
      // Don't close modal during playback - let user control it
    },
    [playback, onPlayback]
  );

  const handleExportSessions = useCallback(() => {
    const result = chatStorage.exportSessions();
    if (result.success) {
      const blob = new Blob([result.data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gemini-chat-history-${
        new Date().toISOString().split('T')[0]
      }.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else {
      setError(result.error || 'Export failed');
    }
  }, []);

  const handleClearAllSessions = useCallback(() => {
    if (deleteConfirm !== 'all') {
      setDeleteConfirm('all');
      setTimeout(() => setDeleteConfirm(null), 3000);
      return;
    }

    const result = chatStorage.clearAllSessions();
    if (result.success) {
      setSessions([]);
      setSelectedSession(null);
      loadStats();
    } else {
      setError(result.error || 'Failed to clear sessions');
    }
    setDeleteConfirm(null);
  }, [deleteConfirm, loadStats]);

  // Load sessions when modal opens
  useEffect(() => {
    if (open) {
      loadSessions();
      loadStats();
    }
  }, [loadSessions, loadStats, open]);

  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Focus the search input when opening
  useEffect(() => {
    if (open) {
      setTimeout(() => searchInputRef.current?.focus(), 0);
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="chat-history-backdrop" onClick={onClose}>
      <div
        className="chat-history-modal"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="chat-history-title"
      >
        {/* Header */}
        <div className="modal-header">
          <h2 id="chat-history-title">Chat History</h2>
          <div className="header-actions">
            <button
              className="action-button export-button"
              onClick={handleExportSessions}
              title="Export all sessions"
              aria-label="Export all sessions"
            >
              <RiDownloadLine size={16} />
            </button>
            <button
              className="action-button"
              onClick={onClose}
              aria-label="Close dialog"
            >
              <RiCloseLine size={16} color="#fff" />
            </button>
          </div>
        </div>

        {/* Search and Stats */}
        <div className="modal-controls">
          <div className="search-container">
            <RiSearchLine
              className="search-icon"
              size={16}
              aria-hidden="true"
            />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search sessions..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="search-input"
              aria-label="Search sessions"
            />
          </div>
          {stats && <StorageStatsDisplay stats={stats} />}
        </div>

        {/* Content */}
        <div className="modal-content">
          {error && (
            <div className="error-message" role="alert">
              {error}
              <button onClick={() => setError(null)} aria-label="Dismiss error">
                ×
              </button>
            </div>
          )}

          {loading ? (
            <div
              className="loading"
              role="status"
              aria-live="polite"
              aria-busy="true"
            >
              <div className="loading-spinner" />
              <span className="loading-text">Loading sessions...</span>
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="empty-state">
              {searchQuery ? (
                <>
                  <RiSearchLine size={48} />
                  <h3>No sessions found</h3>
                  <p>Try adjusting your search terms</p>
                </>
              ) : (
                <>
                  <RiTimeLine size={48} />
                  <h3>No chat history</h3>
                  <p>Start a conversation to see your chat history here</p>
                </>
              )}
            </div>
          ) : (
            <div className="sessions-layout">
              {/* Session List */}
              <div
                className="sessions-list"
                role="list"
                aria-label="Saved sessions"
              >
                {filteredSessions.map(session => (
                  <SessionListItem
                    key={session.id}
                    session={session}
                    onPlay={() => handlePlaySession(session)}
                    onDelete={() => handleDeleteSession(session.id)}
                    isSelected={selectedSession?.id === session.id}
                    onClick={() => setSelectedSession(session)}
                  />
                ))}
              </div>

              {/* Session Preview */}
              {selectedSession && (
                <div className="session-preview">
                  <div className="preview-header">
                    <h3>{selectedSession.title}</h3>
                    <div className="preview-meta">
                      <span>
                        Started: {selectedSession.startTime.toLocaleString()}
                      </span>
                      <span>
                        Duration: {Math.floor(selectedSession.duration / 1000)}s
                      </span>
                      <span>Model: {selectedSession.metadata.model}</span>
                    </div>
                  </div>

                  {/* Playback Controls */}
                  <PlaybackControls
                    playback={playback}
                    className="session-playback"
                  />

                  <div className="preview-content">
                    <div className="logs-preview">
                      {selectedSession.logs.slice(0, 10).map((log, index) => (
                        <div key={index} className="log-item">
                          <span className="log-time">
                            {log.date.toLocaleTimeString()}
                          </span>
                          <span className="log-type">{log.type}</span>
                          <span className="log-message">
                            {typeof log.message === 'string'
                              ? log.message.substring(0, 100) +
                                (log.message.length > 100 ? '...' : '')
                              : '[Object]'}
                          </span>
                        </div>
                      ))}
                      {selectedSession.logs.length > 10 && (
                        <div className="log-item more-logs">
                          ... and {selectedSession.logs.length - 10} more
                          messages
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="preview-actions">
                    <button
                      className="primary-button"
                      onClick={() => handlePlaySession(selectedSession)}
                    >
                      <RiPlayLine size={16} />
                      Replay Session
                    </button>
                    <button
                      className={`danger-button ${
                        deleteConfirm === selectedSession.id ? 'confirm' : ''
                      }`}
                      onClick={() => handleDeleteSession(selectedSession.id)}
                    >
                      <RiDeleteBinLine size={16} />
                      {deleteConfirm === selectedSession.id
                        ? 'Confirm Delete'
                        : 'Delete Session'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {sessions.length > 0 && (
          <div className="modal-footer">
            <button
              className={`danger-button ${
                deleteConfirm === 'all' ? 'confirm' : ''
              }`}
              onClick={handleClearAllSessions}
              aria-label={
                deleteConfirm === 'all'
                  ? 'Confirm clear all sessions'
                  : 'Clear all sessions'
              }
            >
              {deleteConfirm === 'all'
                ? 'Confirm Clear All'
                : 'Clear All Sessions'}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default ChatHistoryModal;
