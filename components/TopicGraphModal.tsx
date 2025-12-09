import React, { useEffect, useRef, useState } from 'react';
import { X, ZoomIn, ZoomOut, MessageSquarePlus, AlertCircle } from 'lucide-react';
import { ChatSession, Topic } from '../types';

interface TopicGraphModalProps {
  chat: ChatSession | null;
  onClose: () => void;
  onForkChat: (originalChat: ChatSession, topicId: string) => void;
}

interface Node {
  id: string;
  label: string;
  radius: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  messageCount: number;
  color: string;
}

interface Link {
  source: string;
  target: string;
}

const COLORS = [
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
];

const TopicGraphModal: React.FC<TopicGraphModalProps> = ({ chat, onClose, onForkChat }) => {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [links, setLinks] = useState<Link[]>([]);
  const [scale, setScale] = useState(1);
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  
  const svgRef = useRef<SVGSVGElement>(null);
  const requestRef = useRef<number>(0);
  const draggingNode = useRef<string | null>(null);

  // Initialize Data
  useEffect(() => {
    if (!chat || !chat.topics || chat.topics.length === 0) return;

    // 1. Calculate weights
    const topicNodes: Node[] = chat.topics.map((topic, index) => {
      // Find index of start message
      const startMsgIndex = chat.messages.findIndex(m => m.id === topic.messageId);
      // Find index of next topic's start message, or end of array
      const nextTopicId = chat.topics[index + 1]?.messageId;
      const endMsgIndex = nextTopicId 
        ? chat.messages.findIndex(m => m.id === nextTopicId) 
        : chat.messages.length;
      
      const count = Math.max(1, endMsgIndex - startMsgIndex);
      
      // Random initial position near center
      const angle = (index / chat.topics.length) * 2 * Math.PI;
      const radius = 50 + index * 10;

      return {
        id: topic.id,
        label: topic.title,
        messageCount: count,
        radius: 20 + Math.log(count) * 8, // Logarithmic scaling
        x: 300 + Math.cos(angle) * radius, // Center offset
        y: 300 + Math.sin(angle) * radius,
        vx: 0,
        vy: 0,
        color: COLORS[index % COLORS.length]
      };
    });

    // 2. Create sequential links
    const topicLinks: Link[] = [];
    for (let i = 0; i < topicNodes.length - 1; i++) {
      topicLinks.push({
        source: topicNodes[i].id,
        target: topicNodes[i + 1].id
      });
    }

    setNodes(topicNodes);
    setLinks(topicLinks);

  }, [chat]);

  // Physics Simulation
  useEffect(() => {
    if (nodes.length === 0) return;

    const tick = () => {
      setNodes(prevNodes => {
        const newNodes = prevNodes.map(n => ({ ...n }));
        const strength = 0.05;
        const drag = 0.9;
        const centerX = 300; // Adjusted center for the canvas area
        const centerY = 300;

        // 1. Repulsion (Nodes push apart)
        for (let i = 0; i < newNodes.length; i++) {
          for (let j = i + 1; j < newNodes.length; j++) {
            const a = newNodes[i];
            const b = newNodes[j];
            const dx = a.x - b.x;
            const dy = a.y - b.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const minDist = a.radius + b.radius + 50; // Minimum buffer

            if (dist < minDist * 2) {
              const force = (minDist * 2 - dist) / dist * strength;
              const fx = dx * force;
              const fy = dy * force;
              
              if (a.id !== draggingNode.current) {
                a.vx += fx;
                a.vy += fy;
              }
              if (b.id !== draggingNode.current) {
                b.vx -= fx;
                b.vy -= fy;
              }
            }
          }
        }

        // 2. Spring (Links pull together)
        links.forEach(link => {
          const source = newNodes.find(n => n.id === link.source);
          const target = newNodes.find(n => n.id === link.target);
          if (source && target) {
            const dx = target.x - source.x;
            const dy = target.y - source.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const targetDist = 150; // Desired link length

            const force = (dist - targetDist) * 0.001; // Spring constant
            
            if (source.id !== draggingNode.current) {
                source.vx += dx * force;
                source.vy += dy * force;
            }
            if (target.id !== draggingNode.current) {
                target.vx -= dx * force;
                target.vy -= dy * force;
            }
          }
        });

        // 3. Center Gravity & Velocity Update
        newNodes.forEach(node => {
          if (node.id === draggingNode.current) return;

          // Pull to center
          node.vx += (centerX - node.x) * 0.002;
          node.vy += (centerY - node.y) * 0.002;

          // Apply velocity
          node.x += node.vx;
          node.y += node.vy;

          // Friction
          node.vx *= drag;
          node.vy *= drag;
        });

        return newNodes;
      });

      requestRef.current = requestAnimationFrame(tick);
    };

    requestRef.current = requestAnimationFrame(tick);

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [nodes.length, links]);

  // Interaction Handlers
  const handleMouseDown = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    draggingNode.current = nodeId;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (draggingNode.current && svgRef.current) {
      const CTM = svgRef.current.getScreenCTM();
      if (CTM) {
        const x = (e.clientX - CTM.e) / CTM.a / scale;
        const y = (e.clientY - CTM.f) / CTM.d / scale;
        
        setNodes(prev => prev.map(n => 
          n.id === draggingNode.current ? { ...n, x, y, vx: 0, vy: 0 } : n
        ));
      }
    }
  };

  const handleMouseUp = () => {
    draggingNode.current = null;
  };

  const handleTopicSelect = (topicId: string) => {
    if (!chat) return;
    const topic = chat.topics.find(t => t.id === topicId);
    if (topic) {
        setSelectedTopic(topic);
    }
  };

  const confirmFork = () => {
    if (chat && selectedTopic) {
        onForkChat(chat, selectedTopic.id);
        onClose();
    }
  };

  if (!chat) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-6xl h-[85vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl flex overflow-hidden border border-gray-200 dark:border-slate-800 m-4">
        
        {/* Left Sidebar - Topic List */}
        <div className="w-80 border-r border-gray-200 dark:border-slate-800 flex flex-col bg-gray-50 dark:bg-slate-900/50">
            <div className="p-4 border-b border-gray-200 dark:border-slate-800">
                <h2 className="font-bold text-slate-800 dark:text-slate-100">Topic List</h2>
                <p className="text-xs text-slate-500 mt-1">Select a topic to branch a new chat.</p>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {chat.topics.map((topic, index) => (
                    <button
                        key={topic.id}
                        onClick={() => setSelectedTopic(topic)}
                        className={`w-full text-left p-3 rounded-xl transition-all border ${
                            selectedTopic?.id === topic.id 
                            ? 'bg-white dark:bg-slate-800 border-blue-500 shadow-sm ring-1 ring-blue-500/20' 
                            : 'bg-transparent border-transparent hover:bg-gray-200 dark:hover:bg-slate-800'
                        }`}
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 flex items-center justify-center text-xs font-bold shrink-0">
                                {index + 1}
                            </div>
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                                {topic.title}
                            </span>
                        </div>
                    </button>
                ))}
            </div>
        </div>

        {/* Right Content - Graph & Header */}
        <div className="flex-1 flex flex-col relative">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900">
                <div>
                    <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">{chat.title}</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Visualization</p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => setScale(s => Math.min(s + 0.1, 2))} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full"><ZoomIn size={20} className="text-slate-600 dark:text-slate-300" /></button>
                    <button onClick={() => setScale(s => Math.max(s - 0.1, 0.5))} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full"><ZoomOut size={20} className="text-slate-600 dark:text-slate-300" /></button>
                    <button onClick={onClose} className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full text-slate-500 hover:text-red-600"><X size={24} /></button>
                </div>
            </div>

            <div className="flex-1 bg-gray-50 dark:bg-slate-950 overflow-hidden relative cursor-move"
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
            >
                <svg 
                    ref={svgRef}
                    viewBox="0 0 600 600" 
                    className="w-full h-full"
                    style={{ touchAction: 'none' }}
                >
                    <g transform={`scale(${scale})`}>
                        {links.map((link, i) => {
                            const source = nodes.find(n => n.id === link.source);
                            const target = nodes.find(n => n.id === link.target);
                            if (!source || !target) return null;
                            return (
                                <line
                                    key={i}
                                    x1={source.x}
                                    y1={source.y}
                                    x2={target.x}
                                    y2={target.y}
                                    stroke="#94a3b8"
                                    strokeOpacity="0.4"
                                    strokeWidth="2"
                                />
                            );
                        })}

                        {nodes.map((node) => (
                            <g 
                                key={node.id} 
                                transform={`translate(${node.x},${node.y})`}
                                onMouseDown={(e) => handleMouseDown(e, node.id)}
                                onClick={(e) => { e.stopPropagation(); handleTopicSelect(node.id); }}
                                className="cursor-pointer transition-colors"
                            >
                                <circle
                                    r={node.radius + 4}
                                    fill={node.color}
                                    fillOpacity={selectedTopic?.id === node.id ? "0.4" : "0.1"}
                                    stroke={selectedTopic?.id === node.id ? node.color : "none"}
                                    strokeWidth="2"
                                    className="transition-all duration-300"
                                />
                                <circle
                                    r={node.radius}
                                    fill={node.color}
                                    stroke="white"
                                    strokeWidth="2"
                                    className="dark:stroke-slate-800"
                                />
                                <circle 
                                    r={10} 
                                    cx={node.radius * 0.7} 
                                    cy={-node.radius * 0.7} 
                                    className="fill-slate-800 dark:fill-white"
                                />
                                <text
                                    x={node.radius * 0.7} 
                                    y={-node.radius * 0.7}
                                    dy=".3em"
                                    textAnchor="middle"
                                    className="text-[10px] fill-white dark:fill-slate-900 font-bold pointer-events-none"
                                >
                                    {node.messageCount}
                                </text>

                                <text
                                    dy={node.radius + 20}
                                    textAnchor="middle"
                                    className="text-sm font-semibold fill-slate-700 dark:fill-slate-200 select-none pointer-events-none"
                                    style={{ textShadow: '0 1px 2px rgba(0,0,0,0.1)' }}
                                >
                                    {node.label}
                                </text>
                            </g>
                        ))}
                    </g>
                </svg>

                {/* Legend */}
                <div className="absolute bottom-4 right-4 p-3 bg-white/90 dark:bg-slate-800/90 backdrop-blur rounded-lg border border-gray-200 dark:border-slate-700 shadow-sm text-xs text-slate-600 dark:text-slate-300 pointer-events-none">
                    <p className="font-semibold mb-1">Graph Legend</p>
                    <div className="flex items-center gap-2 mb-1">
                        <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                        <span>Node Size = Chat volume</span>
                    </div>
                </div>
            </div>

            {/* Confirmation Overlay */}
            {selectedTopic && (
                <div className="absolute inset-0 bg-white/60 dark:bg-slate-900/80 backdrop-blur-[2px] z-10 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-800 p-6 max-w-md w-full">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full text-blue-600 dark:text-blue-300">
                                <AlertCircle size={24} />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Fork this chat?</h3>
                                <p className="text-sm text-slate-500">Topic: "{selectedTopic.title}"</p>
                            </div>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-300 mb-6 leading-relaxed">
                            Do you want to start a new chat session focused on this topic? This will create a new chat containing all messages related to <strong>{selectedTopic.title}</strong>.
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button 
                                onClick={() => setSelectedTopic(null)}
                                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-slate-800 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={confirmFork}
                                className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-lg shadow-blue-500/20 flex items-center gap-2"
                            >
                                <MessageSquarePlus size={16} />
                                Start New Chat
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default TopicGraphModal;