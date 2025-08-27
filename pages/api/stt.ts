import { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Function to create WAV file from PCM16 data
function createWavFile(
  pcm16Buffer: Buffer,
  sampleRate: number = 16000
): Buffer {
  const length = pcm16Buffer.length;
  const arrayBuffer = new ArrayBuffer(44 + length);
  const view = new DataView(arrayBuffer);

  // WAV header
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF'); // ChunkID
  view.setUint32(4, 36 + length, true); // ChunkSize
  writeString(8, 'WAVE'); // Format
  writeString(12, 'fmt '); // Subchunk1ID
  view.setUint32(16, 16, true); // Subchunk1Size
  view.setUint16(20, 1, true); // AudioFormat (PCM)
  view.setUint16(22, 1, true); // NumChannels (mono)
  view.setUint32(24, sampleRate, true); // SampleRate
  view.setUint32(28, sampleRate * 2, true); // ByteRate
  view.setUint16(32, 2, true); // BlockAlign
  view.setUint16(34, 16, true); // BitsPerSample
  writeString(36, 'data'); // Subchunk2ID
  view.setUint32(40, length, true); // Subchunk2Size

  // Copy PCM data
  const pcmView = new Uint8Array(arrayBuffer, 44);
  pcmView.set(new Uint8Array(pcm16Buffer));

  return Buffer.from(arrayBuffer);
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { audioData } = req.body;

    if (!audioData) {
      return res.status(400).json({ error: 'Audio data is required' });
    }

    // Convert base64 audio to buffer (PCM16 data)
    const pcm16Buffer = Buffer.from(audioData, 'base64');

    // Create proper WAV file with headers
    const wavBuffer = createWavFile(pcm16Buffer, 16000);

    // Create a File object for OpenAI API
    const audioFile = new File([wavBuffer], 'audio.wav', {
      type: 'audio/wav',
    });

    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'gpt-4o-mini-transcribe',
      language: 'en',
      response_format: 'text',
    });

    res.status(200).json({
      transcription: transcription,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('STT Error:', error);
    res.status(500).json({
      error: 'Failed to transcribe audio',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};
