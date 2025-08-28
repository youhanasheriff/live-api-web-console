/**
 * Hybrid Pipeline Context
 * Manages STT → Gemini → TTS pipeline for voice conversations
 */

import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useRef,
  useEffect,
} from 'react';
import { VADManager, VADEvent } from '../lib/vad-manager';
import { AudioStreamer } from '../lib/audio-streamer';

export interface TranscriptionResult {
  id: string;
  text: string;
  timestamp: number;
  confidence?: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  audioUrl?: string;
}

export interface PipelineState {
  isConnected: boolean;
  isListening: boolean;
  isMuted: boolean;
  isProcessing: boolean;
  isPlayingAudio: boolean;
  currentTranscription: string;
  transcriptions: TranscriptionResult[];
  chatHistory: ChatMessage[];
  error: string | null;
  vadEnergy: number;
  isVoiceActive: boolean;
}

type PipelineAction =
  | { type: 'SET_CONNECTED'; payload: boolean }
  | { type: 'SET_LISTENING'; payload: boolean }
  | { type: 'SET_MUTED'; payload: boolean }
  | { type: 'SET_PROCESSING'; payload: boolean }
  | { type: 'SET_PLAYING_AUDIO'; payload: boolean }
  | { type: 'SET_CURRENT_TRANSCRIPTION'; payload: string }
  | { type: 'ADD_TRANSCRIPTION'; payload: TranscriptionResult }
  | { type: 'ADD_CHAT_MESSAGE'; payload: ChatMessage }
  | { type: 'RESET_CHAT_HISTORY' }
  | { type: 'SET_ERROR'; payload: string | null }
  | {
      type: 'SET_VAD_STATE';
      payload: { energy: number; isVoiceActive: boolean };
    }
  | { type: 'RESET_STATE' };

const initialState: PipelineState = {
  isConnected: false,
  isListening: false,
  isMuted: false,
  isProcessing: false,
  isPlayingAudio: false,
  currentTranscription: '',
  transcriptions: [],
  chatHistory: [],
  error: null,
  vadEnergy: 0,
  isVoiceActive: false,
};

function pipelineReducer(
  state: PipelineState,
  action: PipelineAction
): PipelineState {
  switch (action.type) {
    case 'SET_CONNECTED':
      return { ...state, isConnected: action.payload };
    case 'SET_LISTENING':
      return { ...state, isListening: action.payload };
    case 'SET_MUTED':
      return { ...state, isMuted: action.payload };
    case 'SET_PROCESSING':
      return { ...state, isProcessing: action.payload };
    case 'SET_PLAYING_AUDIO':
      return { ...state, isPlayingAudio: action.payload };
    case 'SET_CURRENT_TRANSCRIPTION':
      return { ...state, currentTranscription: action.payload };
    case 'ADD_TRANSCRIPTION':
      return {
        ...state,
        transcriptions: [...state.transcriptions, action.payload],
        currentTranscription: '',
      };
    case 'ADD_CHAT_MESSAGE':
      return {
        ...state,
        chatHistory: [...state.chatHistory, action.payload],
      };
    case 'RESET_CHAT_HISTORY':
      return {
        ...state,
        chatHistory: [],
      };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'SET_VAD_STATE':
      return {
        ...state,
        vadEnergy: action.payload.energy,
        isVoiceActive: action.payload.isVoiceActive,
      };
    case 'RESET_STATE':
      return { ...initialState };
    default:
      return state;
  }
}

interface HybridPipelineContextType {
  state: PipelineState;
  connect: () => Promise<void>;
  disconnect: () => void;
  toggleMute: () => void;
  sendMessage: (text: string) => Promise<void>;
}

const HybridPipelineContext = createContext<HybridPipelineContextType | null>(
  null
);

