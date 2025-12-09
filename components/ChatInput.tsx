import React, { useRef, useEffect, useState } from 'react';
import { Send, Paperclip, Image as ImageIcon, Mic } from 'lucide-react';

interface ChatInputProps {
  onSend: (message: string) => void;
  isLoading: boolean;
}

const ChatInput: React.FC<ChatInputProps> = ({ onSend, isLoading }) => {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  };

  useEffect(() => {
    adjustHeight();
  }, [text]);

  const handleSubmit = () => {
    if (!text.trim() || isLoading) return;
    onSend(text);
    setText('');
    if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto px-4 pb-6 pt-2">
      <div className="relative flex items-end gap-2 bg-gray-100 dark:bg-slate-900 border border-transparent focus-within:border-gray-300 dark:focus-within:border-slate-700 focus-within:bg-white dark:focus-within:bg-slate-800 rounded-3xl p-2 transition-all shadow-sm">
        
        <button 
          className="p-2 text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200 rounded-full hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
          disabled={isLoading}
        >
          <Paperclip size={20} />
        </button>
        
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message AI..."
          className="flex-1 max-h-[200px] min-h-[24px] bg-transparent border-none focus:ring-0 resize-none py-3 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 text-base leading-6"
          rows={1}
          disabled={isLoading}
        />

        {text.length === 0 ? (
            <button 
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200 rounded-full hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
            disabled={isLoading}
          >
            <Mic size={20} />
          </button>
        ) : (
            <button 
            onClick={handleSubmit}
            disabled={isLoading || !text.trim()}
            className={`p-2 rounded-full transition-colors flex items-center justify-center ${
                isLoading || !text.trim()
                ? 'bg-gray-200 text-gray-400 dark:bg-slate-700 dark:text-slate-500'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
            >
            <Send size={18} />
            </button>
        )}
      </div>
      <p className="text-center text-xs text-gray-400 dark:text-slate-500 mt-3">
        This Chatbot may display inaccurate info, including about people, so double-check its responses.
      </p>
    </div>
  );
};

export default ChatInput;