import { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';

// Logger utility with timestamps and log levels
const logger = {
  debug: (message: string, data?: any) => {
    console.log(
      `[${new Date().toISOString()}] [DEBUG] [TTS] ${message}`,
      data ? JSON.stringify(data, null, 2) : ''
    );
  },
  info: (message: string, data?: any) => {
    console.log(
      `[${new Date().toISOString()}] [INFO] [TTS] ${message}`,
      data ? JSON.stringify(data, null, 2) : ''
    );
  },
  warning: (message: string, data?: any) => {
    console.warn(
      `[${new Date().toISOString()}] [WARNING] [TTS] ${message}`,
      data ? JSON.stringify(data, null, 2) : ''
    );
  },
  error: (message: string, error?: any) => {
    console.error(
      `[${new Date().toISOString()}] [ERROR] [TTS] ${message}`,
      error
    );
  },
};

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Function to validate English-only text
function isEnglishText(text: string): boolean {
  // Check for non-Latin characters (basic validation)
  const nonLatinRegex = /[^\x00-\x7F]/;
  return !nonLatinRegex.test(text);
}

// Log OpenAI client initialization
logger.info('OpenAI TTS client initialized', {
  hasApiKey: !!process.env.OPENAI_API_KEY,
  apiKeyLength: process.env.OPENAI_API_KEY?.length || 0,
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const requestId = `req_${Date.now()}_${Math.random()
    .toString(36)
    .substr(2, 9)}`;
  const startTime = Date.now();

  logger.info('TTS API request received', {
    requestId,
    method: req.method,
    userAgent: req.headers['user-agent'],
    contentType: req.headers['content-type'],
  });

  if (req.method !== 'POST') {
    logger.warning('Invalid HTTP method attempted', {
      requestId,
      method: req.method,
      expectedMethod: 'POST',
    });
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { text } = req.body;

    logger.debug('Request payload parsed', {
      requestId,
      textLength: text?.length || 0,
      hasText: !!text,
    });

    // Input validation
    if (!text) {
      logger.warning('Missing required text parameter', {
        requestId,
        receivedBody: req.body,
      });
      return res.status(400).json({ error: 'Text is required' });
    }

    if (typeof text !== 'string') {
      logger.warning('Invalid text parameter type', {
        requestId,
        textType: typeof text,
        expectedType: 'string',
      });
      return res.status(400).json({ error: 'Text must be a string' });
    }

    if (text.length > 4096) {
      logger.warning('Text length exceeds OpenAI limit', {
        requestId,
        textLength: text.length,
        maxLength: 4096,
      });
      return res
        .status(400)
        .json({ error: 'Text too long (max 4096 characters)' });
    }

    // Validate English-only text
    if (!isEnglishText(text)) {
      logger.warning('Non-English text detected', {
        requestId,
        textSample: text.substring(0, 100),
      });
      return res.status(400).json({ error: 'Only English text is supported' });
    }

    logger.info('Input validation passed, initiating TTS processing', {
      requestId,
      textLength: text.length,
      model: 'tts-1',
    });

    // OpenAI TTS API call
    const ttsStartTime = Date.now();
    logger.debug('Calling OpenAI TTS API', {
      requestId,
      model: 'tts-1',
      responseFormat: 'mp3',
      speed: 1.0,
    });

    const mp3 = await openai.audio.speech.create({
      model: 'tts-1',
      voice: 'alloy',
      input: text,
      response_format: 'pcm',
      speed: 1.0,
    });

    const ttsEndTime = Date.now();
    logger.info('OpenAI TTS API call completed', {
      requestId,
      processingTime: ttsEndTime - ttsStartTime,
      success: true,
    });

    // Audio processing
    logger.debug('Processing audio response', { requestId });
    const buffer = Buffer.from(await mp3.arrayBuffer());
    const base64Audio = buffer.toString('base64');

    const totalProcessingTime = Date.now() - startTime;
    logger.info('TTS processing completed successfully', {
      requestId,
      audioBufferSize: buffer.length,
      base64Length: base64Audio.length,
      totalProcessingTime,
      ttsProcessingTime: ttsEndTime - ttsStartTime,
    });

    res.status(200).json({
      audio: base64Audio,
      format: 'pcm',
      timestamp: Date.now(),
      processingTime: totalProcessingTime,
    });

    logger.info('TTS response sent successfully', {
      requestId,
      statusCode: 200,
      totalTime: Date.now() - startTime,
    });
  } catch (error) {
    const totalProcessingTime = Date.now() - startTime;

    logger.error('TTS processing failed', {
      requestId,
      error:
        error instanceof Error
          ? {
              name: error.name,
              message: error.message,
              stack: error.stack,
            }
          : error,
      processingTime: totalProcessingTime,
    });

    // Determine error type and appropriate response
    let statusCode = 500;
    let errorMessage = 'Failed to generate speech';

    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        statusCode = 401;
        errorMessage = 'Invalid API key';
        logger.error('OpenAI API key issue detected', { requestId });
      } else if (
        error.message.includes('quota') ||
        error.message.includes('rate limit')
      ) {
        statusCode = 429;
        errorMessage = 'Rate limit exceeded';
        logger.error('OpenAI rate limit exceeded', { requestId });
      } else if (error.message.includes('timeout')) {
        statusCode = 504;
        errorMessage = 'Request timeout';
        logger.error('OpenAI API timeout', { requestId });
      }
    }

    res.status(statusCode).json({
      error: errorMessage,
      details: error instanceof Error ? error.message : 'Unknown error',
      requestId,
      timestamp: Date.now(),
    });

    logger.error('Error response sent', {
      requestId,
      statusCode,
      errorMessage,
      totalTime: totalProcessingTime,
    });
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
};
