import { NextApiRequest, NextApiResponse } from 'next';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// Define the endCallTool for Gemini
const endCallTool = {
  name: 'endCallTool',
  description: 'Call this tool to terminate the current conversation session',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      reason: {
        type: SchemaType.STRING,
        description: 'Optional reason for ending the call',
      },
    },
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message, conversationHistory = [] } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      tools: [{ functionDeclarations: [endCallTool] }],
    });

    // Build conversation context
    const history = conversationHistory.map((msg: any) => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }],
    }));

    const chat = model.startChat({ history });
    const result = await chat.sendMessage(message);
    const response = await result.response;

    // Check for tool calls
    const functionCalls = response.functionCalls();
    const textResponse = response.text();

    if (functionCalls && functionCalls.length > 0) {
      const endCallFunction = functionCalls.find(
        call => call.name === 'endCallTool'
      );
      if (endCallFunction) {
        return res.status(200).json({
          response: textResponse + ' Goodbye! The conversation has ended.',
          shouldEndCall: true,
          toolCall: endCallFunction,
        });
      }
    }

    res.status(200).json({
      response: textResponse,
      shouldEndCall: false,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('Conversation Error:', error);
    res.status(500).json({
      error: 'Failed to get conversation response',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
