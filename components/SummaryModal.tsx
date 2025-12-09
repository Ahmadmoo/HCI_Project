import React from 'react';
import ReactMarkdown from 'react-markdown';
import { X, FileText, Loader2 } from 'lucide-react';

interface SummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  content: string;
  isLoading: boolean;
  title: string;
}

const SummaryModal: React.FC<SummaryModalProps> = ({ isOpen, onClose, content, isLoading, title }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-800 overflow-hidden m-4 flex flex-col max-h-[80vh] animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between bg-gray-50 dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400">
              <FileText size={20} />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800 dark:text-slate-100">Chat Summary</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-[250px] truncate">{title}</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-gray-200 dark:hover:bg-slate-800 rounded-full text-slate-500 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto min-h-[200px]">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-48 space-y-4 text-slate-500">
              <Loader2 size={32} className="animate-spin text-blue-500" />
              <p className="text-sm font-medium">Analyzing conversation...</p>
            </div>
          ) : (
            <div className="markdown-content text-slate-700 dark:text-slate-300 text-sm leading-relaxed">
              {content ? <ReactMarkdown>{content}</ReactMarkdown> : <p className="text-slate-400 italic">No content available.</p>}
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="p-4 bg-gray-50 dark:bg-slate-900 border-t border-gray-200 dark:border-slate-800 flex justify-end">
            <button 
                onClick={onClose}
                className="px-4 py-2 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
            >
                Close
            </button>
        </div>
      </div>
    </div>
  );
};

export default SummaryModal;
