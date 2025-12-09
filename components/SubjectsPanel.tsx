import React from 'react';
import { X, Hash } from 'lucide-react';
import { Topic } from '../types';

interface SubjectsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  topics: Topic[];
  onTopicClick: (messageId: string) => void;
}

const SubjectsPanel: React.FC<SubjectsPanelProps> = ({ isOpen, onClose, topics, onTopicClick }) => {
  return (
    <>
      {/* Overlay */}
      <div 
        className={`fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity duration-300 md:hidden ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* Panel */}
      <div 
        className={`
          fixed inset-y-0 right-0 z-50
          w-80 bg-gray-50 dark:bg-slate-900 border-l border-gray-200 dark:border-slate-800
          shadow-2xl transform transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        <div className="flex flex-col h-full">
          <div className="p-4 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900">
            <h2 className="font-semibold text-lg text-slate-800 dark:text-slate-100">Conversation Topics</h2>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-500"
            >
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {topics.length === 0 ? (
               <div className="flex flex-col items-center justify-center h-full text-slate-400 text-sm text-center">
                  <Hash size={48} className="mb-4 opacity-20" />
                  <p>No topics detected yet.</p>
                  <p className="mt-1">Start chatting to generate a table of contents.</p>
               </div>
            ) : (
              <div className="relative pl-2">
                {/* Vertical Line */}
                <div className="absolute left-[1.65rem] top-4 bottom-4 w-px bg-gray-200 dark:bg-slate-700" />

                <div className="space-y-6">
                  {topics.map((topic, index) => (
                    <button
                      key={topic.id}
                      onClick={() => onTopicClick(topic.messageId)}
                      className="relative w-full flex items-start gap-4 group text-left"
                    >
                      {/* Number Circle */}
                      <div className="relative z-10 shrink-0 w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 font-semibold flex items-center justify-center border-4 border-gray-50 dark:border-slate-900 group-hover:scale-110 transition-transform">
                        {index + 1}
                      </div>

                      {/* Card */}
                      <div className="flex-1 bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700 transition-all">
                        <h3 className="font-medium text-slate-800 dark:text-slate-200 text-sm leading-snug">
                          {topic.title}
                        </h3>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default SubjectsPanel;