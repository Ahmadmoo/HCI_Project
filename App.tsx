import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Menu, Moon, Sun, Book, Sparkles, Compass } from 'lucide-react';
import { GenerateContentResponse } from '@google/genai';
import Sidebar from './components/Sidebar';
import MessageBubble from './components/MessageBubble';
import ChatInput from './components/ChatInput';
import WelcomeScreen from './components/WelcomeScreen';
import AuthModal from './components/AuthModal';
import SubjectsPanel from './components/SubjectsPanel';
import GlobalTopicGraphModal from './components/GlobalTopicGraphModal'; // Import new modal
import { Message, Role, User, ChatSession, Topic } from './types';
import { sendMessageStream, initializeChat, resetChat, analyzeTopic, getSuggestions } from './services/geminiService';
import { authService } from './services/authService';
import { storageService } from './services/storageService';

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentTopics, setCurrentTopics] = useState<Topic[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Initialize sidebar state based on screen width (Closed on mobile by default)
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 768;
    }
    return false;
  });

  const [isDarkMode, setIsDarkMode] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isExploringMode, setIsExploringMode] = useState(false);
  
  // Auth & Storage State
  const [user, setUser] = useState<User | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [recentChats, setRecentChats] = useState<ChatSession[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  
  // Subjects Panel State
  const [isSubjectsPanelOpen, setIsSubjectsPanelOpen] = useState(false);

  // Global Graph State
  const [isGlobalGraphOpen, setIsGlobalGraphOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize App
  useEffect(() => {
    // Check Theme
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setIsDarkMode(true);
    }
    // Check Auth
    const currentUser = authService.getCurrentUser();
    if (currentUser) {
      setUser(currentUser);
      loadUserChats(currentUser.id);
    }
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Clear suggestions if exploring mode is turned off
  useEffect(() => {
    if (!isExploringMode) {
      setSuggestions([]);
    }
  }, [isExploringMode]);

  // Load Chats
  const loadUserChats = (userId: string) => {
    const chats = storageService.getUserChats(userId);
    setRecentChats(chats);
  };

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // --- Handlers ---

  const handleLoginSuccess = (loggedInUser: User) => {
    setUser(loggedInUser);
    loadUserChats(loggedInUser.id);
  };

  const handleLogout = () => {
    authService.logout();
    setUser(null);
    setRecentChats([]);
    handleNewChat();
  };

  const handleNewChat = () => {
    resetChat();
    setMessages([]);
    setCurrentTopics([]);
    setSuggestions([]);
    setCurrentChatId(null);
    // On mobile, keep sidebar open/closed state as user preference, or auto-close?
    // Usually on new chat we want to focus on the chat area.
    if (window.innerWidth < 768) {
        setIsSidebarOpen(false);
    }
    setIsSubjectsPanelOpen(false);
  };

  const handleSelectChat = (chat: ChatSession) => {
    setCurrentChatId(chat.id);
    setMessages(chat.messages);
    setCurrentTopics(chat.topics || []);
    setSuggestions([]); // Clear old suggestions
    
    // Re-initialize Gemini service with history
    initializeChat(undefined, chat.messages);
    
    if (window.innerWidth < 768) {
        setIsSidebarOpen(false);
    }
  };

  const handleDeleteChat = (e: React.MouseEvent, chatId: string) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this chat?')) {
        storageService.deleteChat(chatId);
        if (user) loadUserChats(user.id);
        if (currentChatId === chatId) {
            handleNewChat();
        }
    }
  };

  const handleRenameChat = (chatId: string, newTitle: string) => {
    storageService.updateChatTitle(chatId, newTitle);
    if (user) loadUserChats(user.id);
  };

  const handleToggleFavorite = (e: React.MouseEvent, chatId: string) => {
    e.stopPropagation();
    storageService.toggleChatFavorite(chatId);
    if (user) loadUserChats(user.id);
  };

  const handleForkChat = (originalChat: ChatSession, topicId: string) => {
    if (!user) return;

    // 1. Identify the range of messages for this topic
    const topicIndex = originalChat.topics.findIndex(t => t.id === topicId);
    if (topicIndex === -1) return;

    const currentTopic = originalChat.topics[topicIndex];
    const nextTopic = originalChat.topics[topicIndex + 1];

    const startIndex = originalChat.messages.findIndex(m => m.id === currentTopic.messageId);
    const endIndex = nextTopic 
      ? originalChat.messages.findIndex(m => m.id === nextTopic.messageId)
      : originalChat.messages.length;

    if (startIndex === -1) return;

    // 2. Slice messages
    const topicMessages = originalChat.messages.slice(startIndex, endIndex);

    // 3. Create new chat session
    const newChatId = Date.now().toString();
    const newSession: ChatSession = {
      id: newChatId,
      userId: user.id,
      title: `${currentTopic.title} (Fork)`,
      messages: topicMessages,
      topics: [{ ...currentTopic, messageId: topicMessages[0].id }], // Reset topic to start of this new chat
      timestamp: Date.now(),
      isFavorite: false
    };

    // 4. Save and Switch
    storageService.saveChat(newSession);
    loadUserChats(user.id);
    handleSelectChat(newSession);
  };

  const handleTopicClick = (messageId: string) => {
    const element = document.getElementById(messageId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (window.innerWidth < 768) {
        setIsSubjectsPanelOpen(false);
      }
    }
  };

  const handleSendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return;

    // Clear suggestions immediately
    setSuggestions([]);

    // 1. Add User Message
    const userMessageId = Date.now().toString();
    const userMessage: Message = {
      id: userMessageId,
      role: Role.USER,
      content: content,
      timestamp: Date.now(),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);

    // 2. Add Temporary AI Placeholder
    const aiPlaceholder: Message = {
      id: (Date.now() + 1).toString(),
      role: Role.MODEL,
      content: '',
      isStreaming: true,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, aiPlaceholder]);
    setIsLoading(true);

    let updatedTopics = [...currentTopics];

    // 3. Detect Topic Change (Parallel execution)
    const lastTopic = currentTopics.length > 0 ? currentTopics[currentTopics.length - 1].title : null;
    const topicAnalysisPromise = analyzeTopic(content, lastTopic);

    let chatId = currentChatId;
    let fullContent = '';

    try {
      // 4. Start Streaming
      const stream = await sendMessageStream(content);
      
      for await (const chunk of stream) {
        const c = chunk as GenerateContentResponse;
        if (c.text) {
            fullContent += c.text;
            
            setMessages(prev => {
                const updated = [...prev];
                const lastMsg = updated[updated.length - 1];
                if (lastMsg.role === Role.MODEL) {
                    lastMsg.content = fullContent;
                }
                return updated;
            });
        }
      }
      
      // 5. Finalize Message
      const finalAiMessage: Message = {
          ...aiPlaceholder,
          content: fullContent,
          isStreaming: false
      };

      const finalMessages = [...newMessages, finalAiMessage];
      setMessages(finalMessages);

      // 6. Handle Topic Result
      const topicResult = await topicAnalysisPromise;
      if (topicResult.isNewTopic && topicResult.title) {
        updatedTopics.push({
          id: Date.now().toString(),
          title: topicResult.title,
          messageId: userMessageId // Link to the user question
        });
        setCurrentTopics(updatedTopics);
      }

      // 7. Save to Storage (if logged in)
      if (user) {
          if (!chatId) {
              // Create new chat session
              chatId = Date.now().toString();
              setCurrentChatId(chatId);
          }

          const session: ChatSession = {
              id: chatId,
              userId: user.id,
              title: messages.length === 0 ? content.slice(0, 40) + (content.length > 40 ? '...' : '') : (recentChats.find(c => c.id === chatId)?.title || 'New Chat'),
              messages: finalMessages,
              topics: updatedTopics,
              timestamp: Date.now()
          };

          storageService.saveChat(session);
          loadUserChats(user.id);
      }

      // 8. Generate Follow-up Suggestions (Only if Exploring Mode is ON)
      if (isExploringMode) {
          getSuggestions(finalMessages).then(newSuggestions => {
            setSuggestions(newSuggestions);
          });
      }

    } catch (error) {
      console.error("Failed to generate response", error);
      setMessages(prev => {
         const updated = [...prev];
         const lastMsg = updated[updated.length - 1];
         lastMsg.content = "**Error:** Could not generate response. Please try again.";
         lastMsg.isStreaming = false;
         return updated;
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-full bg-white dark:bg-slate-950 overflow-hidden">
      
      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />

      {/* Sidebar */}
      <Sidebar 
        isOpen={isSidebarOpen} 
        toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} 
        onNewChat={handleNewChat}
        user={user}
        onLoginClick={() => setIsAuthModalOpen(true)}
        onLogoutClick={handleLogout}
        recentChats={recentChats}
        currentChatId={currentChatId}
        onSelectChat={handleSelectChat}
        onDeleteChat={handleDeleteChat}
        onRenameChat={handleRenameChat}
        onToggleFavorite={handleToggleFavorite}
        onForkChat={handleForkChat}
        onOpenGlobalGraph={() => setIsGlobalGraphOpen(true)}
      />

      {/* Subjects Panel */}
      <SubjectsPanel 
        isOpen={isSubjectsPanelOpen}
        onClose={() => setIsSubjectsPanelOpen(false)}
        topics={currentTopics}
        onTopicClick={handleTopicClick}
      />

      {/* Global Topic Graph Modal */}
      <GlobalTopicGraphModal 
        isOpen={isGlobalGraphOpen}
        onClose={() => setIsGlobalGraphOpen(false)}
        chats={recentChats}
        onSelectChat={handleSelectChat}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full relative w-full">
        
        {/* Header */}
        <header className="flex items-center justify-between px-4 py-3 sticky top-0 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md z-10 border-b border-gray-100 dark:border-white/5">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 text-slate-500 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              <Menu size={20} />
            </button>
            <span className="font-semibold text-slate-700 dark:text-slate-200">
                AI Chat 
                {currentChatId && <span className="text-xs font-normal text-slate-400 ml-2 hidden sm:inline-block">/ {recentChats.find(c => c.id === currentChatId)?.title}</span>}
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsSubjectsPanelOpen(!isSubjectsPanelOpen)}
              className={`text-sm font-medium hover:bg-gray-100 dark:hover:bg-slate-800 px-3 py-2 rounded-lg transition-colors flex items-center gap-2 ${isSubjectsPanelOpen ? 'bg-gray-100 dark:bg-slate-800 text-blue-600' : 'text-slate-700 dark:text-slate-200'}`}
            >
              <Book size={18} />
              <span className="hidden sm:inline">Subjects</span>
            </button>

            <button 
                onClick={() => setIsDarkMode(!isDarkMode)}
                className="p-2 text-slate-500 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors"
            >
                {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </div>
        </header>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto scroll-smooth">
          {messages.length === 0 ? (
            <WelcomeScreen onSuggestionClick={handleSendMessage} user={user} />
          ) : (
            <div className="pb-4">
              {messages.map((msg) => (
                <MessageBubble 
                  key={msg.id} 
                  id={msg.id}
                  role={msg.role} 
                  content={msg.content} 
                  isStreaming={msg.isStreaming}
                />
              ))}
              <div ref={messagesEndRef} className="h-4" />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="flex-shrink-0 bg-gradient-to-t from-white via-white to-transparent dark:from-slate-950 dark:via-slate-950 pt-2 pb-4 z-10">
          
          <div className="max-w-3xl mx-auto px-4 mb-2">
              {/* Exploring Mode Toggle */}
              <div className="flex justify-end mb-2">
                <button
                    onClick={() => setIsExploringMode(!isExploringMode)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                    isExploringMode 
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-300 border-blue-200 dark:border-blue-800' 
                        : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-gray-200 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800'
                    }`}
                >
                    <Compass size={14} className={isExploringMode ? "text-blue-500" : ""} />
                    <span>Exploring</span>
                </button>
              </div>

              {/* Contextual Suggestions */}
              {isExploringMode && suggestions.length > 0 && !isLoading && messages.length > 0 && (
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide snap-x fade-in">
                    {suggestions.map((suggestion, index) => (
                        <button
                        key={index}
                        onClick={() => handleSendMessage(suggestion)}
                        className="snap-start shrink-0 px-4 py-2 bg-gray-50 dark:bg-slate-800/80 hover:bg-blue-50 dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-700 hover:border-blue-200 dark:hover:border-slate-600 rounded-xl text-sm text-slate-600 dark:text-slate-300 transition-all flex items-center gap-2 group whitespace-nowrap shadow-sm"
                        >
                        <Sparkles size={14} className="text-blue-500 opacity-60 group-hover:opacity-100 group-hover:scale-110 transition-all" />
                        <span>{suggestion}</span>
                        </button>
                    ))}
                </div>
              )}
          </div>

          <ChatInput onSend={handleSendMessage} isLoading={isLoading} />
        </div>

      </div>
    </div>
  );
};

export default App;