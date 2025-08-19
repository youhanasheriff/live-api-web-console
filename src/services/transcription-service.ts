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

import {
  TranscriptionRequest,
  TranscriptionResponse,
} from '../types/chat-history';

/**
 * Service for handling OpenAPI transcription requests
 * Converts audio data to text using OpenAI's Whisper API
 */
export class TranscriptionService {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey?: string, baseUrl: string = 'https://api.openai.com/v1') {
    this.apiKey = apiKey || process.env.REACT_APP_OPENAI_API_KEY || '';
    this.baseUrl = baseUrl;

    if (!this.apiKey) {
      console.warn(
        'OpenAI API key not provided. Transcription service will not work.'
      );
    }
  }

  /**
   * Transcribe audio data to text
   */
  async transcribeAudio(
    request: TranscriptionRequest
  ): Promise<TranscriptionResponse> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key is required for transcription');
    }

    try {
      // Convert base64 audio data to audio blob
      const audioBlob = this.convertBase64ToBlob(
        request.audioData,
        request.mimeType
      );

      // Create form data for the API request
      const formData = new FormData();
      formData.append('file', audioBlob, 'audio.wav');
      formData.append('model', 'whisper-1');
      formData.append('language', request.language || 'en');
      formData.append('response_format', 'json');

      const response = await fetch(`${this.baseUrl}/audio/transcriptions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `Transcription failed: ${response.status} ${
            response.statusText
          } - ${JSON.stringify(errorData)}`
        );
      }

      const result = await response.json();

      return {
        text: result.text || '',
        confidence: result.confidence || 0,
        segments: result.segments || [],
      };
    } catch (error) {
      console.error('Transcription error:', error);
      throw error;
    }
  }

  /**
   * Convert base64 audio data to blob
   */
  private convertBase64ToBlob(audioData: string, mimeType: string): Blob {
    // Validate base64 format
    const base64Pattern = /^[A-Za-z0-9+/]*={0,2}$/;
    if (!base64Pattern.test(audioData)) {
      throw new Error('Invalid base64 audio data format');
    }

    // Validate that audioData is not empty
    if (!audioData || audioData.trim().length === 0) {
      throw new Error('Empty base64 audio data');
    }

    let binaryString: string;
    try {
      binaryString = atob(audioData);
    } catch (error) {
      throw new Error(`Failed to decode base64 audio data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Validate that we have actual audio data
    if (bytes.length === 0) {
      throw new Error('No audio data after base64 decoding');
    }

    // If it's PCM data, convert to WAV
    if (mimeType.includes('pcm')) {
      return this.convertPcmToWav(bytes);
    }

    return new Blob([bytes], { type: mimeType });
  }

  /**
   * Convert PCM data to WAV format
   */
  private convertPcmToWav(pcmData: Uint8Array): Blob {
    const wavHeader = this.createWavHeader(pcmData.length);
    const wavData = new Uint8Array(wavHeader.length + pcmData.length);
    wavData.set(wavHeader, 0);
    wavData.set(pcmData, wavHeader.length);
    return new Blob([wavData], { type: 'audio/wav' });
  }

  /**
   * Combine multiple base64 audio chunks into a single audio blob
   */
  combineAudioChunks(audioChunks: string[]): Blob {
    // Convert base64 chunks to binary data
    const binaryChunks = audioChunks.map(chunk => {
      const binaryString = atob(chunk);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes;
    });

    // Calculate total length
    const totalLength = binaryChunks.reduce(
      (sum, chunk) => sum + chunk.length,
      0
    );

    // Combine all chunks
    const combinedArray = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of binaryChunks) {
      combinedArray.set(chunk, offset);
      offset += chunk.length;
    }

    return this.convertPcmToWav(combinedArray);
  }

  /**
   * Create WAV header for PCM audio
   */
  private createWavHeader(dataLength: number): Uint8Array {
    const sampleRate = 16000;
    const numChannels = 1;
    const bitsPerSample = 16;
    const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
    const blockAlign = (numChannels * bitsPerSample) / 8;
    const fileSize = 36 + dataLength;

    const header = new ArrayBuffer(44);
    const view = new DataView(header);

    // RIFF header
    view.setUint32(0, 0x52494646, false); // "RIFF"
    view.setUint32(4, fileSize, true);
    view.setUint32(8, 0x57415645, false); // "WAVE"

    // fmt chunk
    view.setUint32(12, 0x666d7420, false); // "fmt "
    view.setUint32(16, 16, true); // chunk size
    view.setUint16(20, 1, true); // audio format (PCM)
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);

    // data chunk
    view.setUint32(36, 0x64617461, false); // "data"
    view.setUint32(40, dataLength, true);

    return new Uint8Array(header);
  }

  /**
   * Test the transcription service with a simple request
   */
  async testConnection(): Promise<boolean> {
    if (!this.apiKey) {
      return false;
    }

    try {
      // Create a minimal test audio file (silence)
      const testAudio = new Uint8Array(1600); // 0.1 seconds of silence at 16kHz
      const wavHeader = this.createWavHeader(testAudio.length);
      const wavData = new Uint8Array(wavHeader.length + testAudio.length);
      wavData.set(wavHeader, 0);
      wavData.set(testAudio, wavHeader.length);

      const testBlob = new Blob([wavData], { type: 'audio/wav' });

      const formData = new FormData();
      formData.append('file', testBlob, 'test.wav');
      formData.append('model', 'whisper-1');
      formData.append('response_format', 'json');

      const response = await fetch(`${this.baseUrl}/audio/transcriptions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: formData,
      });

      return response.ok;
    } catch (error) {
      console.error('Transcription service test failed:', error);
      return false;
    }
  }
}

// Export a singleton instance
export const transcriptionService = new TranscriptionService();
