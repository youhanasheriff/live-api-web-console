/**
 * Voice Activity Detection Manager
 * Manages VAD worklet and provides voice activity detection functionality
 */

// Inline VAD processor code for Next.js compatibility
const VADProcessorCode = `
class VADProcessor extends AudioWorkletProcessor {
  // VAD configuration
  energyThreshold = 0.01; // Minimum energy level to consider as speech
  silenceThreshold = 500; // ms of silence before considering speech ended
  minSpeechDuration = 300; // ms minimum speech duration to trigger
  
  // State tracking
  isVoiceActive = false;
  speechStartTime = 0;
  lastVoiceTime = 0;
  energyHistory = [];
  maxHistoryLength = 10;
  
  // Audio buffer for VAD
  audioBuffer = [];
  maxBufferSize = 16000 * 3; // 3 seconds at 16kHz
  
  constructor() {
    super();
    
    this.port.onmessage = (event) => {
      const { type, data } = event.data;
      
      switch (type) {
        case 'configure':
          this.configure(data);
          break;
        case 'reset':
          this.reset();
          break;
      }
    };
  }
  
  configure(config) {
    if (config.energyThreshold !== undefined) {
      this.energyThreshold = config.energyThreshold;
    }
    if (config.silenceThreshold !== undefined) {
      this.silenceThreshold = config.silenceThreshold;
    }
    if (config.minSpeechDuration !== undefined) {
      this.minSpeechDuration = config.minSpeechDuration;
    }
  }
  
  reset() {
    this.isVoiceActive = false;
    this.speechStartTime = 0;
    this.lastVoiceTime = 0;
    this.energyHistory = [];
    this.audioBuffer = [];
  }
  
  process(inputs) {
    const input = inputs[0];
    
    if (input.length === 0) {
      return true;
    }
    
    const samples = input[0];
    const currentTime = currentFrame / sampleRate * 1000; // Convert to milliseconds
    
    // Calculate RMS energy
    let sum = 0;
    for (let i = 0; i < samples.length; i++) {
      sum += samples[i] * samples[i];
      
      // Store audio data for potential speech extraction
      this.audioBuffer.push(samples[i]);
      if (this.audioBuffer.length > this.maxBufferSize) {
        this.audioBuffer.shift();
      }
    }
    
    const rms = Math.sqrt(sum / samples.length);
    
    // Update energy history for smoothing
    this.energyHistory.push(rms);
    if (this.energyHistory.length > this.maxHistoryLength) {
      this.energyHistory.shift();
    }
    
    // Calculate average energy for stability
    const avgEnergy = this.energyHistory.reduce((a, b) => a + b, 0) / this.energyHistory.length;
    
    // Detect voice activity
    const hasVoice = avgEnergy > this.energyThreshold;
    
    if (hasVoice) {
      this.lastVoiceTime = currentTime;
      
      if (!this.isVoiceActive) {
        // Speech started
        this.speechStartTime = currentTime;
        this.isVoiceActive = true;
        
        this.port.postMessage({
          type: 'speechStart',
          timestamp: currentTime,
          energy: avgEnergy
        });
      }
    } else {
      // Check if speech has ended
      if (this.isVoiceActive && (currentTime - this.lastVoiceTime) > this.silenceThreshold) {
        const speechDuration = currentTime - this.speechStartTime;
        
        if (speechDuration >= this.minSpeechDuration) {
          // Extract speech audio
          const speechAudio = this.audioBuffer.slice(-Math.floor(speechDuration * sampleRate / 1000));
          
          this.port.postMessage({
            type: 'speechEnd',
            timestamp: currentTime,
            duration: speechDuration,
            audioData: speechAudio,
            energy: avgEnergy
          });
        }
        
        this.isVoiceActive = false;
      }
    }
    
    // Send regular VAD updates
    this.port.postMessage({
      type: 'vadUpdate',
      isVoiceActive: this.isVoiceActive,
      energy: avgEnergy,
      timestamp: currentTime
    });
    
    return true;
  }
}

registerProcessor('VADProcessor', VADProcessor);
`;

export interface VADConfig {
  energyThreshold?: number;
  silenceThreshold?: number;
  minSpeechDuration?: number;
}

export interface VADEvent {
  type: 'speechStart' | 'speechEnd' | 'vadUpdate';
  timestamp: number;
  energy: number;
  isVoiceActive?: boolean;
  duration?: number;
  audioData?: Float32Array;
}

export class VADManager {
  private audioContext: AudioContext | null = null;
  private vadNode: AudioWorkletNode | null = null;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private isInitialized = false;
  private eventListeners: ((event: VADEvent) => void)[] = [];

  constructor(private config: VADConfig = {}) {
    this.config = {
      energyThreshold: 0.01,
      silenceThreshold: 500,
      minSpeechDuration: 300,
      ...config
    };
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Create audio context
      this.audioContext = new AudioContext({ sampleRate: 16000 });
      
      // Register VAD worklet
      const vadProcessorBlob = new Blob([VADProcessorCode], { type: 'application/javascript' });
      const vadProcessorUrl = URL.createObjectURL(vadProcessorBlob);
      
      await this.audioContext.audioWorklet.addModule(vadProcessorUrl);
      
      // Create VAD worklet node
      this.vadNode = new AudioWorkletNode(this.audioContext, 'VADProcessor');
      
      // Set up message handling
      this.vadNode.port.onmessage = (event) => {
        const vadEvent: VADEvent = event.data;
        this.notifyListeners(vadEvent);
      };
      
      // Configure VAD
      this.vadNode.port.postMessage({
        type: 'configure',
        data: this.config
      });
      
      this.isInitialized = true;
      
      // Clean up blob URL
      URL.revokeObjectURL(vadProcessorUrl);
    } catch (error) {
      console.error('Failed to initialize VAD:', error);
      throw error;
    }
  }

  async startListening(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      // Get microphone access
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      // Create source node and connect to VAD
      this.sourceNode = this.audioContext!.createMediaStreamSource(this.mediaStream);
      this.sourceNode.connect(this.vadNode!);
      
      // Resume audio context if suspended
      if (this.audioContext!.state === 'suspended') {
        await this.audioContext!.resume();
      }
    } catch (error) {
      console.error('Failed to start VAD listening:', error);
      throw error;
    }
  }

  stopListening(): void {
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    if (this.vadNode) {
      this.vadNode.port.postMessage({ type: 'reset' });
    }
  }

  updateConfig(newConfig: Partial<VADConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    if (this.vadNode) {
      this.vadNode.port.postMessage({
        type: 'configure',
        data: newConfig
      });
    }
  }

  addEventListener(listener: (event: VADEvent) => void): void {
    this.eventListeners.push(listener);
  }

  removeEventListener(listener: (event: VADEvent) => void): void {
    const index = this.eventListeners.indexOf(listener);
    if (index > -1) {
      this.eventListeners.splice(index, 1);
    }
  }

  private notifyListeners(event: VADEvent): void {
    this.eventListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in VAD event listener:', error);
      }
    });
  }

  destroy(): void {
    this.stopListening();
    
    if (this.vadNode) {
      this.vadNode.disconnect();
      this.vadNode = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.eventListeners = [];
    this.isInitialized = false;
  }

  get isListening(): boolean {
    return this.mediaStream !== null && this.sourceNode !== null;
  }

  get isActive(): boolean {
    return this.isInitialized && this.audioContext?.state === 'running';
  }
}