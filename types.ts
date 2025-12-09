export enum Role {
  USER = 'user',
  MODEL = 'model'
}

export interface Message {
  id: string;
  role: Role;
  content: string;
  isStreaming?: boolean;
  timestamp: number;
}

export interface Topic {
  id: string;
  title: string;
  messageId: string; // The ID of the message where this topic started
}

export interface ChatSession {
  id: string;
  userId: string;
  title: string;
  messages: Message[];
  topics: Topic[];
  timestamp: number;
  isFavorite?: boolean;
}

export interface User {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  avatar?: string;
}