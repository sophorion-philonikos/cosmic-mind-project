'use client';
import StarMap from '../components/StarMap';
import { useState, useEffect } from 'react';

// Type definition for our history states
type MapSnapshot = {
  query: string;
  nodes: {book: string, chapter: number, verses?: string, text?: string}[];
  connections: {source: string, target: string}[];
};

export default function CosmicMindUI() {
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [drawerWidth, setDrawerWidth] = useState(450); 
  const [isDragging, setIsDragging] = useState(false);
  const [isMobile, setIsMobile] = useState(false); 
  const [windowWidth, setWindowWidth] = useState(1000); 

  const [query, setQuery] = useState('');
  const [chatLog, setChatLog] = useState<{role: string, text: string}[]>([]);
  
  const [activeConstellation, setActiveConstellation] = useState<MapSnapshot['nodes']>([]);
  const [activeConnections, setActiveConnections] = useState<MapSnapshot['connections']>([]);
  const [isLoading, setIsLoading] = useState(false);

  const [history, setHistory] = useState<MapSnapshot[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Handle Mobile Detection & Window Width
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
      setWindowWidth(window.innerWidth);
    };
    handleResize(); 
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Handle Dragging Logic (Capped at 50%)
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      
      const newWidth = window.innerWidth - e.clientX;
      const maxWidth = window.innerWidth * 0.5; // Hard cap at 50%
      
      if (newWidth >= 320 && newWidth <= maxWidth) {
        setDrawerWidth(newWidth);
      } else if (newWidth > maxWidth) {
        setDrawerWidth(maxWidth);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = 'none'; 
    } else {
      document.body.style.userSelect = '';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const askTheCosmicMind = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    const userQuery = query;
    setChatLog(prev => [...prev, { role: 'user', text: userQuery }]);
    setIsLoading(true);
    setQuery('');

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: userQuery }),
      });
      
      const data = await res.json();

      setChatLog(prev => [...prev, { role: 'ai', text: data.answer }]);
      
      const newNodes = data.nodes || [];
      const newConnections = data.connections || [];

      setActiveConstellation(newNodes);
      setActiveConnections(newConnections);
      
      setHistory(prev => {
        const updatedHistory = prev.slice(0, historyIndex + 1);
        return [...updatedHistory, { query: userQuery, nodes: newNodes, connections: newConnections }];
      });
      setHistoryIndex(prev => prev + 1);

    } catch (error) {
      console.error(error);
      setChatLog(prev => [...prev, { role: 'ai', text: 'Connection lost to the stars.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const jumpToHistory = (targetIndex: number) => {
    if (targetIndex >= 0 && targetIndex < history.length) {
      setHistoryIndex(targetIndex);
      setActiveConstellation(history[targetIndex].nodes);
      setActiveConnections(history[targetIndex].connections);
    } else if (targetIndex === -1) {
      setHistoryIndex(-1);
      setActiveConstellation([]);
      setActiveConnections([]);
    }
  };

  // Trigger two-column mode when the drawer hits 48% of the screen width
  const isWideMode = !isMobile && drawerWidth >= windowWidth * 0.48;

  return (
    <div className="relative w-full h-screen bg-black text-white overflow-hidden">
      
      {/* 3D MOUSE SHIELD */}
      {isDragging && <div className="absolute inset-0 z-50 cursor-col-resize" />}

      {/* 1. THE STAR MAP (Always 100% width, placed in the background) */}
      <div className="absolute inset-0 z-0">
        <StarMap 
          activeNodes={activeConstellation} 
          activeConnections={activeConnections}
          isChatOpen={isChatOpen}
          chatWidth={drawerWidth} 
        />
      </div>

      {/* 2. FLOATING UI CONTROLS (Positioned above the map, but below the drawer) */}
      <div className="absolute top-4 right-4 z-20 flex gap-4 items-start pointer-events-none">
        
        {/* Temporal Navigation HUD Overlay */}
        <div className="flex gap-2 pointer-events-auto">
           <button 
             onClick={() => jumpToHistory(historyIndex - 1)}
             disabled={historyIndex < 0}
             className="px-3 py-1 bg-gray-900/80 backdrop-blur-md border border-gray-700 rounded text-xs text-gray-400 hover:text-cyan-400 hover:border-cyan-500 disabled:opacity-30 disabled:hover:border-gray-700 disabled:hover:text-gray-400 transition-all cursor-pointer shadow-lg"
           >
             ◀ REWIND
           </button>
           <button 
             onClick={() => jumpToHistory(historyIndex + 1)}
             disabled={historyIndex >= history.length - 1}
             className="px-3 py-1 bg-gray-900/80 backdrop-blur-md border border-gray-700 rounded text-xs text-gray-400 hover:text-cyan-400 hover:border-cyan-500 disabled:opacity-30 disabled:hover:border-gray-700 disabled:hover:text-gray-400 transition-all cursor-pointer shadow-lg"
           >
             FORWARD ▶
           </button>
        </div>

        {/* Toggle Button: Appears when chat is closed */}
        <div className={`transition-all duration-300 pointer-events-auto ${isChatOpen ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
          <button
            onClick={() => setIsChatOpen(true)}
            className="bg-gray-900/90 border border-cyan-500/50 text-cyan-400 px-4 py-2 rounded text-xs uppercase tracking-widest font-bold shadow-[0_0_15px_rgba(0,255,255,0.2)] hover:bg-cyan-900/60 hover:text-white transition-all duration-300 backdrop-blur-md"
          >
            Open Oracle
          </button>
        </div>

      </div>

      {/* 3. THE GLASS OVERLAY DRAWER */}
      <div 
        className={`
          absolute top-0 right-0 h-full z-40 flex flex-col shadow-[-10px_0_30px_rgba(0,0,0,0.5)]
          bg-black/40 backdrop-blur-md border-l border-cyan-900/30
          ${isDragging ? 'duration-0' : 'transition-transform duration-500 ease-in-out'}
        `}
        style={{
          width: isMobile ? '100%' : `${drawerWidth}px`,
          transform: isChatOpen ? 'translateX(0)' : 'translateX(100%)'
        }}
      >
        
        {/* DRAG HANDLE */}
        {isChatOpen && !isMobile && (
          <div
            onMouseDown={() => setIsDragging(true)}
            className="absolute left-0 top-0 bottom-0 w-2 hover:bg-cyan-500/30 cursor-col-resize z-50 transition-colors group flex items-center justify-center"
          >
            <div className="h-10 w-[2px] bg-gray-700 group-hover:bg-cyan-400 rounded-full transition-colors" />
          </div>
        )}

        {/* Drawer Header */}
        <div className="flex justify-between items-center p-4 border-b border-white/5 min-h-[60px] pl-6">
          <h2 className="text-gray-400 font-bold tracking-widest uppercase text-sm drop-shadow-md">The Oracle</h2>
          <button 
            onClick={() => setIsChatOpen(false)}
            className="text-gray-500 hover:text-white transition-colors p-2 text-lg leading-none"
          >
            ✕
          </button>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 flex flex-col p-6 overflow-hidden pl-8">
          <div className="flex-1 overflow-y-auto space-y-8 custom-scrollbar pr-2">
            {chatLog.map((msg, idx) => (
              <div key={idx} className={msg.role === 'user' ? 'text-gray-400' : 'text-gray-100'}>
                <span className="font-bold text-xs uppercase tracking-widest text-gray-500 block mb-2">
                  {msg.role === 'user' ? 'You' : 'Cosmic Mind'}
                </span>
                
                {/* DYNAMIC TWO-COLUMN TEXT RENDERER */}
                <div className={`
                  leading-relaxed whitespace-pre-wrap transition-all duration-300
                  ${isWideMode ? 'columns-2 gap-8 text-xs' : 'text-[13px]'}
                `}>
                  {msg.text}
                </div>

              </div>
            ))}
            {isLoading && <div className="text-cyan-500 animate-pulse font-mono text-xs">Calculating constellations...</div>}
          </div>

          {/* Input Box */}
          <form onSubmit={askTheCosmicMind} className="mt-4 shrink-0">
            <input 
              type="text" 
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask the archives..."
              className="w-full bg-gray-900/60 border border-gray-700/50 rounded-lg p-4 text-[13px] text-white focus:outline-none focus:border-cyan-500 transition-colors backdrop-blur-sm shadow-inner"
            />
          </form>
        </div>

      </div>
    </div>
  );
}