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

import { audioContext } from './utils';
import AudioRecordingWorklet from './worklets/audio-processing';
import VolMeterWorklet from './worklets/vol-meter';


import EventEmitter from 'eventemitter3';

function arrayBufferToBase64(buffer: ArrayBuffer) {
  var binary = '';
  var bytes = new Uint8Array(buffer);
  var len = bytes.byteLength;
  for (var i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

export class AudioRecorder extends EventEmitter {
  stream: MediaStream | undefined;
  audioContext: AudioContext | undefined;
  source: MediaStreamAudioSourceNode | undefined;
  recording: boolean = false;
  recordingWorklet: AudioWorkletNode | undefined;
  vuWorklet: AudioWorkletNode | undefined;

  private starting: Promise<void> | null = null;

  constructor(public sampleRate = 16000) {
    super();
  }

  async start() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Could not request user media');
    }

    this.starting = new Promise(async (resolve, reject) => {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioContext = await audioContext({ sampleRate: this.sampleRate });
      this.source = this.audioContext.createMediaStreamSource(this.stream);

      // Load both worklet modules first
      const workletName = 'audio-recorder-worklet';
      const src = URL.createObjectURL(new Blob([AudioRecordingWorklet], { type: 'application/javascript' }));
      const vuWorkletName = 'vu-meter';
      const vuSrc = URL.createObjectURL(new Blob([VolMeterWorklet], { type: 'application/javascript' }));

      // Load modules sequentially to avoid race conditions
      try {
        await this.audioContext.audioWorklet.addModule(src);
        await this.audioContext.audioWorklet.addModule(vuSrc);

        // Clean up blob URLs after loading
        URL.revokeObjectURL(src);
        URL.revokeObjectURL(vuSrc);

        // Create worklet nodes after both modules are loaded
        this.recordingWorklet = new AudioWorkletNode(
          this.audioContext,
          workletName
        );
      } catch (error) {
        console.error(
          'Failed to load audio worklet modules or create nodes:',
          error
        );
        reject(error);
        return;
      }

      this.recordingWorklet.port.onmessage = async (ev: MessageEvent) => {
        // worklet processes recording floats and messages converted buffer
        const arrayBuffer = ev.data.data.int16arrayBuffer;

        if (arrayBuffer) {
          const arrayBufferString = arrayBufferToBase64(arrayBuffer);
          this.emit('data', arrayBufferString);
        }
      };
      this.source.connect(this.recordingWorklet);

      // Create vu meter worklet
      try {
        this.vuWorklet = new AudioWorkletNode(this.audioContext, vuWorkletName);
        this.vuWorklet.port.onmessage = (ev: MessageEvent) => {
          this.emit('volume', ev.data.volume);
        };
        this.source.connect(this.vuWorklet);
      } catch (error) {
        console.error('Failed to create vu meter worklet:', error);
        // Continue without vu meter if it fails
      }
      this.recording = true;
      resolve();
      this.starting = null;
    });
  }

  stop() {
    // its plausible that stop would be called before start completes
    // such as if the websocket immediately hangs up
    const handleStop = () => {
      this.source?.disconnect();
      this.stream?.getTracks().forEach(track => track.stop());
      this.stream = undefined;
      this.recordingWorklet = undefined;
      this.vuWorklet = undefined;
    };
    if (this.starting) {
      this.starting.then(handleStop);
      return;
    }
    handleStop();
  }
}
