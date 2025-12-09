import { GoogleGenAI, Chat, GenerateContentResponse, Content, Part } from "@google/genai";
import { Message, Role } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

let chatInstance: Chat | null = null;

// Helper to convert internal Message type to GenAI SDK Content type
const convertMessagesToHistory = (messages: Message[]): Content[] => {
  return messages.map(msg => ({
    role: msg.role === Role.USER ? 'user' : 'model',
    parts: [{ text: msg.content }] as Part[]
  }));
};

export const initializeChat = (systemInstruction?: string, previousMessages: Message[] = []) => {
  const history = previousMessages.length > 0 ? convertMessagesToHistory(previousMessages) : undefined;
  
  chatInstance = ai.chats.create({
    model: 'gemini-2.5-flash',
    history: history,
    config: {
      systemInstruction: systemInstruction || "You are a helpful, knowledgeable, and friendly AI assistant.",
      thinkingConfig: { thinkingBudget: 0 }
    },
  });
  return chatInstance;
};

export const getChatInstance = () => {
  if (!chatInstance) {
    return initializeChat();
  }
  return chatInstance;
};

export const resetChat = () => {
  chatInstance = null;
  return initializeChat();
};

export const sendMessageStream = async (message: string): Promise<AsyncIterable<GenerateContentResponse>> => {
  const chat = getChatInstance();
  
  try {
    const responseStream = await chat.sendMessageStream({ message });
    return responseStream;
  } catch (error) {
    console.error("Error sending message:", error);
    throw error;
  }
};

/**
 * Analyzes a new message against the previous topic to determine if a new topic has started.
 */
export const analyzeTopic = async (message: string, currentTopic: string | null): Promise<{ isNewTopic: boolean; title?: string }> => {
  try {
    const prompt = `
      You are a topic classifier for a chat log.
      
      Task: Determine if the "New Message" introduces a significantly different subject than the "Current Topic".
      
      Rules:
      1. If "Current Topic" is 'null' or empty, this is the first topic. Return isNewTopic: true and generate a concise title (max 4-5 words).
      2. If the "New Message" is a follow-up, clarification, or directly related to the "Current Topic", return isNewTopic: false.
      3. If the "New Message" changes the subject completely (e.g., moving from Math to History), return isNewTopic: true and a new concise title.
      
      Current Topic: "${currentTopic || 'None'}"
      New Message: "${message}"
      
      Response Format (JSON only):
      {
        "isNewTopic": boolean,
        "title": "string (only if isNewTopic is true, otherwise null)"
      }
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const text = response.text;
    if (!text) return { isNewTopic: false };
    
    return JSON.parse(text);
  } catch (error) {
    console.error("Error analyzing topic:", error);
    return { isNewTopic: false };
  }
};

/**
 * Generates context-aware follow-up suggestions based on chat history.
 */
export const getSuggestions = async (history: Message[]): Promise<string[]> => {
  try {
    // Use last 6 messages for context to keep it relevant and fast
    const conversationContext = history.slice(-6).map(m => 
      `${m.role === Role.USER ? 'User' : 'AI'}: ${m.content}`
    ).join('\n');

    const prompt = `
      Based on the conversation below, generate 3 short, natural, and relevant follow-up questions or actions the User might want to take next.
      
      Constraints:
      - Max 3 suggestions.
      - Keep them concise (under 8 words each).
      - Do not simply say "Thank you".
      - Return ONLY a raw JSON array of strings.
      
      Conversation:
      ${conversationContext}
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const text = response.text;
    if (!text) return [];
    
    return JSON.parse(text);
  } catch (error) {
    console.error("Error generating suggestions:", error);
    return [];
  }
};

/**
 * Generates a concise summary of the provided chat messages.
 */
export const generateChatSummary = async (messages: Message[]): Promise<string> => {
  try {
    const conversation = messages.map(m => `${m.role === Role.USER ? 'User' : 'AI'}: ${m.content}`).join('\n');
    const prompt = `
      Summarize the following chat conversation in 3-5 concise bullet points.
      Capture the main topics and key decisions or information provided.
      Use Markdown formatting.

      Conversation:
      ${conversation}
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "Could not generate summary.";
  } catch (error) {
    console.error("Error generating summary:", error);
    return "Error generating summary. Please try again later.";
  }
};
