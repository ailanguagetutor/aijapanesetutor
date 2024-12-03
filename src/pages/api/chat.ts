import { GoogleGenerativeAI } from '@google/generative-ai';
import type { NextApiRequest, NextApiResponse } from 'next';
import getConfig from 'next/config';

const { serverRuntimeConfig } = getConfig();
const genAI = new GoogleGenerativeAI(serverRuntimeConfig.geminiApiKey);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-8b" });

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { message, conversationHistory } = req.body;
    const prompt = `
あなたは日本語の会話パートナーです。以下の会話履歴を参考にして、学生と日本語で会話を続けてください。質問に答えたり、会話を進めたりしてください。

会話履歴:
${conversationHistory}

学生: ${message}

あなた:`;

    const result = await model.generateContent(prompt);

    res.status(200).json({ response: result.response.text() });
  } catch (error) {
    console.error('Failed to get response from Gemini', error);
    res.status(500).json({ error: 'Failed to get response from Gemini' });
  }
} 