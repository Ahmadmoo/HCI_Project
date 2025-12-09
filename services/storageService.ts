import { ChatSession } from '../types';

const CHATS_KEY = 'gemini_clone_chats';

export const storageService = {
  saveChat: (session: ChatSession) => {
    const chatsStr = localStorage.getItem(CHATS_KEY);
    let chats: ChatSession[] = chatsStr ? JSON.parse(chatsStr) : [];
    
    // Ensure the new session has a topics array, defaulting to empty if undefined
    const safeSession = { ...session, topics: session.topics || [] };

    const existingIndex = chats.findIndex(c => c.id === safeSession.id);
    if (existingIndex >= 0) {
      // Preserve isFavorite status if updating an existing chat
      safeSession.isFavorite = chats[existingIndex].isFavorite;
      chats[existingIndex] = safeSession;
    } else {
      chats.unshift(safeSession); // Add to beginning
    }
    
    localStorage.setItem(CHATS_KEY, JSON.stringify(chats));
  },

  getUserChats: (userId: string): ChatSession[] => {
    const chatsStr = localStorage.getItem(CHATS_KEY);
    const chats: ChatSession[] = chatsStr ? JSON.parse(chatsStr) : [];
    
    return chats
        .filter(c => c.userId === userId)
        .map(c => ({ ...c, topics: c.topics || [] })) // Ensure topics exist on load
        .sort((a, b) => {
            // Sort by Favorite first (true comes before false)
            if (a.isFavorite && !b.isFavorite) return -1;
            if (!a.isFavorite && b.isFavorite) return 1;
            
            // Then sort by timestamp (newest first)
            return b.timestamp - a.timestamp;
        });
  },
  
  updateChatTitle: (chatId: string, newTitle: string) => {
    const chatsStr = localStorage.getItem(CHATS_KEY);
    let chats: ChatSession[] = chatsStr ? JSON.parse(chatsStr) : [];
    const index = chats.findIndex(c => c.id === chatId);
    if (index !== -1) {
      chats[index].title = newTitle;
      localStorage.setItem(CHATS_KEY, JSON.stringify(chats));
    }
  },

  toggleChatFavorite: (chatId: string) => {
    const chatsStr = localStorage.getItem(CHATS_KEY);
    let chats: ChatSession[] = chatsStr ? JSON.parse(chatsStr) : [];
    const index = chats.findIndex(c => c.id === chatId);
    if (index !== -1) {
      chats[index].isFavorite = !chats[index].isFavorite;
      localStorage.setItem(CHATS_KEY, JSON.stringify(chats));
    }
  },
  
  deleteChat: (chatId: string) => {
    const chatsStr = localStorage.getItem(CHATS_KEY);
    let chats: ChatSession[] = chatsStr ? JSON.parse(chatsStr) : [];
    chats = chats.filter(c => c.id !== chatId);
    localStorage.setItem(CHATS_KEY, JSON.stringify(chats));
  }
};