import React, { useState, useEffect, useMemo } from 'react';
import { MessageSquarePlus, MessageSquare, Settings, LogOut, LogIn, Trash2, Search, Edit2, Check, X, MoreHorizontal, Share, Network, Star, FileText, Hash, ArrowLeft, Tags, Layers, Map as MapIcon } from 'lucide-react';
import { User, ChatSession } from '../types';
import TopicGraphModal from './TopicGraphModal';
import SummaryModal from './SummaryModal';
import { generateChatSummary } from '../services/geminiService';

interface SidebarProps {
  isOpen: boolean;
  toggleSidebar: () => void;
  onNewChat: () => void;
  user: User | null;
  onLoginClick: () => void;
  onLogoutClick: () => void;
  recentChats: ChatSession[];
  currentChatId: string | null;
  onSelectChat: (chat: ChatSession) => void;
  onDeleteChat: (e: React.MouseEvent, chatId: string) => void;
  onRenameChat: (chatId: string, newTitle: string) => void;
  onToggleFavorite: (e: React.MouseEvent, chatId: string) => void;
  onForkChat: (originalChat: ChatSession, topicId: string) => void;
  onOpenGlobalGraph: () => void;
}

type ViewMode = 'default' | 'topics' | 'topic-results';

interface TopicCluster {
  label: string;
  variations: string[];
  count: number;
}

