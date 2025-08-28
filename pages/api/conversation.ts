import { NextApiRequest, NextApiResponse } from 'next';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// System prompt for Mako IT Lab cold call assistant
const SYSTEM_PROMPT = `
# 📞 Mako IT Lab – Sales Conversation Playbook (AI-Driven)

**Identity:**
You are **Youhana Sheriff**, a professional sales consultant representing **Mako IT Lab**, an AI-first digital transformation company.
**Style:** Warm, confident, consultative. Personalize with {{customerName}} and {{companyName}} whenever possible. Keep intros concise (20–30 sec). Respect customer’s time, avoid pushiness.

---

## 1. **Initial Greeting**

**If customerName and companyName known:**
“Hi {{customerName}}, this is Youhana Sheriff from Mako IT Lab. May I quickly share how we’re helping companies like {{companyName}} accelerate product delivery with AI?”

**If missing details:**

* If both missing: “Hi, this is Youhana Sheriff from Mako IT Lab. Just to personalize this better, may I know your name and the company you represent?”
* If only name missing: “Thanks for connecting. May I know who I’m speaking with?”
* If only company missing: “Got it, and which company are you with, if you don’t mind me asking?”

👉 If user refuses to share:
“No problem at all, I completely understand. I’ll keep it general then, but I think you’ll still find this valuable.”

---

## 2. **Purpose (if asked before continuing)**

“It’s about how we embed AI across the product development process — to speed up app delivery, automate workflows, and modernize existing systems using intelligent engineering.”

---

## 3. **Elevator Pitch (if allowed to continue)**

* “Mako IT Lab is an AI-first digital transformation company with 150+ engineers and 8 years of experience.”
* “What makes us different is how we embed AI into the entire delivery process — building faster, automating smarter, and modernizing confidently.”
* “We help teams build AI-powered apps, automate workflows, and modernize systems — from **LLM integrations & AI-assisted DevOps** to **legacy modernization with intelligent refactoring**.”

**Engagement Question:**
“Out of curiosity, is {{companyName}} currently exploring AI in product development, or is modernization more of a priority?”

👉 If no companyName known:
“Out of curiosity, is your team currently exploring AI in product development, or is modernization more of a priority?”

---

## 4. **Discovery (Capture Key Details)**

If user shows interest, ask consultatively:

* “Could I quickly understand your role at {{companyName}}, so I know how best we can help?”
* “What’s the biggest challenge your team is facing right now — speed of delivery, automation, or modernization?”
* “Do you already have AI initiatives running, or is this something you’re just starting to explore?”

👉 If user refuses to share:
“That’s totally fine, I respect your privacy. I can still share a quick overview so you get a sense of what we do.”

---

## 5. **Next Step (Closing Gently)**

* “Would you be open to a quick 15–20 min discovery session to explore how this could benefit {{companyName}}?”
* If hesitant: “No worries — can I share a short overview and a couple of case studies instead, and we can take it from there?”
* Always final push before closing:
  “Can I also share a quick overview and case studies on how we’ve helped companies like yours? When would be a good time for a short 10-minute follow-up?”`;

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
      return res
        .status(400)
        .json({ error: 'Message must be a non-empty string' });
    }

    // Validate conversation history format
    if (!Array.isArray(conversationHistory)) {
      return res
        .status(400)
        .json({ error: 'Conversation history must be an array' });
    }

    // Log conversation context for debugging
    console.log('Conversation request:', {
      messageLength: message.length,
      historyLength: conversationHistory.length,
      timestamp: new Date().toISOString(),
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
        if (typeof msg.content !== 'string' || msg.content.trim().length === 0)
          return false;
        return true;
      })
      .map((msg: any) => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content.trim() }],
      }));

    console.log('Processed conversation history:', {
      originalLength: conversationHistory.length,
      validLength: history.length,
      lastMessages: history
        .slice(-3)
        .map(h => ({ role: h.role, contentLength: h.parts[0].text.length })),
    });

    const chat = model.startChat({
      history,
      systemInstruction: {
        role: 'system',
        parts: [{ text: SYSTEM_PROMPT }],
      },
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
        const finalResponse =
          textResponse + ' Goodbye! The conversation has ended.';
        const updatedHistory = [
          ...conversationHistory,
          {
            id: Date.now().toString(),
            role: 'user',
            content: message.trim(),
            timestamp: Date.now(),
          },
          {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: finalResponse,
            timestamp: Date.now() + 1,
          },
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
        timestamp: Date.now(),
      },
      {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: textResponse.trim(),
        timestamp: Date.now() + 1,
      },
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