export function HybridPipelineProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [state, dispatch] = useReducer(pipelineReducer, initialState);
  const vadManagerRef = useRef<VADManager | null>(null);
  const audioStreamerRef = useRef<AudioStreamer | null>(null);

  // Initialize audio streamer
  useEffect(() => {
    const audioContext = new AudioContext();
    audioStreamerRef.current = new AudioStreamer(audioContext);
    return () => {
      audioStreamerRef.current?.stop();
    };
  }, []);

  // Process text to speech
  const processTextToSpeech = useCallback(async (text: string) => {
    try {
      // Input validation
      if (!text || typeof text !== 'string' || text.trim().length === 0) {
        throw new Error('Invalid text input');
      }

      if (text.length > 4096) {
        throw new Error('Text too long for TTS processing');
      }

      // API request
      const ttsResponse = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      if (!ttsResponse.ok) {
        throw new Error(`TTS API failed: ${ttsResponse.status}`);
      }

      const { audio } = await ttsResponse.json();

      if (!audio) {
        throw new Error('No audio data received from TTS API');
      }

      // PCM Audio processing
      const audioData = Uint8Array.from(atob(audio), c => c.charCodeAt(0));

      dispatch({ type: 'SET_PLAYING_AUDIO', payload: true });

      // Set up completion handler
      audioStreamerRef.current!.onComplete = () => {
        dispatch({ type: 'SET_PLAYING_AUDIO', payload: false });
      };

      // Resume audio context and add PCM16 data directly
      await audioStreamerRef.current!.resume();
      audioStreamerRef.current!.addPCM16(audioData);
    } catch (error) {
      // Determine user-friendly error message
      let userErrorMessage = 'Failed to generate speech';
      if (error instanceof Error) {
        if (error.message.includes('Invalid text')) {
          userErrorMessage = 'Invalid text input for speech generation';
        } else if (error.message.includes('too long')) {
          userErrorMessage = 'Text is too long for speech generation';
        } else if (error.message.includes('API failed')) {
          userErrorMessage =
            'Speech generation service is currently unavailable';
        }
      }

      dispatch({ type: 'SET_ERROR', payload: userErrorMessage });
      dispatch({ type: 'SET_PLAYING_AUDIO', payload: false });
    }
  }, []);

  // Process conversation through Gemini
  const processConversation = useCallback(
    async (text: string) => {
      try {
        const conversationResponse = await fetch('/api/conversation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: text,
            conversationHistory: state.chatHistory.map(v => ({
              role: v.role,
              content: v.content,
            })),
          }),
        });

        if (!conversationResponse.ok) {
          throw new Error('Conversation API failed');
        }

        const { response, shouldEndCall, conversationHistory } =
          await conversationResponse.json();

        // Update conversation history if provided by API
        if (conversationHistory && Array.isArray(conversationHistory)) {
          // Clear current history and replace with updated history from API
          dispatch({ type: 'RESET_CHAT_HISTORY' });
          conversationHistory.forEach((message: ChatMessage) => {
            dispatch({ type: 'ADD_CHAT_MESSAGE', payload: message });
          });
        } else {
          // Fallback: manually add assistant message if no history provided
          if (response.trim()) {
            const assistantMessage: ChatMessage = {
              id: Date.now().toString(),
              role: 'assistant',
              content: response.trim(),
              timestamp: Date.now(),
            };
            dispatch({ type: 'ADD_CHAT_MESSAGE', payload: assistantMessage });
          }
        }

        // Check for endCallTool
        if (shouldEndCall) {
          console.log('end the call. this is the text response:', response);
          // disconnect();
          // return;
        }

        // Convert to speech
        if (response.trim()) {
          await processTextToSpeech(response.trim());
        }
      } catch (error) {
        console.error('Error in conversation:', error);
        dispatch({
          type: 'SET_ERROR',
          payload: 'Failed to process conversation',
        });
      }
    },
    [processTextToSpeech, state.chatHistory]
  );

  // Process audio chunk through STT
  const processAudioChunk = useCallback(
    async (audioData: Float32Array) => {
      try {
        dispatch({ type: 'SET_PROCESSING', payload: true });
        dispatch({
          type: 'SET_CURRENT_TRANSCRIPTION',
          payload: 'Processing...',
        });

        // Convert Float32Array to base64 for API
        const int16Array = new Int16Array(audioData.length);
        for (let i = 0; i < audioData.length; i++) {
          int16Array[i] = Math.max(
            -32768,
            Math.min(32767, audioData[i] * 32768)
          );
        }

        const audioBuffer = int16Array.buffer;
        const base64Audio = btoa(
          String.fromCharCode(...new Uint8Array(audioBuffer))
        );

        // Send to STT API
        const sttResponse = await fetch('/api/stt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ audioData: base64Audio }),
        });

        if (!sttResponse.ok) {
          throw new Error('STT API failed');
        }

        const { transcription, timestamp } = await sttResponse.json();

        if (transcription.trim()) {
          const transcriptionResult: TranscriptionResult = {
            id: Date.now().toString(),
            text: transcription.trim(),
            timestamp,
          };

          dispatch({ type: 'ADD_TRANSCRIPTION', payload: transcriptionResult });

          // Add user message to chat
          const userMessage: ChatMessage = {
            id: Date.now().toString(),
            role: 'user',
            content: transcription.trim(),
            timestamp: Date.now(),
          };
          dispatch({ type: 'ADD_CHAT_MESSAGE', payload: userMessage });

          // Send to Gemini for response
          await processConversation(transcription.trim());
        }
      } catch (error) {
        console.error('Error processing audio:', error);
        dispatch({ type: 'SET_ERROR', payload: 'Failed to process audio' });
      } finally {
        dispatch({ type: 'SET_PROCESSING', payload: false });
        dispatch({ type: 'SET_CURRENT_TRANSCRIPTION', payload: '' });
      }
    },
    [processConversation]
  );

  // VAD event handler with microphone state management
  const handleVADEvent = useCallback(
    async (event: VADEvent) => {
      dispatch({
        type: 'SET_VAD_STATE',
        payload: {
          energy: event.energy,
          isVoiceActive: event.isVoiceActive || false,
        },
      });

      // Prevent microphone processing during AI audio playback
      if (state.isPlayingAudio) {
        console.log(
          `[${new Date().toISOString()}] [INFO] [VAD] Microphone input blocked during AI audio playback`,
          {
            eventType: event.type,
            isPlayingAudio: state.isPlayingAudio,
            energy: event.energy,
          }
        );
        return;
      }

      if (event.type === 'speechStart') {
        dispatch({
          type: 'SET_CURRENT_TRANSCRIPTION',
          payload: 'Listening...',
        });
      } else if (event.type === 'speechEnd' && event.audioData) {
        if (!state.isMuted) {
          await processAudioChunk(event.audioData);
        }
      }
    },
    [processAudioChunk, state.isMuted, state.isPlayingAudio]
  );

  // Connect to pipeline
  const connect = useCallback(async () => {
    try {
      dispatch({ type: 'SET_ERROR', payload: null });

      // Initialize VAD manager
      vadManagerRef.current = new VADManager({
        energyThreshold: 0.01,
        silenceThreshold: 800,
        minSpeechDuration: 500,
      });

      vadManagerRef.current.addEventListener(handleVADEvent);
      await vadManagerRef.current.initialize();
      await vadManagerRef.current.startListening();

      dispatch({ type: 'SET_CONNECTED', payload: true });
      dispatch({ type: 'SET_LISTENING', payload: true });
    } catch (error) {
      console.error('Failed to connect:', error);
      dispatch({
        type: 'SET_ERROR',
        payload: 'Failed to connect to microphone',
      });
    }
  }, [handleVADEvent]);

  // Disconnect from pipeline
  const disconnect = useCallback(() => {
    if (vadManagerRef.current) {
      vadManagerRef.current.destroy();
      vadManagerRef.current = null;
    }

    if (audioStreamerRef.current) {
      audioStreamerRef.current.stop();
    }

    dispatch({ type: 'RESET_STATE' });
  }, []);

  // Toggle mute
  const toggleMute = useCallback(() => {
    const newMutedState = !state.isMuted;
    dispatch({ type: 'SET_MUTED', payload: newMutedState });

    // Control VAD manager listening state based on mute status
    if (vadManagerRef.current && state.isConnected) {
      if (newMutedState) {
        // Mute: stop listening but keep VAD manager active
        vadManagerRef.current.stopListening();
        dispatch({ type: 'SET_LISTENING', payload: false });
      } else {
        // Unmute: resume listening
        vadManagerRef.current
          .startListening()
          .then(() => {
            dispatch({ type: 'SET_LISTENING', payload: true });
          })
          .catch(error => {
            console.error('Failed to resume listening after unmute:', error);
            dispatch({
              type: 'SET_ERROR',
              payload: 'Failed to resume microphone',
            });
          });
      }
    }
  }, [state.isMuted, state.isConnected]);

  // Send manual message
  const sendMessage = useCallback(
    async (text: string) => {
      // Prevent manual input during AI speech output
      if (state.isPlayingAudio) {
        console.log(
          `[${new Date().toISOString()}] [INFO] [MANUAL_INPUT] Manual message blocked during AI audio playback`,
          {
            messageLength: text.length,
            isPlayingAudio: state.isPlayingAudio,
          }
        );
        return;
      }

      const userMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'user',
        content: text,
        timestamp: Date.now(),
      };
      dispatch({ type: 'ADD_CHAT_MESSAGE', payload: userMessage });
      await processConversation(text);
    },
    [processConversation, state.isPlayingAudio]
  );

  const contextValue: HybridPipelineContextType = {
    state,
    connect,
    disconnect,
    toggleMute,
    sendMessage,
  };

  return (
    <HybridPipelineContext.Provider value={contextValue}>
      {children}
    </HybridPipelineContext.Provider>
  );
}

export function useHybridPipeline() {
  const context = useContext(HybridPipelineContext);
  if (!context) {
    throw new Error(
      'useHybridPipeline must be used within a HybridPipelineProvider'
    );
  }
  return context;
}
