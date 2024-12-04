import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import type { NextApiRequest, NextApiResponse } from 'next';
import getConfig from 'next/config';

const { serverRuntimeConfig } = getConfig();
const genAI = new GoogleGenerativeAI(serverRuntimeConfig.geminiApiKey);

const translationSchema = {
  type: SchemaType.OBJECT,
  properties: {
    response: {
      type: SchemaType.STRING,
      description: "The English translation of the Japanese text",
      nullable: false,
    },
  },
  required: ["response"],
};

const conversationSchema = {
  type: SchemaType.OBJECT,
  properties: {
    response: {
      type: SchemaType.STRING,
      description: "The Japanese conversation response",
      nullable: false,
    },
  },
  required: ["response"],
};

const translationModel = genAI.getGenerativeModel({
  model: "gemini-1.5-flash-8b",
  generationConfig: {
    responseMimeType: "application/json",
    responseSchema: translationSchema,
  },
});

const conversationModel = genAI.getGenerativeModel({
  model: "gemini-1.5-flash-8b",
  generationConfig: {
    responseMimeType: "application/json",
    responseSchema: conversationSchema,
  },
});

// Rate limiting stores
const globalRequests = {
  count: 0,
  resetTime: Date.now()
};

const ipRequests = new Map<string, { count: number; resetTime: number }>();

// Rate limit checker
const checkRateLimit = (req: NextApiRequest): { limited: boolean; message?: string } => {
  const now = Date.now();
  const minute = 60 * 1000; // milliseconds in a minute

  // Reset global counter if minute has passed
  if (now - globalRequests.resetTime >= minute) {
    globalRequests.count = 0;
    globalRequests.resetTime = now;
  }

  // Check global limit
  if (globalRequests.count >= 700) {
    return { limited: true, message: 'Global rate limit exceeded. Please try again later.' };
  }

  // Get client IP
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || 
             req.socket.remoteAddress || 
             'unknown';

  // For unknown IPs, only apply global limit
  if (ip === 'unknown') {
    globalRequests.count++;
    return { limited: false };
  }

  // Initialize or reset IP counter
  if (!ipRequests.has(ip) || now - ipRequests.get(ip)!.resetTime >= minute) {
    ipRequests.set(ip, { count: 0, resetTime: now });
  }

  const ipData = ipRequests.get(ip)!;

  // Check IP limit
  if (ipData.count >= 30) {
    return { limited: true, message: 'Rate limit exceeded. Please try again later.' };
  }

  // Increment counters
  globalRequests.count++;
  ipData.count++;

  return { limited: false };
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  // Check rate limits
  const rateLimitCheck = checkRateLimit(req);
  if (rateLimitCheck.limited) {
    return res.status(429).json({ error: rateLimitCheck.message });
  }

  try {
    const { message, conversationHistory, isTranslation } = req.body;
    let prompt, result;

    if (isTranslation) {
      prompt = `Translate the following Japanese text to English: ${message}`;
      result = await translationModel.generateContent(prompt);
    } else {
      prompt = `
あなたは日本語の会話パートナーです。以下の会話履歴を参考にして、学生と日本語で会話を続けてください。

会話履歴:
${conversationHistory}

学生: ${message}`;
      result = await conversationModel.generateContent(prompt);
    }

    const responseText = result.response.text();
    res.status(200).json(JSON.parse(responseText));
  } catch (error) {
    console.error('Failed to get response from Gemini', error);
    res.status(500).json({ error: 'Failed to get response from Gemini' });
  }
} 