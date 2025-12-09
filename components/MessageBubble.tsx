import React from 'react';
import ReactMarkdown from 'react-markdown';
import { User, Sparkles, Copy, ThumbsUp, ThumbsDown, Check } from 'lucide-react';
import { Role } from '../types';

interface MessageBubbleProps {
  id?: string;
  role: Role;
  content: string;
  isStreaming?: boolean;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ id, role, content, isStreaming }) => {
  const isUser = role === Role.USER;
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div id={id} className={`group w-full text-slate-800 dark:text-slate-100 border-b border-black/5 dark:border-white/5 ${isUser ? 'bg-gray-50 dark:bg-slate-900/50' : 'bg-white dark:bg-transparent'}`}>
      <div className="max-w-3xl mx-auto px-4 py-8 flex gap-4 md:gap-6">
        
        {/* Avatar */}
        <div className="shrink-0 flex flex-col relative items-end">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
            isUser 
              ? 'bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-slate-200' 
              : 'bg-gradient-to-tr from-blue-500 to-indigo-500 text-white shadow-lg shadow-blue-500/30'
          }`}>
            {isUser ? <User size={18} /> : <Sparkles size={16} />}
          </div>
        </div>

        {/* Content */}
        <div className="relative flex-1 overflow-hidden">
          <div className="font-semibold text-sm mb-1 opacity-90">
            {isUser ? 'You' : 'AI'}
          </div>
          
          <div className="markdown-content text-[15px] leading-7">
             {/* If streaming and empty, show a small indicator */}
            {!content && isStreaming ? (
               <span className="inline-block w-2 h-4 align-middle bg-slate-400 dark:bg-slate-500 animate-pulse ml-1 rounded-sm"/>
            ) : (
              <ReactMarkdown>{content}</ReactMarkdown>
            )}
             {isStreaming && content && (
               <span className="inline-block w-2 h-4 align-middle bg-slate-400 dark:bg-slate-500 animate-pulse ml-1 rounded-sm"/>
             )}
          </div>

          {/* Action Buttons (Only for AI responses) */}
          {!isUser && !isStreaming && (
            <div className="flex items-center gap-2 mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
              <button 
                onClick={handleCopy}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-md transition-colors"
                title="Copy to clipboard"
              >
                {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
              </button>
              <button className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-md transition-colors">
                <ThumbsUp size={16} />
              </button>
              <button className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-md transition-colors">
                <ThumbsDown size={16} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;