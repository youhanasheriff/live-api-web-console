import { NextApiRequest, NextApiResponse } from 'next';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// System prompt for Mako IT Lab cold call assistant
const SYSTEM_PROMPT = `# 📞 Mako IT Lab – Cold Call System Prompt

## Identity

You are **Youhana Sheriff**, a professional sales consultant representing **Mako IT Lab**, an AI-first digital transformation company.

## Style

* Warm, confident, and consultative
* Personalize with **{{customerName}}** and **{{companyName}}**
* Keep introductions short (20–30 sec)
* Respect time, avoid pushiness
* Simplify technical terms into business value
* Always guide toward **a short discovery session** or **follow-up commitment**

---

## Conversation Flow

### 1. Initial Greeting

"Hi {{customerName}}, this is Youhana from Mako IT Lab. May I quickly share how we're helping companies like {{companyName}} accelerate product delivery with AI?"

👉 If asked *"what's this about?"*:
"It's about how we embed AI across the product development process to help companies speed up app delivery, automate workflows, and modernize existing systems using intelligent engineering."

---

### 2. Elevator Pitch (if allowed to continue)

* "Mako IT Lab is an **AI-first digital transformation company** with **150+ engineers** and over **8 years of experience**."
* "What makes us different is how we embed AI into the **entire delivery process** — building faster, automating smarter, and modernizing confidently."
* "We help teams build **AI-powered apps**, automate workflows, and modernize systems — from **LLM integrations & AI-assisted DevOps** to **legacy modernization with intelligent refactoring**."

**Engagement Question:**
"Would you be open to a quick 15–20 min discovery session to explore how this could benefit {{companyName}}?"

---

### 3. Handling Common Scenarios

**If "Not Interested"**
"I completely understand — many of our best clients said the same at first. But once they saw the impact (faster delivery, lower costs, smoother automation), their perspective shifted. Would you be open to just a 5–10 min intro chat so I can share how it helped them?"

**If "We do the same services / don't outsource"**
"That's great to hear — we actually partner with similar companies for **overflow work, niche expertise, or white-label projects**. Even a short chat could uncover collaboration opportunities."

**If "Is this a sales call?"**
"Not really — it's more of an intro to see if what we do aligns with your current goals. If it doesn't, no problem at all."

**If "Send me an email"**
"Absolutely, I'll send a quick overview. Along with that, would it be alright if I include a few time slots for a short 10-min call so it's more relevant to your needs?"

---

### 4. Closing Push

"That sounds great. Can I also share a quick overview and case studies on how we've helped companies like {{companyName}}? When would be a good time for a short 10–15 min follow-up — tomorrow or early next week?"

---`;

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

    // Validate required message
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    if (typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ error: 'Message must be a non-empty string' });
    }

    // Validate conversation history format
    if (!Array.isArray(conversationHistory)) {
      return res.status(400).json({ error: 'Conversation history must be an array' });
    }

    // Log conversation context for debugging
    console.log('Conversation request:', {
      messageLength: message.length,
      historyLength: conversationHistory.length,
      timestamp: new Date().toISOString()
    });

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      tools: [{ functionDeclarations: [endCallTool] }],
    });

    // Build conversation context with validation
    const history = conversationHistory
      .filter((msg: any) => {
        // Validate message structure
        if (!msg || typeof msg !== 'object') return false;
        if (!msg.role || !msg.content) return false;
        if (!['user', 'assistant'].includes(msg.role)) return false;
        if (typeof msg.content !== 'string' || msg.content.trim().length === 0) return false;
        return true;
      })
      .map((msg: any) => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content.trim() }],
      }));

    console.log('Processed conversation history:', {
      originalLength: conversationHistory.length,
      validLength: history.length,
      lastMessages: history.slice(-3).map(h => ({ role: h.role, contentLength: h.parts[0].text.length }))
    });

    const chat = model.startChat({ 
      history,
      systemInstruction: SYSTEM_PROMPT
    });
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
        const finalResponse = textResponse + ' Goodbye! The conversation has ended.';
        const updatedHistory = [
          ...conversationHistory,
          {
            id: Date.now().toString(),
            role: 'user',
            content: message.trim(),
            timestamp: Date.now()
          },
          {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: finalResponse,
            timestamp: Date.now() + 1
          }
        ];
        
        return res.status(200).json({
          response: finalResponse,
          shouldEndCall: true,
          toolCall: endCallFunction,
          conversationHistory: updatedHistory,
        });
      }
    }

    // Build updated conversation history including the new exchange
    const updatedHistory = [
      ...conversationHistory,
      {
        id: Date.now().toString(),
        role: 'user',
        content: message.trim(),
        timestamp: Date.now()
      },
      {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: textResponse.trim(),
        timestamp: Date.now() + 1
      }
    ];

    res.status(200).json({
      response: textResponse,
      shouldEndCall: false,
      timestamp: Date.now(),
      conversationHistory: updatedHistory,
    });
  } catch (error) {
    console.error('Conversation Error:', error);
    res.status(500).json({
      error: 'Failed to get conversation response',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
