/**
 * Voice Activity Detection (VAD) AudioWorklet
 * Detects when user is speaking based on audio energy and silence duration
 */

const VADProcessor = `
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
      
      // Add to audio buffer
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
    
    // Calculate smoothed energy
    const avgEnergy = this.energyHistory.reduce((a, b) => a + b, 0) / this.energyHistory.length;
    
    // Voice activity detection logic
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
      // Check for end of speech
      if (this.isVoiceActive && (currentTime - this.lastVoiceTime) > this.silenceThreshold) {
        const speechDuration = currentTime - this.speechStartTime;
        
        if (speechDuration >= this.minSpeechDuration) {
          // Valid speech segment ended
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
    
    // Send periodic updates
    this.port.postMessage({
      type: 'vadUpdate',
      isVoiceActive: this.isVoiceActive,
      energy: avgEnergy,
      timestamp: currentTime
    });
    
    return true;
  }
}
`;

export default VADProcessor;