const STOP_WORDS = new Set(['and', 'or', 'the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'about']);

const Sidebar: React.FC<SidebarProps> = ({ 
  isOpen, 
  toggleSidebar, 
  onNewChat, 
  user,
  onLoginClick,
  onLogoutClick,
  recentChats,
  currentChatId,
  onSelectChat,
  onDeleteChat,
  onRenameChat,
  onToggleFavorite,
  onForkChat,
  onOpenGlobalGraph
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [activeMenuChatId, setActiveMenuChatId] = useState<string | null>(null);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false); // State for User Settings Menu
  const [editTitle, setEditTitle] = useState('');
  const [graphChat, setGraphChat] = useState<ChatSession | null>(null);
  
  // Topic Explorer State
  const [viewMode, setViewMode] = useState<ViewMode>('default');
  const [selectedClusterLabel, setSelectedClusterLabel] = useState<string | null>(null);

  // Summary State
  const [summaryData, setSummaryData] = useState<{isOpen: boolean, isLoading: boolean, content: string, title: string}>({
      isOpen: false,
      isLoading: false,
      content: '',
      title: ''
  });

  // Derived state for filtered chats (Search)
  const filteredChats = useMemo(() => {
    return recentChats.filter(chat => 
      chat.title.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [recentChats, searchQuery]);

  // --- CLUSTERING LOGIC ---
  const clusteredTopics = useMemo(() => {
    // 1. Gather all raw topics and their frequencies
    const topicCounts = new Map<string, number>();
    
    recentChats.forEach(chat => {
      const chatTopics = new Set<string>(chat.topics?.map(t => t.title.trim()) || []);
      chatTopics.forEach(title => {
        if (title) {
          topicCounts.set(title, (topicCounts.get(title) || 0) + 1);
        }
      });
    });

    const sortedTopics = Array.from(topicCounts.entries())
      .sort((a, b) => b[1] - a[1]) // Sort by frequency
      .map(([title]) => title);

    const clusters: TopicCluster[] = [];
    const processed = new Set<string>();

    const getCommonLabel = (str1: string, str2: string): string | null => {
        const words1 = str1.toLowerCase().split(/\s+/).filter(w => !STOP_WORDS.has(w) && w.length > 2);
        const words2 = str2.toLowerCase().split(/\s+/).filter(w => !STOP_WORDS.has(w) && w.length > 2);
        
        let maxLen = 0;
        let endIndex = 0;
        const matrix = Array(words1.length + 1).fill(0).map(() => Array(words2.length + 1).fill(0));

        for (let i = 1; i <= words1.length; i++) {
            for (let j = 1; j <= words2.length; j++) {
                if (words1[i - 1] === words2[j - 1]) {
                    matrix[i][j] = matrix[i - 1][j - 1] + 1;
                    if (matrix[i][j] > maxLen) {
                        maxLen = matrix[i][j];
                        endIndex = i;
                    }
                }
            }
        }

        const isSubstring = str1.toLowerCase().includes(str2.toLowerCase()) || str2.toLowerCase().includes(str1.toLowerCase());
        
        if (maxLen >= 2 || (isSubstring && maxLen >= 1)) {
            return words1.slice(endIndex - maxLen, endIndex).join(' ');
        }
        return null;
    };

    // 2. Group topics
    for (const topic of sortedTopics) {
        if (processed.has(topic)) continue;

        let bestClusterIndex = -1;
        let bestCommonLabel = topic;

        for (let i = 0; i < clusters.length; i++) {
            const matchLabel = getCommonLabel(clusters[i].label, topic);
            
            if (matchLabel) {
                bestClusterIndex = i;
                if (matchLabel.length < clusters[i].label.length) {
                    bestCommonLabel = matchLabel;
                } else {
                    bestCommonLabel = clusters[i].label;
                }
                break; 
            }
        }

        if (bestClusterIndex !== -1) {
            clusters[bestClusterIndex].variations.push(topic);
            clusters[bestClusterIndex].label = bestCommonLabel;
            processed.add(topic);
        } else {
            clusters.push({
                label: topic,
                variations: [topic],
                count: 0
            });
            processed.add(topic);
        }
    }

    // 3. Recalculate counts
    return clusters.map(cluster => {
        let totalCount = 0;
        recentChats.forEach(chat => {
            const hasVariation = chat.topics?.some(t => cluster.variations.includes(t.title));
            if (hasVariation) totalCount++;
        });

        const formattedLabel = cluster.label.charAt(0).toUpperCase() + cluster.label.slice(1);

        return {
            ...cluster,
            label: formattedLabel,
            count: totalCount
        };
    }).sort((a, b) => b.count - a.count);

  }, [recentChats]);

  const clusterFilteredChats = useMemo(() => {
    if (!selectedClusterLabel) return [];
    
    const targetCluster = clusteredTopics.find(c => c.label === selectedClusterLabel);
    if (!targetCluster) return [];

    return recentChats.filter(chat => 
      chat.topics?.some(t => targetCluster.variations.includes(t.title))
    );
  }, [recentChats, selectedClusterLabel, clusteredTopics]);


  useEffect(() => {
    const handleClickOutside = () => {
      if (editingChatId) setEditingChatId(null);
      if (activeMenuChatId) setActiveMenuChatId(null);
      if (isUserMenuOpen) setIsUserMenuOpen(false);
    };

    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, [editingChatId, activeMenuChatId, isUserMenuOpen]);

  const startEditing = (e: React.MouseEvent, chat: ChatSession) => {
    e.stopPropagation();
    setEditingChatId(chat.id);
    setEditTitle(chat.title);
    setActiveMenuChatId(null);
  };

  const saveEdit = (e: React.MouseEvent | React.KeyboardEvent, chatId: string) => {
    e.stopPropagation();
    if (editTitle.trim()) {
        onRenameChat(chatId, editTitle.trim());
    }
    setEditingChatId(null);
  };

  const cancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingChatId(null);
  };

  const handleInputClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const toggleMenu = (e: React.MouseEvent, chatId: string) => {
    e.stopPropagation();
    setActiveMenuChatId(activeMenuChatId === chatId ? null : chatId);
  };

  const toggleUserMenu = (e: React.MouseEvent) => {
      e.stopPropagation();
      setIsUserMenuOpen(!isUserMenuOpen);
  };

  const handleShare = (e: React.MouseEvent, chat: ChatSession) => {
    e.stopPropagation();
    alert(`Sharing "${chat.title}"... (Feature coming soon)`);
    setActiveMenuChatId(null);
  };

  const handleViewGraph = (e: React.MouseEvent, chat: ChatSession) => {
    e.stopPropagation();
    setGraphChat(chat);
    setActiveMenuChatId(null);
  };

  const handleSummarize = async (e: React.MouseEvent, chat: ChatSession) => {
    e.stopPropagation();
    setActiveMenuChatId(null);
    setSummaryData({
        isOpen: true,
        isLoading: true,
        content: '',
        title: chat.title
    });
    
    const summary = await generateChatSummary(chat.messages);
    
    setSummaryData(prev => ({
        ...prev,
        isLoading: false,
        content: summary
    }));
  };

  const renderChatList = (chats: ChatSession[], emptyMessage: string) => {
    if (chats.length === 0) {
      return (
        <p className="px-4 text-xs text-slate-400 italic">
          {emptyMessage}
        </p>
      );
    }

    return (
      <div className="space-y-1">
        {chats.map((chat) => (
          <div 
            key={chat.id}
            onClick={() => {
                if (editingChatId !== chat.id) {
                    onSelectChat(chat);
                    if (window.innerWidth < 768) toggleSidebar();
                }
            }}
            className={`group w-full flex items-center gap-3 px-4 py-2 rounded-lg transition-colors text-sm relative cursor-pointer
              ${currentChatId === chat.id 
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-200' 
                : 'hover:bg-gray-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'}
            `}
          >
            <MessageSquare className="w-4 h-4 shrink-0 opacity-70" />
            
            {editingChatId === chat.id ? (
                <div className="flex-1 flex items-center gap-1 min-w-0">
                    <input 
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onClick={handleInputClick}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') saveEdit(e, chat.id);
                            if (e.key === 'Escape') setEditingChatId(null);
                        }}
                        autoFocus
                        className="flex-1 bg-white dark:bg-slate-950 border border-blue-500 rounded px-1 py-0.5 text-xs focus:outline-none min-w-0"
                    />
                    <button onClick={(e) => saveEdit(e, chat.id)} className="p-1 hover:text-green-500"><Check size={14} /></button>
                    <button onClick={cancelEdit} className="p-1 hover:text-red-500"><X size={14} /></button>
                </div>
            ) : (
                <>
                    <span className="truncate flex-1 text-left">{chat.title}</span>
                    
                    <button
                        onClick={(e) => onToggleFavorite(e, chat.id)}
                        className={`p-1 rounded-md transition-colors mr-1 ${
                            chat.isFavorite 
                            ? 'text-yellow-400 opacity-100' 
                            : 'text-slate-400 opacity-0 group-hover:opacity-100 hover:text-yellow-400'
                        }`}
                        title={chat.isFavorite ? "Unpin chat" : "Pin chat"}
                    >
                        <Star size={14} className={chat.isFavorite ? "fill-yellow-400" : ""} />
                    </button>

                    <button
                        onClick={(e) => toggleMenu(e, chat.id)}
                        className={`p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-gray-300 dark:hover:bg-slate-600 transition-colors ${activeMenuChatId === chat.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                        title="More options"
                    >
                        <MoreHorizontal size={16} />
                    </button>

                    {activeMenuChatId === chat.id && (
                        <div className="absolute right-4 top-8 z-50 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-gray-200 dark:border-slate-700 py-1.5 animate-in fade-in zoom-in-95 duration-100 origin-top-right">
                            <button onClick={(e) => handleSummarize(e, chat)} className="w-full text-left px-4 py-2.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-2.5">
                                <FileText size={14} className="text-slate-500" /> <span>Summarize</span>
                            </button>
                            <button onClick={(e) => handleViewGraph(e, chat)} className="w-full text-left px-4 py-2.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-2.5">
                                <Network size={14} className="text-slate-500" /> <span>View Graph</span>
                            </button>
                            <div className="my-1 border-t border-gray-100 dark:border-slate-700" />
                             <button onClick={(e) => handleShare(e, chat)} className="w-full text-left px-4 py-2.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-2.5">
                                <Share size={14} className="text-slate-500" /> <span>Share</span>
                            </button>
                            <button onClick={(e) => startEditing(e, chat)} className="w-full text-left px-4 py-2.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-2.5">
                                <Edit2 size={14} className="text-slate-500" /> <span>Rename</span>
                            </button>
                            <div className="my-1 border-t border-gray-100 dark:border-slate-700" />
                            <button onClick={(e) => onDeleteChat(e, chat.id)} className="w-full text-left px-4 py-2.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2.5">
                                <Trash2 size={14} /> <span>Delete</span>
                            </button>
                        </div>
                    )}
                </>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
            className="fixed inset-0 bg-black/40 z-30 md:hidden backdrop-blur-sm animate-in fade-in duration-200"
            onClick={toggleSidebar}
        />
      )}

      <div 
        className={`fixed inset-y-0 left-0 z-40 w-[280px] bg-gray-50/90 dark:bg-slate-900/95 backdrop-blur-xl border-r border-gray-200 dark:border-slate-800 transition-transform duration-300 ease-in-out transform ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } md:relative md:translate-x-0 flex flex-col`}
      >
        <div className="p-4 flex-1 overflow-hidden flex flex-col">
          {/* New Chat Button */}
          <button 
            onClick={onNewChat}
            className="w-full flex items-center gap-3 px-4 py-3 bg-gray-200 dark:bg-slate-800 hover:bg-gray-300 dark:hover:bg-slate-700 rounded-xl transition-all shadow-sm text-slate-700 dark:text-slate-200 mb-4 font-medium"
          >
            <MessageSquarePlus size={20} />
            <span className="text-sm">New Chat</span>
          </button>

          {/* Search & Topic Toggle */}
          <div className="space-y-2 mb-4">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                    type="text"
                    placeholder="Search chats..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
            </div>
            
            <button
                onClick={() => setViewMode(viewMode === 'default' ? 'topics' : 'default')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors border ${
                    viewMode !== 'default'
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                    : 'bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-gray-200 dark:border-slate-800 hover:bg-gray-100 dark:hover:bg-slate-800'
                }`}
            >
                <div className="flex items-center gap-2">
                    <Hash size={14} />
                    <span>Browse Topics</span>
                </div>
                {viewMode !== 'default' && <X size={14} onClick={(e) => { e.stopPropagation(); setViewMode('default'); }} className="hover:text-red-500" />}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto -mx-2 px-2 scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-slate-800">
            {/* View Logic */}
            {viewMode === 'default' && (
                <>
                    <div className="mb-2 px-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        {searchQuery ? 'Search Results' : 'Recent'}
                    </div>
                    {renderChatList(filteredChats, searchQuery ? "No chats found matching your search." : "No history yet.")}
                </>
            )}

            {viewMode === 'topics' && (
                <div className="animate-in fade-in slide-in-from-left-4 duration-200">
                    <div className="mb-3 px-2 flex items-center justify-between">
                         <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Grouped Topics</span>
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                        {clusteredTopics.length === 0 ? (
                            <p className="px-4 text-xs text-slate-400 italic">No topics found in your history.</p>
                        ) : (
                            clusteredTopics.map((cluster, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => {
                                        setSelectedClusterLabel(cluster.label);
                                        setViewMode('topic-results');
                                    }}
                                    className="flex items-center justify-between px-4 py-3 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700/50 rounded-xl hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-sm transition-all text-left group"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="p-1.5 bg-blue-50 dark:bg-blue-900/30 rounded-lg text-blue-500 relative">
                                            <Tags size={14} />
                                            {cluster.variations.length > 1 && (
                                                <div className="absolute -top-1 -right-1">
                                                    <Layers size={8} className="text-blue-400" />
                                                </div>
                                            )}
                                        </div>
                                        <div>
                                            <span className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate block">
                                                {cluster.label}
                                            </span>
                                            {cluster.variations.length > 1 && (
                                                <span className="text-[10px] text-slate-400 truncate block">
                                                    Includes: {cluster.variations.length} sub-topics
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <span className="px-2 py-0.5 bg-gray-100 dark:bg-slate-700 rounded-full text-[10px] font-bold text-slate-500 dark:text-slate-400 group-hover:bg-blue-100 dark:group-hover:bg-blue-900 group-hover:text-blue-600 dark:group-hover:text-blue-300">
                                        {cluster.count}
                                    </span>
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}

            {viewMode === 'topic-results' && (
                <div className="animate-in fade-in slide-in-from-right-4 duration-200 h-full flex flex-col">
                    <div className="mb-3 flex items-center gap-2">
                        <button 
                            onClick={() => setViewMode('topics')}
                            className="p-1 hover:bg-gray-200 dark:hover:bg-slate-800 rounded-full transition-colors"
                        >
                            <ArrowLeft size={16} className="text-slate-500" />
                        </button>
                        <div className="min-w-0">
                            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider truncate block">
                                {selectedClusterLabel}
                            </span>
                        </div>
                    </div>
                    {renderChatList(clusterFilteredChats, "No chats found for this topic cluster.")}
                </div>
            )}
          </div>

          {/* Footer User Profile */}
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-slate-800 relative">
            {user ? (
               <div className="space-y-2 relative">
                 <button 
                    onClick={toggleUserMenu}
                    className="flex items-center gap-3 px-2 py-2 w-full hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-left group"
                 >
                    <img src={user.avatar} alt="Avatar" className="w-8 h-8 rounded-full bg-slate-200" />
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{user.name}</p>
                        <p className="text-xs text-slate-500 truncate">{user.email}</p>
                    </div>
                    <Settings size={16} className="text-slate-400 opacity-60 group-hover:opacity-100 transition-opacity" />
                 </button>

                 {/* User Menu Dropdown */}
                 {isUserMenuOpen && (
                     <div className="absolute bottom-full left-0 w-full mb-2 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-gray-200 dark:border-slate-700 py-1.5 animate-in fade-in zoom-in-95 duration-100 z-50">
                         <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsUserMenuOpen(false);
                                onOpenGlobalGraph();
                            }}
                            className="w-full text-left px-4 py-2.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-2.5"
                         >
                            <MapIcon size={14} className="text-blue-500" />
                            <span>Topic Map</span>
                         </button>
                         <div className="my-1 border-t border-gray-100 dark:border-slate-700" />
                         <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsUserMenuOpen(false);
                                onLogoutClick();
                            }}
                            className="w-full text-left px-4 py-2.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2.5"
                         >
                            <LogOut size={14} />
                            <span>Log out</span>
                         </button>
                     </div>
                 )}
               </div>
            ) : (
                <button 
                  onClick={onLoginClick}
                  className="flex items-center justify-center gap-2 w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium shadow-sm shadow-blue-500/20"
                >
                    <LogIn size={16} />
                    <span>Sign In</span>
                </button>
            )}
          </div>
        </div>
      </div>
      
      {/* Overlays */}
      <TopicGraphModal 
        chat={graphChat} 
        onClose={() => setGraphChat(null)} 
        onForkChat={onForkChat}
      />
      
      <SummaryModal
        isOpen={summaryData.isOpen}
        onClose={() => setSummaryData(prev => ({...prev, isOpen: false}))}
        isLoading={summaryData.isLoading}
        content={summaryData.content}
        title={summaryData.title}
      />
    </>
  );
};

export default Sidebar;