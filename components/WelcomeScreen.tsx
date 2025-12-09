import React from 'react';
import { Sparkles, Code, PenTool, Lightbulb } from 'lucide-react';
import { User } from '../types';

interface WelcomeScreenProps {
  onSuggestionClick: (text: string) => void;
  user: User | null;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onSuggestionClick, user }) => {
  const suggestions = [
    {
      icon: <Code className="w-6 h-6 text-purple-500" />,
      text: "Write a React hook to handle local storage"
    },
    {
      icon: <PenTool className="w-6 h-6 text-orange-500" />,
      text: "Draft an email declining a job offer politely"
    },
    {
      icon: <Lightbulb className="w-6 h-6 text-yellow-500" />,
      text: "Explain quantum computing to a 5-year old"
    },
    {
      icon: <Sparkles className="w-6 h-6 text-blue-500" />,
      text: "Brainstorm marketing ideas for a coffee shop"
    }
  ];

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 text-center animate-fade-in">
      <div className="mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-xl shadow-blue-500/20 mb-6">
          <Sparkles className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-4xl md:text-5xl font-bold mb-3 bg-clip-text text-transparent bg-gradient-to-r from-slate-800 to-slate-500 dark:from-slate-100 dark:to-slate-400">
          {user ? `Hello, ${user.name}` : 'Hello'}
        </h1>
        <p className="text-lg text-slate-500 dark:text-slate-400 max-w-lg mx-auto">
          How can I help you today?
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl w-full">
        {suggestions.map((item, index) => (
          <button
            key={index}
            onClick={() => onSuggestionClick(item.text)}
            className="flex items-start gap-4 p-4 text-left rounded-xl border border-gray-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-700 hover:bg-blue-50 dark:hover:bg-slate-800/50 transition-all group bg-white dark:bg-slate-900/50"
          >
            <div className="p-2 rounded-lg bg-gray-50 dark:bg-slate-800 group-hover:bg-white dark:group-hover:bg-slate-700 transition-colors">
              {item.icon}
            </div>
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                {item.text}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default WelcomeScreen;