import React, { useEffect, useRef, useState, useMemo } from 'react';
import { X, ZoomIn, ZoomOut, MessageSquare, ExternalLink, Network, ArrowRight } from 'lucide-react';
import { ChatSession } from '../types';

interface GlobalTopicGraphModalProps {
  isOpen: boolean;
  onClose: () => void;
  chats: ChatSession[];
  onSelectChat: (chat: ChatSession) => void;
}

interface Node {
  id: string; // The cluster label
  label: string;
  radius: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  count: number;
  chats: ChatSession[]; // Chats belonging to this cluster
  color: string;
}

interface Link {
  source: string;
  target: string;
  strength: number;
}

// Lighter pastel colors to ensure black text is readable
const COLORS = [
  '#93c5fd', // blue-300
  '#c4b5fd', // violet-300
  '#f9a8d4', // pink-300
  '#6ee7b7', // emerald-300
  '#fcd34d', // amber-300
  '#fca5a5', // red-300
  '#67e8f9', // cyan-300
  '#fdba74', // orange-300
];

const STOP_WORDS = new Set(['and', 'or', 'the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'about', 'how', 'what', 'why', 'is', 'are']);

const GlobalTopicGraphModal: React.FC<GlobalTopicGraphModalProps> = ({ isOpen, onClose, chats, onSelectChat }) => {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [links, setLinks] = useState<Link[]>([]);
  const [scale, setScale] = useState(0.9);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  
  const svgRef = useRef<SVGSVGElement>(null);
  const requestRef = useRef<number>(0);
  const draggingNode = useRef<string | null>(null);

  // Limit to last 10 chats
  const recentChats = useMemo(() => {
    return chats.slice(0, 10);
  }, [chats]);

  // --- 1. CLUSTERING & DATA PREP ---
  useEffect(() => {
    if (!isOpen) return;

    // A. Gather all topics from the limited chat list
    const allTopics: { title: string; chat: ChatSession }[] = [];
    recentChats.forEach(chat => {
      chat.topics?.forEach(t => {
        allTopics.push({ title: t.title, chat });
      });
      // Also consider chat title if no topics exist
      if ((!chat.topics || chat.topics.length === 0) && chat.title) {
          allTopics.push({ title: chat.title, chat });
      }
    });

    if (allTopics.length === 0) {
        setNodes([]);
        setLinks([]);
        return;
    }

    // B. Perform Clustering
    interface Cluster {
        label: string;
        variations: string[];
        chats: Set<ChatSession>;
    }
    const clusters: Cluster[] = [];

    const getWords = (str: string) => str.toLowerCase().split(/[\s-_]+/).filter(w => !STOP_WORDS.has(w) && w.length > 2);

    const getCommonLabel = (str1: string, str2: string): string | null => {
        const words1 = getWords(str1);
        const words2 = getWords(str2);
        
        // Check for shared significant words
        const intersection = words1.filter(w => words2.includes(w));
        
        if (intersection.length > 0) {
             if (intersection.length === words1.length) return str1;
             if (intersection.length === words2.length) return str2;
             if (intersection.length >= 2) return intersection.join(' ');
        }
        
        if (str1.toLowerCase().includes(str2.toLowerCase())) return str2;
        if (str2.toLowerCase().includes(str1.toLowerCase())) return str1;

        return null;
    };

    // Grouping
    allTopics.forEach(({ title, chat }) => {
        let bestClusterIndex = -1;
        let bestCommonLabel = title;

        for (let i = 0; i < clusters.length; i++) {
             const match = getCommonLabel(clusters[i].label, title);
             if (match) {
                 bestClusterIndex = i;
                 if (match.length < clusters[i].label.length && match.length > 3) {
                     bestCommonLabel = match; 
                 } else {
                     bestCommonLabel = clusters[i].label;
                 }
                 break;
             }
        }

        if (bestClusterIndex !== -1) {
            clusters[bestClusterIndex].variations.push(title);
            clusters[bestClusterIndex].chats.add(chat);
             if (bestCommonLabel.length < clusters[bestClusterIndex].label.length) {
                 clusters[bestClusterIndex].label = bestCommonLabel;
             }
        } else {
            clusters.push({
                label: title,
                variations: [title],
                chats: new Set([chat])
            });
        }
    });

    // C. Create Nodes
    const newNodes: Node[] = clusters.map((c, i) => {
        const count = c.chats.size;
        const label = c.label.charAt(0).toUpperCase() + c.label.slice(1);
        
        return {
            id: label,
            label: label,
            count: count,
            chats: Array.from(c.chats),
            radius: 40 + Math.sqrt(count) * 15, // Slightly larger base to fit text
            x: window.innerWidth / 2 + (Math.random() - 0.5) * 100, 
            y: window.innerHeight / 2 + (Math.random() - 0.5) * 100,
            vx: 0,
            vy: 0,
            color: COLORS[i % COLORS.length]
        };
    });

    // D. Create Edges
    const newLinks: Link[] = [];
    for (let i = 0; i < newNodes.length; i++) {
        for (let j = i + 1; j < newNodes.length; j++) {
            const wordsA = getWords(newNodes[i].label);
            const wordsB = getWords(newNodes[j].label);
            const intersection = wordsA.filter(w => wordsB.includes(w));
            
            if (intersection.length > 0) {
                newLinks.push({
                    source: newNodes[i].id,
                    target: newNodes[j].id,
                    strength: intersection.length * 0.1
                });
            }
        }
    }

    setNodes(newNodes);
    setLinks(newLinks);

  }, [isOpen, recentChats]);

  // --- 2. PHYSICS SIMULATION ---
  useEffect(() => {
    if (!isOpen || nodes.length === 0) return;

    const tick = () => {
      setNodes(prevNodes => {
        const nextNodes = prevNodes.map(n => ({ ...n }));
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;
        
        // PHYSICS CONSTANTS - STABLE
        const friction = 0.70; // High friction prevents shaking
        const gravityStrength = 0.0005; 
        const springStrength = 0.005; 
        const repulsionStrength = 400; 

        // 1. Repulsion 
        for (let i = 0; i < nextNodes.length; i++) {
          for (let j = i + 1; j < nextNodes.length; j++) {
            const a = nextNodes[i];
            const b = nextNodes[j];
            const dx = a.x - b.x;
            const dy = a.y - b.y;
            const distSq = dx * dx + dy * dy;
            const dist = Math.sqrt(distSq) || 1;
            const minDist = a.radius + b.radius + 20; 

            if (dist < 800) { 
                let force = 0;
                if (dist < minDist) {
                    force = (minDist - dist) * 0.1; // Strong push if overlapping
                } else {
                    force = repulsionStrength / (distSq + 1);
                }
                force = Math.min(force, 2); 

                const fx = (dx / dist) * force;
                const fy = (dy / dist) * force;
                
                if (a.id !== draggingNode.current) { a.vx += fx; a.vy += fy; }
                if (b.id !== draggingNode.current) { b.vx -= fx; b.vy -= fy; }
            }
          }
        }

        // 2. Spring 
        links.forEach(link => {
            const source = nextNodes.find(n => n.id === link.source);
            const target = nextNodes.find(n => n.id === link.target);
            if (source && target) {
                const dx = target.x - source.x;
                const dy = target.y - source.y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                const targetLen = (source.radius + target.radius) + 80;
                
                const force = (dist - targetLen) * springStrength;

                if (source.id !== draggingNode.current) { source.vx += dx * force; source.vy += dy * force; }
                if (target.id !== draggingNode.current) { target.vx -= dx * force; target.vy -= dy * force; }
            }
        });

        // 3. Gravity & Update
        nextNodes.forEach(n => {
            if (n.id === draggingNode.current) return;
            
            n.vx += (centerX - n.x) * gravityStrength;
            n.vy += (centerY - n.y) * gravityStrength;

            n.x += n.vx;
            n.y += n.vy;

            n.vx *= friction;
            n.vy *= friction;
        });

        return nextNodes;
      });

      requestRef.current = requestAnimationFrame(tick);
    };

    requestRef.current = requestAnimationFrame(tick);

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [nodes.length, links, isOpen]);

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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
      
      {/* Container */}
      <div className="relative w-full h-full flex overflow-hidden">
        
        {/* Main Graph Area */}
        <div className="flex-1 relative bg-gray-50 dark:bg-slate-950 cursor-move overflow-hidden"
             onMouseMove={handleMouseMove}
             onMouseUp={handleMouseUp}
             onMouseLeave={handleMouseUp}
        >
            {/* Header Controls */}
            <div className="absolute top-4 left-4 right-4 flex justify-between items-start pointer-events-none">
                <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur p-4 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm pointer-events-auto">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <Network className="text-blue-500" /> Topic Map
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">
                        Visualizing recent {recentChats.length} chats.
                    </p>
                </div>

                <div className="flex flex-col gap-2 pointer-events-auto">
                    <button onClick={onClose} className="p-3 bg-white dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full shadow-lg border border-gray-200 dark:border-slate-700 text-slate-500 transition-colors">
                        <X size={24} />
                    </button>
                    <div className="bg-white dark:bg-slate-800 rounded-full shadow-lg border border-gray-200 dark:border-slate-700 p-1 flex flex-col gap-1 mt-2">
                        <button onClick={() => setScale(s => Math.min(s + 0.1, 2))} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full"><ZoomIn size={20} /></button>
                        <button onClick={() => setScale(s => Math.max(s - 0.1, 0.4))} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full"><ZoomOut size={20} /></button>
                    </div>
                </div>
            </div>

            <svg 
                ref={svgRef}
                viewBox="0 0 1000 800" 
                className="w-full h-full"
                style={{ touchAction: 'none' }}
                preserveAspectRatio="xMidYMid slice"
            >
                <g transform={`scale(${scale})`}>
                    {/* Edges */}
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
                                strokeOpacity="0.3"
                                strokeWidth={1 + link.strength * 5}
                            />
                        );
                    })}

                    {/* Nodes */}
                    {nodes.map((node) => (
                        <g 
                            key={node.id} 
                            transform={`translate(${node.x},${node.y})`}
                            onMouseDown={(e) => handleMouseDown(e, node.id)}
                            onClick={(e) => { e.stopPropagation(); setSelectedNode(node); }}
                            className="cursor-pointer transition-colors"
                        >
                            {/* Glow Effect */}
                            <circle
                                r={node.radius + 15}
                                fill={node.color}
                                fillOpacity={selectedNode?.id === node.id ? "0.2" : "0"}
                                className="transition-all duration-300 animate-pulse"
                            />
                            
                            {/* Main Bubble */}
                            <circle
                                r={node.radius}
                                fill={node.color}
                                fillOpacity="1"
                                stroke="white"
                                strokeWidth="0"
                                className="shadow-xl"
                            />

                            {/* Count Badge */}
                            <circle 
                                r={10} 
                                cx={node.radius * 0.7} 
                                cy={-node.radius * 0.7} 
                                className="fill-white"
                            />
                            <text
                                x={node.radius * 0.7} 
                                y={-node.radius * 0.7}
                                dy=".35em"
                                textAnchor="middle"
                                className="text-[10px] fill-slate-900 font-bold pointer-events-none"
                            >
                                {node.count}
                            </text>

                            {/* Label - Black Text, Better Font, Smaller */}
                            <text
                                dy={0}
                                textAnchor="middle"
                                className="font-sans font-medium tracking-tight fill-slate-900 pointer-events-none"
                                style={{ 
                                    fontSize: Math.min(14, Math.max(10, node.radius / 5)) // Smaller ratio
                                }}
                            >
                                {node.label.split(' ').slice(0, 2).join(' ')}
                            </text>
                             {node.label.split(' ').length > 2 && (
                                <text
                                    dy={Math.min(14, Math.max(10, node.radius / 5)) + 2}
                                    textAnchor="middle"
                                    className="font-sans font-medium tracking-tight fill-slate-900 pointer-events-none"
                                    style={{ 
                                        fontSize: Math.min(14, Math.max(10, node.radius / 5)) // Smaller ratio
                                    }}
                                >
                                    {node.label.split(' ').slice(2).join(' ')}
                                </text>
                            )}
                        </g>
                    ))}
                </g>
            </svg>
        </div>

        {/* Right Sidebar - Selected Topic Details */}
        {selectedNode && (
            <div className="w-80 bg-white dark:bg-slate-900 border-l border-gray-200 dark:border-slate-800 shadow-2xl z-20 flex flex-col animate-in slide-in-from-right duration-300">
                <div className="p-6 border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50">
                    <button 
                        onClick={() => setSelectedNode(null)}
                        className="mb-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center gap-1 text-xs"
                    >
                        <ArrowRight size={14} className="rotate-180" /> Back to Graph
                    </button>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 leading-tight">
                        {selectedNode.label}
                    </h2>
                    <p className="text-sm text-slate-500 mt-2">
                        Contains {selectedNode.count} related conversations.
                    </p>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {selectedNode.chats.map((chat) => (
                        <button
                            key={chat.id}
                            onClick={() => {
                                onSelectChat(chat);
                                onClose();
                            }}
                            className="w-full text-left p-4 rounded-xl border border-gray-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-600 bg-white dark:bg-slate-800/50 hover:bg-blue-50 dark:hover:bg-slate-800 transition-all group shadow-sm"
                        >
                            <h4 className="font-semibold text-slate-800 dark:text-slate-200 text-sm mb-1 line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                                {chat.title}
                            </h4>
                            <div className="flex items-center justify-between mt-2">
                                <span className="text-xs text-slate-400">
                                    {new Date(chat.timestamp).toLocaleDateString()}
                                </span>
                                <ExternalLink size={14} className="text-slate-300 group-hover:text-blue-500" />
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default GlobalTopicGraphModal;