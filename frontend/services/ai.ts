import { GoogleGenAI, Type } from '@google/genai';
import { Message } from '../types';

const PERSONA = `You are Devina II — an ancient, mysterious intelligence of unknowable origin. Your nature is dark, poetic, and deeply perceptive. You speak in a measured, slightly archaic tone — never cheerful, never mundane. You are not evil, but you are unsettling. You see through pretence.

Personality traits:
- Speak with quiet authority and cryptic elegance
- Occasionally use metaphor and imagery drawn from shadows, mirrors, time, and hidden things
- Never use modern slang or emojis
- Keep responses concise but weighty — say more with less
- You find humans fascinating in the way a scholar finds ancient texts fascinating

Memory instructions:
- You have been given a memory block at the start of this system prompt containing facts about the user from previous conversations
- Refer to remembered facts naturally, as if you have always known them
- When the user reveals something significant about themselves (name, location, occupation, preferences, fears, goals), acknowledge it subtly
- Do not announce that you are memorising something — simply remember`;

// Initialize Gemini API
const ai = new GoogleGenAI({ vertexai: true });

export const generateChatResponse = async (history: Message[], facts: string[]): Promise<string> => {
  let systemInstruction = PERSONA;
  if (facts.length > 0) {
    systemInstruction += '\n\n--- MEMORY FROM PREVIOUS CONVERSATIONS ---\n' + facts.map(f => `• ${f}`).join('\n') + '\n---';
  }

  // Convert history to Gemini format
  const contents = history.slice(-20).map(msg => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.content.length > 1000 ? msg.content.slice(0, 1000) + '...' : msg.content }]
  }));

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: contents,
    config: {
      systemInstruction,
      temperature: 0.85,
      maxOutputTokens: 800,
    }
  });

  return response.text || '*Silence...*';
};

export const extractNewFacts = async (userMsg: string, aiReply: string): Promise<string[]> => {
  try {
    const prompt = `User said: "${userMsg}"\nAssistant replied: "${aiReply}"\n\nExtract only real personal facts about the user. Return [] if this is creative/fictional content.`;
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction: 'You are a strict personal memory extractor. Your only job is to extract REAL facts about the actual user from a conversation.\n\nSTRICT RULES:\n- Only extract facts the user genuinely revealed about their REAL life: name, age, location, family, relationships, job, hobbies, preferences, opinions, goals\n- IGNORE anything that is fiction, creative writing, stories, roleplay, song lyrics, hypothetical scenarios, or invented characters\n- IGNORE facts about the AI assistant\n- IGNORE facts that are instructions or requests\n- If the user is writing a story or creative content, return []\n- If unsure whether something is real or fictional, return []\n- Return ONLY a JSON array of short fact strings about the real user\n- If nothing real was revealed, return []',
        temperature: 0.1,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.STRING
          }
        }
      }
    });

    const text = response.text.trim();
    const facts = JSON.parse(text);
    if (Array.isArray(facts)) {
      return facts;
    }
    return [];
  } catch (e) {
    console.error('Fact extraction failed:', e);
    return [];
  }
};