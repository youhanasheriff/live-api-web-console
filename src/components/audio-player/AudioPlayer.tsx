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

import React, { useState, useRef, useEffect, useCallback } from 'react';
import './audio-player.scss';

interface AudioPlayerProps {
  audioData: string; // base64 encoded audio data
  mimeType: string;
  duration?: number;
  className?: string;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({
  audioData,
  mimeType,
  duration,
  className = '',
}) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(duration || 0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Helper function to create WAV header
  const createWavHeader = useCallback((dataLength: number): Uint8Array => {
    const sampleRate = 16000;
    const numChannels = 1;
    const bitsPerSample = 16;
    const byteRate = sampleRate * numChannels * bitsPerSample / 8;
    const blockAlign = numChannels * bitsPerSample / 8;
    const header = new ArrayBuffer(44);
    const view = new DataView(header);
    
    // RIFF header
    view.setUint32(0, 0x52494646, false); // 'RIFF'
    view.setUint32(4, 36 + dataLength, true); // file size
    view.setUint32(8, 0x57415645, false); // 'WAVE'
    
    // fmt chunk
    view.setUint32(12, 0x666d7420, false); // 'fmt '
    view.setUint32(16, 16, true); // chunk size
    view.setUint16(20, 1, true); // audio format (PCM)
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    
    // data chunk
    view.setUint32(36, 0x64617461, false); // 'data'
    view.setUint32(40, dataLength, true);
    
    return new Uint8Array(header);
  }, []);

  // Create audio URL from base64 data
  // Convert PCM to WAV if necessary
  const audioUrl = React.useMemo(() => {
    if (!audioData || audioData.trim() === '') {
      console.warn('No audio data provided to AudioPlayer');
      setError('No audio data provided');
      return null;
    }

    try {
      // Validate base64 format
      const base64Pattern = /^[A-Za-z0-9+/]*={0,2}$/;
      if (!base64Pattern.test(audioData)) {
        console.error('Invalid base64 audio data format');
        setError('Invalid audio data format');
        return null;
      }

      if (mimeType.includes('pcm')) {
        // Convert PCM data to WAV format
        const binaryString = atob(audioData);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        // Check if we have valid audio data
        if (bytes.length === 0) {
          console.warn('Empty audio data after base64 decoding');
          setError('Empty audio data');
          return null;
        }
        
        // Create WAV header for 16kHz, 16-bit, mono PCM
        const wavHeader = createWavHeader(bytes.length);
        const wavData = new Uint8Array(wavHeader.length + bytes.length);
        wavData.set(wavHeader, 0);
        wavData.set(bytes, wavHeader.length);
        
        const blob = new Blob([wavData], { type: 'audio/wav' });
        return URL.createObjectURL(blob);
      }
      return `data:${mimeType};base64,${audioData}`;
    } catch (error) {
      console.error('Error processing audio data:', error);
      setError('Failed to process audio data');
      return null;
    }
  }, [audioData, mimeType, createWavHeader]);

  // Clean up object URL when component unmounts
  useEffect(() => {
    return () => {
      if (audioUrl && audioUrl.startsWith('blob:')) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      setTotalDuration(audio.duration);
      setIsLoading(false);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const handleError = () => {
      setError('Failed to load audio');
      setIsLoading(false);
    };

    const handleCanPlay = () => {
      setIsLoading(false);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);
    audio.addEventListener('canplay', handleCanPlay);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('canplay', handleCanPlay);
    };
  }, [audioUrl]);

  const togglePlayPause = () => {
    if (!audioUrl) {
      setError('No audio data available');
      return;
    }
    
    const audio = audioRef.current;
    if (!audio || isLoading) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio
        .play()
        .then(() => {
          setIsPlaying(true);
        })
        .catch(err => {
          setError('Failed to play audio');
          console.error('Audio play error:', err);
        });
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;

    const newTime = parseFloat(e.target.value);
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const formatTime = (time: number): string => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (error) {
    return (
      <div className={`audio-player error ${className}`}>
        <span className="material-symbols-outlined">error</span>
        <span className="error-message">{error}</span>
      </div>
    );
  }

  return (
    <div className={`audio-player ${className}`}>
      <audio ref={audioRef} src={audioUrl || undefined} preload="metadata" />

      <div className="audio-controls">
        <button
          className="play-pause-button"
          onClick={togglePlayPause}
          disabled={isLoading}
        >
          {isLoading ? (
            <span className="material-symbols-outlined spinning">sync</span>
          ) : isPlaying ? (
            <span className="material-symbols-outlined">pause</span>
          ) : (
            <span className="material-symbols-outlined">play_arrow</span>
          )}
        </button>

        <div className="time-display">
          <span className="current-time">{formatTime(currentTime)}</span>
        </div>

        <div className="seek-container">
          <input
            type="range"
            className="seek-bar"
            min="0"
            max={totalDuration}
            value={currentTime}
            onChange={handleSeek}
            disabled={isLoading}
          />
        </div>

        <div className="duration-display">
          <span className="total-duration">{formatTime(totalDuration)}</span>
        </div>
      </div>
    </div>
  );
};

export default AudioPlayer;
