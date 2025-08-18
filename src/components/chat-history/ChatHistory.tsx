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
import { useChatHistory } from '../../contexts/ChatHistoryContext';
import { ChatSession } from '../../types/chat-history';
import AudioPlayer from '../audio-player/AudioPlayer';
import { chatHistoryManager } from '../../services/chat-history-manager';
import './chat-history.scss';

interface ChatHistoryProps {
  isOpen: boolean;
  onClose: () => void;
}

const ChatHistory: React.FC<ChatHistoryProps> = ({ isOpen, onClose }) => {
  const { allSessions, getSession, deleteSession, requestTranscription } =
    useChatHistory();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<ChatSession | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadSessions();
    }
  }, [isOpen]);

  useEffect(() => {
    // Listen for transcription events
    const handleTranscriptionCompleted = (sessionId: string) => {
      if (selectedSession?.id === sessionId) {
        loadSessions();
      }
    };

    const handleTranscriptionFailed = (sessionId: string, error: string) => {
      console.error('Transcription failed for session:', sessionId, error);
      if (selectedSession?.id === sessionId) {
        setIsTranscribing(null);
      }
    };

    chatHistoryManager.on(
      'transcription:completed',
      handleTranscriptionCompleted
    );
    chatHistoryManager.on('transcription:failed', handleTranscriptionFailed);

    return () => {
      chatHistoryManager.off(
        'transcription:completed',
        handleTranscriptionCompleted
      );
      chatHistoryManager.off('transcription:failed', handleTranscriptionFailed);
    };
  }, [selectedSession?.id]);

  const loadSessions = () => {
    setSessions(
      allSessions.sort(
        (a: ChatSession, b: ChatSession) =>
          new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
      )
    );
  };

  const handleSessionSelect = (sessionId: string) => {
    const session = getSession(sessionId);
    setSelectedSession(session);
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (window.confirm('Are you sure you want to delete this session?')) {
      deleteSession(sessionId);
      loadSessions();
      if (selectedSession?.id === sessionId) {
        setSelectedSession(null);
      }
    }
  };

  const handleRequestTranscription = async (sessionId: string) => {
    setIsTranscribing(sessionId);
    try {
      await requestTranscription(sessionId);
      loadSessions(); // Refresh to show updated transcription
    } catch (error) {
      console.error('Transcription failed:', error);
    } finally {
      setIsTranscribing(null);
    }
  };

  const formatDuration = (startTime: Date, endTime?: Date) => {
    const start = new Date(startTime);
    const end = endTime ? new Date(endTime) : new Date();
    const duration = Math.floor((end.getTime() - start.getTime()) / 1000);
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatTimestamp = (timestamp: Date) => {
    return new Date(timestamp).toLocaleString();
  };

  const handleExport = () => {
    if (selectedSession) {
      const exportData = chatHistoryManager.exportSession(selectedSession.id);
      if (exportData) {
        const blob = new Blob([exportData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `chat-session-${selectedSession.id}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    }
  };

  const handleGenerateTranscription = async () => {
    if (!selectedSession || !selectedSession.audioRecording) {
      return;
    }

    setIsTranscribing(selectedSession.id);
    try {
      await chatHistoryManager.requestTranscription(selectedSession.id);
      // Refresh the session data to show the new transcription
      loadSessions();
    } catch (error) {
      console.error('Failed to generate transcription:', error);
    } finally {
      setIsTranscribing(null);
    }
  };

  const exportTranscription = (session: ChatSession) => {
    if (!session.transcription) return;

    const content =
      `Chat Session Transcription\n` +
      `Session ID: ${session.id}\n` +
      `Start Time: ${formatTimestamp(session.startTime)}\n` +
      `End Time: ${
        session.endTime ? formatTimestamp(session.endTime) : 'Ongoing'
      }\n` +
      `Duration: ${formatDuration(session.startTime, session.endTime)}\n` +
      `Confidence: ${(session.transcription.confidence * 100).toFixed(
        1
      )}%\n\n` +
      `Transcription:\n${session.transcription.text}`;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcription-${session.id}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div className="chat-history-overlay">
      <div className="chat-history-modal">
        <div className="chat-history-header">
          <h2>Chat History</h2>
          <button className="close-button" onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="chat-history-content">
          <div className="sessions-list">
            <h3>Sessions ({sessions.length})</h3>
            {sessions.length === 0 ? (
              <p className="no-sessions">No chat sessions found</p>
            ) : (
              <div className="sessions-container">
                {sessions.map(session => (
                  <div
                    key={session.id}
                    className={`session-item ${
                      selectedSession?.id === session.id ? 'selected' : ''
                    }`}
                    onClick={() => handleSessionSelect(session.id)}
                  >
                    <div className="session-info">
                      <div className="session-time">
                        {formatTimestamp(session.startTime)}
                      </div>
                      <div className="session-details">
                        <span className={`status ${session.status}`}>
                          {session.status}
                        </span>
                        <span className="duration">
                          {formatDuration(session.startTime, session.endTime)}
                        </span>
                        <span className="message-count">
                          {session.messages.length} messages
                        </span>
                      </div>
                      {session.transcription && (
                        <div className="transcription-indicator">
                          <span className="material-symbols-outlined">
                            transcribe
                          </span>
                          <span className="confidence">
                            {(session.transcription.confidence * 100).toFixed(
                              0
                            )}
                            %
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="session-actions">
                      {!session.transcription &&
                        session.status === 'completed' && (
                          <button
                            className="transcribe-button"
                            onClick={e => {
                              e.stopPropagation();
                              handleRequestTranscription(session.id);
                            }}
                            disabled={isTranscribing === session.id}
                          >
                            {isTranscribing === session.id ? (
                              <span className="material-symbols-outlined spinning">
                                sync
                              </span>
                            ) : (
                              <span className="material-symbols-outlined">
                                transcribe
                              </span>
                            )}
                          </button>
                        )}
                      <button
                        className="delete-button"
                        onClick={e => {
                          e.stopPropagation();
                          handleDeleteSession(session.id);
                        }}
                      >
                        <span className="material-symbols-outlined">
                          delete
                        </span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="session-details">
            {selectedSession ? (
              <div className="session-detail-view">
                <div className="session-detail-header">
                  <h3>Session Details</h3>
                  <div className="session-meta">
                    <span>
                      Started: {formatTimestamp(selectedSession.startTime)}
                    </span>
                    {selectedSession.endTime && (
                      <span>
                        Ended: {formatTimestamp(selectedSession.endTime)}
                      </span>
                    )}
                    <span>
                      Duration:{' '}
                      {formatDuration(
                        selectedSession.startTime,
                        selectedSession.endTime
                      )}
                    </span>
                    <span>
                      Status:{' '}
                      <span className={`status ${selectedSession.status}`}>
                        {selectedSession.status}
                      </span>
                    </span>
                  </div>
                </div>

                {selectedSession.audioRecording && (
                  <div className="audio-recording-container">
                    <h4>Session Audio Recording</h4>
                    <AudioPlayer
                      audioData={selectedSession.audioRecording.data}
                      mimeType={selectedSession.audioRecording.mimeType}
                      duration={selectedSession.audioRecording.duration}
                      className="session-audio-player"
                    />
                    {!selectedSession.transcription && (
                      <button
                        className="transcribe-audio-btn"
                        onClick={handleGenerateTranscription}
                        disabled={
                          isTranscribing === selectedSession.id ||
                          !selectedSession?.audioRecording
                        }
                      >
                        {isTranscribing === selectedSession.id
                          ? 'Generating...'
                          : 'Generate Transcription'}
                      </button>
                    )}
                  </div>
                )}

                <div className="messages-container">
                  <h4>Messages ({selectedSession.messages.length})</h4>
                  <div className="messages-list">
                    {selectedSession.messages.map(message => (
                      <div
                        key={message.id}
                        className={`message ${message.type}`}
                      >
                        <div className="message-header">
                          <span className="message-type">{message.type}</span>
                          <span className="message-time">
                            {formatTimestamp(message.timestamp)}
                          </span>
                        </div>
                        <div className="message-content">
                          {message.content.text && (
                            <div className="text-content">
                              {message.content.text}
                            </div>
                          )}
                          {message.content.audio && (
                            <div className="audio-content">
                              <div className="audio-info">
                                <span className="material-symbols-outlined">
                                  mic
                                </span>
                                <span>
                                  Audio Message (
                                  {message.content.audio.duration
                                    ? `${message.content.audio.duration}s`
                                    : 'unknown duration'}
                                  )
                                </span>
                              </div>
                              <AudioPlayer
                                audioData={message.content.audio.data}
                                mimeType={message.content.audio.mimeType}
                                duration={message.content.audio.duration}
                                className="message-audio-player"
                              />
                            </div>
                          )}
                          {message.content.video && (
                            <div className="video-content">
                              <span className="material-symbols-outlined">
                                videocam
                              </span>
                              <span>Video frame</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {selectedSession.transcription && (
                  <div className="transcription-container">
                    <div className="transcription-header">
                      <h4>Transcription</h4>
                      <div className="transcription-meta">
                        <span>
                          Confidence:{' '}
                          {(
                            selectedSession.transcription.confidence * 100
                          ).toFixed(1)}
                          %
                        </span>
                        <span>
                          Processed:{' '}
                          {formatTimestamp(
                            selectedSession.transcription.processedAt
                          )}
                        </span>
                        <span>
                          Service: {selectedSession.transcription.service}
                        </span>
                        <button
                          className="export-button"
                          onClick={() => exportTranscription(selectedSession)}
                        >
                          <span className="material-symbols-outlined">
                            download
                          </span>
                          Export
                        </button>
                      </div>
                    </div>
                    <div className="transcription-text">
                      {selectedSession.transcription.text}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="no-selection">
                <span className="material-symbols-outlined">chat</span>
                <p>Select a session to view details</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatHistory;
