/**
 * Chat History Component
 * Displays conversation history between user and AI assistant
 */

import React, { useEffect, useRef } from 'react';
import { useHybridPipeline } from '../contexts/HybridPipelineContext';

export function ChatHistory() {
  const { state } = useHybridPipeline();
  const { chatHistory, isProcessing } = state;
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <div className="chat-history">
      <div className="chat-header">
        <h3>Conversation</h3>
        <div className="message-count">
          {chatHistory.length} messages
        </div>
      </div>

      <div className="messages-container">
        {chatHistory.length === 0 ? (
          <div className="empty-chat">
            <div className="empty-icon">💬</div>
            <p>Start a conversation by speaking or typing</p>
          </div>
        ) : (
          <div className="messages-list">
            {chatHistory.map((message) => (
              <div 
                key={message.id} 
                className={`message ${message.role}`}
              >
                <div className="message-avatar">
                  {message.role === 'user' ? '👤' : '🤖'}
                </div>
                <div className="message-content">
                  <div className="message-text">
                    {message.content}
                  </div>
                  <div className="message-meta">
                    <span className="timestamp">
                      {formatTimestamp(message.timestamp)}
                    </span>
                    {message.audioUrl && (
                      <button 
                        className="play-audio-btn"
                        onClick={() => {
                          const audio = new Audio(message.audioUrl);
                          audio.play();
                        }}
                      >
                        🔊
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            
            {isProcessing && (
              <div className="message assistant typing">
                <div className="message-avatar">🤖</div>
                <div className="message-content">
                  <div className="typing-indicator">
                    <div className="typing-dots">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                    <span className="typing-text">AI is thinking...</span>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div className="chat-stats">
        <div className="stat">
          <span className="stat-label">User:</span>
          <span className="stat-value">
            {chatHistory.filter(m => m.role === 'user').length}
          </span>
        </div>
        <div className="stat">
          <span className="stat-label">Assistant:</span>
          <span className="stat-value">
            {chatHistory.filter(m => m.role === 'assistant').length}
          </span>
        </div>
      </div>
    </div>
  );
}