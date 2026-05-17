'use client';

import dynamic from 'next/dynamic';
import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';

const CANONICAL_BOOKS = [
  "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy", "Joshua", "Judges", "Ruth", "1 Samuel", "2 Samuel", "1 Kings", "2 Kings", "1 Chronicles", "2 Chronicles", "Ezra", "Nehemiah", "Esther", "Job", "Psalms", "Proverbs", "Ecclesiastes", "Song of Solomon", "Isaiah", "Jeremiah", "Lamentations", "Ezekiel", "Daniel", "Hosea", "Joel", "Amos", "Obadiah", "Jonah", "Micah", "Nahum", "Habakkuk", "Zephaniah", "Haggai", "Zechariah", "Malachi",
  "Tobit", "Judith", "Additions to Esther", "Wisdom of Solomon", "Sirach", "Baruch", "Letter of Jeremiah", "Prayer of Azariah", "Susanna", "Bel and the Dragon", "1 Maccabees", "2 Maccabees", "1 Esdras", "2 Esdras", "Prayer of Manasseh", "3 Maccabees", "2 Baruch", "4 Maccabees",
  "Matthew", "Mark", "Luke", "John", "Acts", "Romans", "1 Corinthians", "2 Corinthians", "Galatians", "Ephesians", "Philippians", "Colossians", "1 Thessalonians", "2 Thessalonians", "1 Timothy", "2 Timothy", "Titus", "Philemon", "Hebrews", "James", "1 Peter", "2 Peter", "1 John", "2 John", "3 John", "Jude", "Revelation"
];

const levenshteinDistance = (s: string, t: string) => {
  if (!s.length) return t.length;
  if (!t.length) return s.length;
  const arr = [];
  for (let i = 0; i <= t.length; i++) {
    arr[i] = [i];
    for (let j = 1; j <= s.length; j++) {
      arr[i][j] = i === 0 ? j : Math.min(
        arr[i - 1][j] + 1,
        arr[i][j - 1] + 1,
        arr[i - 1][j - 1] + (s[j - 1] === t[i - 1] ? 0 : 1)
      );
    }
  }
  return arr[t.length][s.length];
};

const generateGlowTexture = (r: number, g: number, b: number) => {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext('2d');
  if (context) {
    const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 1)`);
    gradient.addColorStop(0.2, `rgba(${r}, ${g}, ${b}, 0.4)`);
    gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
    context.fillStyle = gradient;
    context.fillRect(0, 0, 64, 64);
  }
  return new THREE.CanvasTexture(canvas);
};

const cyanGlowTexture = generateGlowTexture(0, 255, 255);
const yellowGlowTexture = generateGlowTexture(255, 204, 0);
const redGlowTexture = generateGlowTexture(255, 50, 50);
const purpleGlowTexture = generateGlowTexture(139, 92, 246); // NEW: Purple glow for semantic siblings

const ForceGraph3D = dynamic(() => import('react-force-graph-3d'), { 
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-full text-cyan-500 text-sm tracking-widest animate-pulse">Igniting Cosmic Engine...</div>
});

const getBookName = (nodeRef: any) => {
  if (!nodeRef) return '';
  if (nodeRef.book) return nodeRef.book;
  if (typeof nodeRef === 'string') return nodeRef.replace(/\s\d+$/, '');
  return '';
};

export default function StarMap({ activeNodes, activeConnections = [] }: { activeNodes: any[], activeConnections?: any[] }) {
  const normalizedActiveNodes = useMemo(() => {
    return activeNodes.map(node => ({
      ...node,
      book: node.book === "Psalm" ? "Psalms" : node.book
    }));
  }, [activeNodes]);

  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [baseUniverse, setBaseUniverse] = useState({ nodes: [], links: [] });
  const [activeUniverse, setActiveUniverse] = useState({ nodes: [], links: [] });
  const [crossRefDatabase, setCrossRefDatabase] = useState<Record<string, string[]>>({});
  
  const [isDynamicLayout, setIsDynamicLayout] = useState(true);
  const [isCalibrating, setIsCalibrating] = useState(true);
  
  const [locatorQuery, setLocatorQuery] = useState('');
  const [highlightedBook, setHighlightedBook] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // HEATMAP STATE
  const [themeQuery, setThemeQuery] = useState('');
  const [heatmapScores, setHeatmapScores] = useState<Record<string, number>>({});
  const [isSearchingTheme, setIsSearchingTheme] = useState(false);
  
  // NEW: SEMANTIC MULTI-HOP STATE
  const [semanticIds, setSemanticIds] = useState<string[]>([]);
  const [semanticLinks, setSemanticLinks] = useState<any[]>([]);
  const [isScanningSemantic, setIsScanningSemantic] = useState(false);

  // MANUSCRIPT TEXT STATE
  const [nodeText, setNodeText] = useState<string>('');
  const [isFetchingText, setIsFetchingText] = useState(false);

  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [audioRate, setAudioRate] = useState<number>(1);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);

  const stableCoordsRef = useRef<Record<string, {x: number, y: number, z: number}>>({});
  const hasCaptured = useRef(false);
  const fgRef = useRef<any>();
  const [selectedNode, setSelectedNode] = useState<any | null>(null);

  const activeUniverseRef = useRef(activeUniverse);
  useEffect(() => { activeUniverseRef.current = activeUniverse; }, [activeUniverse]);

  // Clear semantic nodes when the Oracle generates a new answer
  useEffect(() => {
    setSemanticIds([]);
    setSemanticLinks([]);
  }, [activeNodes]);

  // NEW: MULTI-HOP API CALL
  const handleScanSiblings = async () => {
    if (!selectedNode) return;
    setIsScanningSemantic(true);
    try {
      const res = await fetch('/api/semantic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chapterId: selectedNode.id })
      });
      const data = await res.json();
      
      const newIds = data.nodes.map((n: any) => n.id);
      setSemanticIds(prev => Array.from(new Set([...prev, ...newIds])));
      
      // Merge new ghost links, preventing duplicate drawing
      setSemanticLinks(prev => {
        const existing = new Set(prev.map(l => `${l.source.id || l.source}-${l.target.id || l.target}`));
        const toAdd = data.connections.filter((c: any) => !existing.has(`${c.source}-${c.target}`));
        return [...prev, ...toAdd];
      });
    } catch (err) {
       console.error("Semantic Scan failed:", err);
    } finally {
       setIsScanningSemantic(false);
    }
  };

  useEffect(() => {
    if (!selectedNode) {
        setNodeText('');
        return;
    }
    setIsFetchingText(true);
    fetch('/api/manuscript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chapterId: selectedNode.id })
    })
    .then(res => res.json())
    .then(data => setNodeText(data.text || "No manuscript data found."))
    .catch(() => setNodeText("Error establishing connection to archives."))
    .finally(() => setIsFetchingText(false));
  }, [selectedNode]);

  const handleThemeSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!themeQuery.trim()) return;
    
    setIsSearchingTheme(true);
    setHighlightedBook(''); 
    setLocatorQuery('');
    setSelectedNode(null); 
    
    try {
      const res = await fetch('/api/heatmap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: themeQuery })
      });
      const data = await res.json();
      if (data.scores) {
          setHeatmapScores(data.scores);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearchingTheme(false);
    }
  };

  const clearHeatmap = () => {
      setThemeQuery('');
      setHeatmapScores({});
  };

  useEffect(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      const loadVoices = () => setAvailableVoices(window.speechSynthesis.getVoices());
      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  const getPremiumVoice = (langCode: string) => {
    if (!availableVoices.length) return null;
    const matchingVoices = availableVoices.filter(v => v.lang.startsWith(langCode.split('-')[0]));
    if (!matchingVoices.length) return null;
    const premiumVoice = matchingVoices.find(v => 
      v.name.includes('Google') || v.name.includes('Premium') || v.name.includes('Natural') || v.name.includes('Siri')
    );
    return premiumVoice || matchingVoices[0];
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT') return;
      if (!selectedNode) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        const targetChapter = e.key === 'ArrowRight' ? selectedNode.chapter + 1 : selectedNode.chapter - 1;
        const targetNode = activeUniverseRef.current.nodes.find((n: any) => n.id === `${selectedNode.book} ${targetChapter}`);
        if (targetNode) { e.preventDefault(); handleNodeClick(targetNode); }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNode]);

  const handleToggleAudio = (text: string, langCode: string, id: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    if (playingAudioId === id) {
      window.speechSynthesis.cancel();
      setPlayingAudioId(null);
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = langCode;
    utterance.rate = audioRate;
    const bestVoice = getPremiumVoice(langCode);
    if (bestVoice) utterance.voice = bestVoice;
    utterance.onend = () => setPlayingAudioId(null);
    utterance.onerror = () => setPlayingAudioId(null);
    window.speechSynthesis.speak(utterance);
    setPlayingAudioId(id);
  };

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
        setPlayingAudioId(null);
      }
    };
  }, [selectedNode]);

  const flyToBook = useCallback((bookName: string) => {
    if (!fgRef.current || !bookName) return;
    const bookNodes = activeUniverseRef.current.nodes.filter(
      (n: any) => n.book?.toLowerCase() === bookName.toLowerCase() && n.x !== undefined
    );
    if (bookNodes.length === 0) return;
    let cx = 0, cy = 0, cz = 0;
    bookNodes.forEach((n: any) => { cx += n.x; cy += n.y; cz += n.z; });
    cx /= bookNodes.length; cy /= bookNodes.length; cz /= bookNodes.length;
    const distance = bookNodes.length > 40 ? 350 : 200; 
    const distRatio = 1 + distance / Math.hypot(cx, cy, cz) || 1; 
    fgRef.current.cameraPosition({ x: cx * distRatio, y: cy * distRatio, z: cz * distRatio }, { x: cx, y: cy, z: cz }, 2000);
  }, []);

  const resetCamera = useCallback(() => {
    if (fgRef.current) {
      fgRef.current.cameraPosition({ x: 0, y: 0, z: 600 }, { x: 0, y: 0, z: 0 }, 2000);
    }
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (!locatorQuery || locatorQuery.length < 2) { 
        setSuggestions([]); 
        return; 
      }
      
      const lowerQuery = locatorQuery.toLowerCase();
      const scored = CANONICAL_BOOKS.map(book => {
        const lowerBook = book.toLowerCase();
        let score = 100;
        if (lowerBook === lowerQuery) score = 0; 
        else if (lowerBook.includes(lowerQuery)) score = 1; 
        else {
          const dist = levenshteinDistance(lowerQuery.replace(/[0-9 ]/g, ''), lowerBook.replace(/[0-9 ]/g, ''));
          score = dist + 2; 
        }
        return { book, score };
      });
      
      setSuggestions(scored.filter(item => item.score <= 4).sort((a, b) => a.score - b.score).map(item => item.book).slice(0, 5));
    }, 300); 

    return () => clearTimeout(timeoutId);
  }, [locatorQuery]);

  useEffect(() => {
    fetch('/galaxy.json').then(res => res.json()).then(data => { setBaseUniverse(data); setActiveUniverse(data); }).catch(console.error);
    fetch('/cross_references.json').then(res => res.json()).then(data => setCrossRefDatabase(data)).catch(console.error);
  }, []);

  useEffect(() => {
    if (!baseUniverse.nodes.length) return;
    const physicsTimer = setTimeout(() => {
      if (fgRef.current) {
        const chargeForce = fgRef.current.d3Force('charge');
        if (chargeForce) { chargeForce.strength(-40); chargeForce.distanceMax(150); }
      }
    }, 1000);
    const snapshotTimer = setTimeout(() => {
      if (!hasCaptured.current) {
         const coords: Record<string, {x: number, y: number, z: number}> = {};
         activeUniverseRef.current.nodes.forEach((n: any) => {
            if (n.x !== undefined && n.y !== undefined && n.z !== undefined) coords[n.id] = { x: n.x, y: n.y, z: n.z };
         });
         stableCoordsRef.current = coords;
         hasCaptured.current = true;
         setIsCalibrating(false);
      }
    }, 3500);
    return () => { clearTimeout(physicsTimer); clearTimeout(snapshotTimer); };
  }, [baseUniverse.nodes.length]);

  useEffect(() => {
    if (!baseUniverse.nodes.length) return;
    
    const currentActiveIds = normalizedActiveNodes.map(node => `${node.book} ${node.chapter}`);

    const newUniverse = {
      nodes: baseUniverse.nodes.map(n => {
         const cloned = { ...n };
         // The Pristine Merge: A node is active if the Oracle called it OR if the Multi-Hop math found it
         const isNodeActive = currentActiveIds.includes(cloned.id) || semanticIds.includes(cloned.id);
         
         const shouldLock = !isDynamicLayout || !isNodeActive;
         if (shouldLock && stableCoordsRef.current[cloned.id]) {
            cloned.fx = stableCoordsRef.current[cloned.id].x;
            cloned.fy = stableCoordsRef.current[cloned.id].y;
            cloned.fz = stableCoordsRef.current[cloned.id].z;
         } else {
            cloned.fx = undefined; cloned.fy = undefined; cloned.fz = undefined;
         }
         return cloned;
      }),
      links: baseUniverse.links.map((link: any) => ({
        ...link,
        source: typeof link.source === 'object' ? link.source.id : link.source,
        target: typeof link.target === 'object' ? link.target.id : link.target
      }))
    };

    if (activeConnections && activeConnections.length > 0) {
      const validLinks = activeConnections.filter(link => {
        return baseUniverse.nodes.some((n: any) => n.id === link.source) && baseUniverse.nodes.some((n: any) => n.id === link.target);
      }).map(link => ({ source: link.source, target: link.target, isDynamic: true }));
      newUniverse.links = [...newUniverse.links, ...validLinks];
    }

    if (selectedNode && crossRefDatabase[selectedNode.id]) {
      crossRefDatabase[selectedNode.id].forEach(targetId => {
        if (baseUniverse.nodes.some((n:any) => n.id === targetId)) {
          newUniverse.links.push({ source: selectedNode.id, target: targetId, isStaticReference: true });
        }
      });
    }

    // Merge the Ghost Links into the physics engine safely
    if (semanticLinks && semanticLinks.length > 0) {
        const validSemanticLinks = semanticLinks.filter(link => {
            return baseUniverse.nodes.some((n: any) => n.id === (link.source.id || link.source)) && 
                   baseUniverse.nodes.some((n: any) => n.id === (link.target.id || link.target));
        });
        newUniverse.links = [...newUniverse.links, ...validSemanticLinks];
    }

    setActiveUniverse(newUniverse);
    
    setTimeout(() => {
      if (fgRef.current) {
        const linkForce = fgRef.current.d3Force('link');
        if (linkForce) {
          linkForce.distance((link: any) => link.isDynamic ? 60 : 30);
          linkForce.strength((link: any) => {
            if (link.isSemantic) return 0; // ZERO GRAVITY for Ghost Links
            if (link.isStaticReference) return 0; 
            if (!isDynamicLayout) return link.isDynamic ? 0 : 0.4; 
            return link.isDynamic ? 0.8 : 0.4;
          });
        }
      }
    }, 50);
  }, [JSON.stringify(activeConnections), JSON.stringify(normalizedActiveNodes), baseUniverse, isDynamicLayout, selectedNode, crossRefDatabase, semanticIds, semanticLinks]); 

  useEffect(() => {
    const container = document.getElementById('starmap-container');
    if (!container) return;

    let resizeTimeout: NodeJS.Timeout;

    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
          setDimensions({ 
            width: entry.contentRect.width, 
            height: entry.contentRect.height 
          });
        }, 50); 
      }
    });

    resizeObserver.observe(container);
    setDimensions({ width: container.clientWidth, height: container.clientHeight });

    return () => {
      resizeObserver.disconnect();
      clearTimeout(resizeTimeout);
    };
  }, []);

  const activeChapterIds = useMemo(() => normalizedActiveNodes.map(node => `${node.book} ${node.chapter}`), [normalizedActiveNodes]);
  const hasActiveNodes = normalizedActiveNodes.length > 0;
  const isHeatmapActive = Object.keys(heatmapScores).length > 0;

  const handleNodeClick = useCallback((node: any) => {
    if (node.x === undefined || node.y === undefined || node.z === undefined) return;
    const distance = 120; 
    const distRatio = 1 + distance / Math.hypot(node.x, node.y, node.z);
    if (fgRef.current) fgRef.current.cameraPosition({ x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio }, node, 2000);
    setSelectedNode(node);
  }, []);

  const handleHudClick = (targetId: string) => {
    const targetNode = activeUniverse.nodes.find((n: any) => n.id === targetId);
    if (targetNode) handleNodeClick(targetNode);
  };

  const renderAudioButton = (text: string, langCode: string, id: string) => (
    <button
      onClick={(e) => { e.stopPropagation(); handleToggleAudio(text, langCode, id); }}
      className={`ml-2 text-[8px] font-bold tracking-wider px-1.5 py-0.5 rounded border transition-colors ${
        playingAudioId === id ? 'bg-red-900/40 border-red-500 text-red-400 shadow-[0_0_8px_rgba(239,68,68,0.2)]' : 'bg-cyan-900/20 border-cyan-800 text-cyan-600 hover:text-cyan-400 hover:border-cyan-500'
      }`}
    >
      {playingAudioId === id ? '■ STOP' : '▶ PLAY FULL'}
    </button>
  );

  const renderInteractiveClauses = (text: string, langCode: string, idPrefix: string) => {
    const clauses = text.split(/(?<=[.,:;!?׃·]+)\s+/g);
    return (
      <div className="inline">
        {clauses.map((clause, idx) => {
          const clauseId = `${idPrefix}-clause-${idx}`;
          const isPlaying = playingAudioId === clauseId;
          return (
            <span
              key={idx}
              onClick={(e) => { e.stopPropagation(); handleToggleAudio(clause, langCode, clauseId); }}
              className={`cursor-pointer transition-all duration-200 rounded px-1 -ml-1 inline-block ${
                isPlaying ? 'bg-cyan-900/70 text-cyan-200 border-b-2 border-cyan-400 shadow-[0_0_10px_rgba(0,255,255,0.3)]' : 'hover:bg-gray-700/50 hover:text-white'
              }`}
            >
              {clause}{' '}
            </span>
          );
        })}
      </div>
    );
  };

  return (
    <div id="starmap-container" className="w-full h-full bg-black relative">
      <div className="absolute top-4 left-4 z-10 pointer-events-auto flex flex-col gap-3">
        
        {/* ROW 1: HUD Controls */}
        <div className="flex items-center gap-4">
          <div className="text-xs text-gray-500 pointer-events-none uppercase tracking-widest font-bold">Cosmic Map Engine</div>
          
          <button 
            onClick={() => setIsDynamicLayout(!isDynamicLayout)} disabled={isCalibrating}
            className={`text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded border transition-all duration-300 ${
              isCalibrating ? 'bg-gray-800 border-gray-700 text-gray-500 cursor-not-allowed' : isDynamicLayout ? 'bg-cyan-900/40 border-cyan-500 text-cyan-400 shadow-[0_0_10px_rgba(0,255,255,0.2)]' : 'bg-gray-800 border-gray-600 text-gray-400 hover:text-white hover:border-gray-400'
            }`}
          >
            {isCalibrating ? 'CALIBRATING GALAXY...' : (isDynamicLayout ? 'Dynamic Clustering : ON' : 'Static Galaxy : ON')}
          </button>

          <button 
            onClick={resetCamera}
            className="text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded border border-gray-600 bg-gray-800 text-gray-400 hover:text-white hover:border-gray-400 transition-all duration-300 shadow-md"
          >
            CENTER GALAXY
          </button>
        </div>

        {/* ROW 2: Canonical Locator */}
        <div className="flex items-center relative">
          <form 
            onSubmit={(e) => { 
              e.preventDefault(); 
              let targetBook = locatorQuery.trim();
              if (suggestions.length > 0) { targetBook = suggestions[0]; setLocatorQuery(suggestions[0]); }
              setHighlightedBook(targetBook); 
              setShowSuggestions(false); 
              flyToBook(targetBook); 
              clearHeatmap(); 
              setSelectedNode(null);
            }}
            className="flex items-center gap-2"
          >
            <div className="relative">
              <input 
                type="text" value={locatorQuery}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)} 
                onChange={(e) => { setLocatorQuery(e.target.value); setShowSuggestions(true); }}
                placeholder="Locate book (e.g. Genesis)..."
                className="bg-gray-900/80 border border-gray-700 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-yellow-500 w-48 shadow-lg backdrop-blur-sm"
              />
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute top-full mt-1 left-0 w-48 bg-gray-900 border border-gray-700 rounded shadow-xl overflow-hidden z-50">
                  {suggestions.map(suggestion => (
                    <button
                      key={suggestion} type="button"
                      onClick={() => { 
                        setLocatorQuery(suggestion); 
                        setHighlightedBook(suggestion); 
                        setShowSuggestions(false); 
                        flyToBook(suggestion); 
                        clearHeatmap(); 
                        setSelectedNode(null);
                      }}
                      className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-yellow-500/20 hover:text-yellow-500 transition-colors border-b border-gray-800 last:border-0"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button type="submit" className="text-[10px] uppercase font-bold tracking-wider px-2 py-1.5 rounded border border-yellow-500 text-yellow-500 hover:bg-yellow-500/20 transition-all shadow-[0_0_8px_rgba(255,204,0,0.1)]">Locate</button>
            {highlightedBook && <button type="button" onClick={() => { setHighlightedBook(''); setLocatorQuery(''); }} className="text-[10px] uppercase font-bold tracking-wider px-2 py-1.5 rounded text-gray-400 hover:text-white transition-all">Clear</button>}
          </form>
        </div>

        {/* ROW 3: Semantic Heatmap Search */}
        <div className="flex items-center relative">
          <form onSubmit={handleThemeSearch} className="flex items-center gap-2">
            <input 
              type="text" value={themeQuery}
              onChange={(e) => setThemeQuery(e.target.value)}
              placeholder="Search concepts (e.g. Loyalty)..."
              className="bg-gray-900/80 border border-gray-700 rounded px-2 py-1.5 text-xs text-red-400 focus:outline-none focus:border-red-500 w-48 shadow-lg backdrop-blur-sm"
            />
            <button type="submit" disabled={isSearchingTheme} className="text-[10px] uppercase font-bold tracking-wider px-2 py-1.5 rounded border border-red-500 text-red-500 hover:bg-red-500/20 transition-all shadow-[0_0_8px_rgba(255,0,0,0.1)]">
              {isSearchingTheme ? 'Scanning...' : 'Heatmap'}
            </button>
            {isHeatmapActive && <button type="button" onClick={clearHeatmap} className="text-[10px] uppercase font-bold tracking-wider px-2 py-1.5 rounded text-gray-400 hover:text-white transition-all">Clear</button>}
          </form>
        </div>

        {normalizedActiveNodes.length > 0 && (
          <div className="flex flex-wrap gap-2 text-cyan-400 font-mono text-sm max-w-xl mt-2">
            <span className="text-gray-500 pointer-events-none">Targeting:</span>
            {normalizedActiveNodes.map((node, idx) => {
              const targetId = `${node.book} ${node.chapter}`;
              return (
                <button key={idx} onClick={() => handleHudClick(targetId)} className="hover:text-white hover:underline transition-colors focus:outline-none">
                  {targetId}{idx < normalizedActiveNodes.length - 1 ? ',' : ''}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {activeUniverse.nodes.length > 0 && (
        <ForceGraph3D
          ref={fgRef} width={dimensions.width} height={dimensions.height} graphData={activeUniverse} nodeLabel="id"
          
          nodeThreeObject={(node: any) => {
            const isActive = activeChapterIds.includes(node.id);
            const isHighlighted = highlightedBook && node.book?.toLowerCase() === highlightedBook.toLowerCase();
            const isSelected = selectedNode && selectedNode.id === node.id;
            const isSemanticTarget = semanticIds.includes(node.id) && !activeChapterIds.includes(node.id);
            
            let isTarget = false;
            if (selectedNode && crossRefDatabase[selectedNode.id]) isTarget = crossRefDatabase[selectedNode.id].includes(node.id);

            const heatmapScore = isHeatmapActive && node.id ? (heatmapScores[node.id] || 0) : 0;
            const isHeatmapTarget = isHeatmapActive && heatmapScore > 0;

            const group = new THREE.Group();

            if (isHeatmapTarget) {
              const color = new THREE.Color();
              color.setHSL(0.05 + (0.05 * (1 - heatmapScore)), 1, 0.4 + (0.2 * heatmapScore)); 
              
              const coreGeo = new THREE.SphereGeometry(4 + (2 * heatmapScore), 16, 16); 
              const coreMat = new THREE.MeshBasicMaterial({ color: color });
              const core = new THREE.Mesh(coreGeo, coreMat);
              group.add(core);

              if (redGlowTexture) {
                const spriteMat = new THREE.SpriteMaterial({ map: redGlowTexture, color: color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.3 + (0.7 * heatmapScore) });
                const sprite = new THREE.Sprite(spriteMat);
                sprite.scale.set(35 + (15 * heatmapScore), 35 + (15 * heatmapScore), 1); 
                group.add(sprite);
              }
            } else if (isActive || isSelected) {
              const coreGeo = new THREE.SphereGeometry(4, 16, 16);
              const coreMat = new THREE.MeshBasicMaterial({ color: '#00ffff' });
              const core = new THREE.Mesh(coreGeo, coreMat);
              group.add(core);

              if (cyanGlowTexture) {
                const spriteMat = new THREE.SpriteMaterial({ map: cyanGlowTexture, color: 0x00ffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
                const sprite = new THREE.Sprite(spriteMat);
                sprite.scale.set(35, 35, 1); group.add(sprite);
              }
            } else if (isSemanticTarget) {
              // Deep Purple rendering for the new Ghost Nodes
              const coreGeo = new THREE.SphereGeometry(3, 16, 16);
              const coreMat = new THREE.MeshBasicMaterial({ color: '#8b5cf6' }); 
              const core = new THREE.Mesh(coreGeo, coreMat);
              group.add(core);

              if (purpleGlowTexture) {
                const spriteMat = new THREE.SpriteMaterial({ map: purpleGlowTexture, color: 0x8b5cf6, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
                const sprite = new THREE.Sprite(spriteMat);
                sprite.scale.set(28, 28, 1); group.add(sprite);
              }
            } else if (isTarget) {
              const coreGeo = new THREE.SphereGeometry(4, 16, 16);
              const coreMat = new THREE.MeshBasicMaterial({ color: '#ffaa00' }); 
              const core = new THREE.Mesh(coreGeo, coreMat);
              group.add(core);

              if (yellowGlowTexture) {
                const spriteMat = new THREE.SpriteMaterial({ map: yellowGlowTexture, color: 0xffaa00, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
                const sprite = new THREE.Sprite(spriteMat);
                sprite.scale.set(40, 40, 1); 
                sprite.onBeforeRender = () => { sprite.material.opacity = 0.3 + 0.7 * Math.abs(Math.sin(Date.now() / 500)); };
                group.add(sprite);
              }
            } else if (isHighlighted) {
              const coreGeo = new THREE.SphereGeometry(4, 16, 16);
              const coreMat = new THREE.MeshBasicMaterial({ color: '#ffcc00' }); 
              const core = new THREE.Mesh(coreGeo, coreMat);
              group.add(core);

              if (yellowGlowTexture) {
                const spriteMat = new THREE.SpriteMaterial({ map: yellowGlowTexture, color: 0xffcc00, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
                const sprite = new THREE.Sprite(spriteMat);
                sprite.scale.set(35, 35, 1); group.add(sprite);
              }
            } else {
              const inactiveGeo = new THREE.SphereGeometry(2, 16, 16);
              let inactiveOpacity = (hasActiveNodes || highlightedBook || selectedNode) ? 0.2 : 0.6;
              if (isHeatmapActive) inactiveOpacity = 0.05; 
              
              const inactiveMat = new THREE.MeshLambertMaterial({ color: '#cbd5e1', transparent: true, opacity: inactiveOpacity });
              const inactiveMesh = new THREE.Mesh(inactiveGeo, inactiveMat);
              group.add(inactiveMesh);
            }

            return group;
          }}

          linkColor={(link: any) => {
            if (link.isSemantic) return 'rgba(139, 92, 246, 0.4)'; // Faint Purple for ghost links
            if (link.isStaticReference) return 'rgba(255, 215, 0, 0.15)'; 
            if (link.isDynamic) return 'rgba(0, 255, 255, 0.9)';
            
            const sourceBook = getBookName(link.source);
            const targetBook = getBookName(link.target);

            if (isHeatmapActive) return 'rgba(0,0,0,0)';

            if (highlightedBook && sourceBook.toLowerCase() === highlightedBook.toLowerCase() && targetBook.toLowerCase() === highlightedBook.toLowerCase()) {
               return 'rgba(255, 204, 0, 0.8)';
            }
            const isSourceActive = activeChapterIds.includes(link.source?.id || link.source);
            const isTargetActive = activeChapterIds.includes(link.target?.id || link.target);
            if (isSourceActive && isTargetActive) return 'rgba(0, 255, 255, 0.4)';
            
            return (hasActiveNodes || highlightedBook) ? 'rgba(55, 65, 81, 0.1)' : 'rgba(55, 65, 81, 0.4)';
          }}
          
          linkWidth={(link: any) => {
            if (isHeatmapActive) return 0; 
            if (link.isSemantic) return 0.5; // Thin ghost links
            if (link.isStaticReference) return 0.5;
            if (link.isDynamic) return 1.5;
            const sourceBook = getBookName(link.source);
            const targetBook = getBookName(link.target);
            if (highlightedBook && sourceBook.toLowerCase() === highlightedBook.toLowerCase() && targetBook.toLowerCase() === highlightedBook.toLowerCase()) return 1.5; 
            return 0.3;
          }}

          linkDirectionalParticles={(link: any) => (!isHeatmapActive && link.isStaticReference) ? 3 : 0}
          linkDirectionalParticleWidth={(link: any) => link.isStaticReference ? 2 : 0}
          linkDirectionalParticleColor={() => 'rgba(255, 215, 0, 0.8)'}
          linkDirectionalParticleSpeed={0.005}
          
          linkOpacity={0.8}
          enableNodeDrag={true}
          enableNavigationControls={true}
          showNavInfo={false}
          backgroundColor="#000000"
          onNodeClick={handleNodeClick}
        />
      )}

      {selectedNode && (
        <div className="absolute bottom-10 left-10 w-[450px] bg-gray-900 border border-cyan-500/50 rounded-lg p-5 shadow-[0_0_15px_rgba(0,255,255,0.2)] z-50 transition-all duration-300">
          
          <button onClick={() => { 
            setSelectedNode(null); 
            window.speechSynthesis?.cancel(); 
            setPlayingAudioId(null); 
            resetCamera(); 
          }} className="absolute top-2 right-3 text-gray-400 hover:text-white">✕</button>
          
          <div className="flex justify-between items-start mb-1 pr-6">
            <h3 className="text-xl font-bold text-cyan-400 uppercase tracking-widest">{selectedNode.id}</h3>
            
            <div className="flex gap-2">
                {/* NEW: The Semantic Scan Button */}
                <button 
                  onClick={handleScanSiblings} 
                  disabled={isScanningSemantic}
                  className="text-[9px] uppercase font-bold tracking-wider px-2 py-1 rounded border border-purple-500 bg-purple-900/20 text-purple-400 hover:bg-purple-900/40 hover:text-purple-300 transition-all shadow-[0_0_10px_rgba(139,92,246,0.2)] disabled:opacity-50"
                >
                  {isScanningSemantic ? 'SCANNING...' : 'SCAN THEMATIC SIBLINGS'}
                </button>

                <button onClick={() => setAudioRate(prev => prev === 1 ? 0.5 : (prev === 0.5 ? 0.25 : 1))} className={`text-[9px] font-bold tracking-wider px-2 py-1 rounded border transition-all ${audioRate < 1 ? 'bg-yellow-500/20 border-yellow-500 text-yellow-500' : 'bg-gray-800 border-gray-600 text-gray-400 hover:text-white'}`}>SPEED: {audioRate}x</button>
            </div>
          </div>

          <p className="text-xs text-gray-500 uppercase mb-4 border-b border-gray-700 pb-2 flex justify-between items-center">
            <span>Class: {selectedNode.book || "Manuscript"}</span>
            <span className="text-[9px] text-gray-600 bg-gray-800 px-1.5 py-0.5 rounded border border-gray-700">Use ⬅ ➡ Arrows to Navigate</span>
          </p>
          
          <div className="text-sm text-gray-300 leading-relaxed max-h-96 overflow-y-auto pr-2 custom-scrollbar">
            {isFetchingText ? (
              <div className="flex flex-col items-center justify-center py-10 space-y-3">
                <div className="w-5 h-5 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
                <div className="text-cyan-500 text-[10px] uppercase tracking-widest animate-pulse">Extracting records from archives...</div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-[10px] text-cyan-600 italic mb-2">💡 Click on any phrase below to hear it spoken aloud.</p>
                
                {(() => {
                  const activeCitations = normalizedActiveNodes.filter(n => `${n.book} ${n.chapter}` === selectedNode.id);
                  const hasAncientLanguages = activeCitations.length > 0 && activeCitations.some(c => c.languages);
                  
                  return (
                    <>
                      {hasAncientLanguages && activeCitations.map((citation, idx) => (
                        <div key={`ancient-${idx}`} className="space-y-3 bg-gray-800/50 p-3 rounded border border-gray-700/50 mb-4">
                          <div className="text-cyan-400 text-xs font-mono font-bold border-b border-gray-700 pb-1">Targeted Citation: {citation.verses ? `Verses ${citation.verses}` : `Chapter ${citation.chapter}`}</div>
                          
                          {citation.languages?.hebrew_masoretic && citation.languages.hebrew_masoretic !== "null" && (
                            <div className="space-y-1">
                              <div className="flex justify-between items-center">
                                <span className="text-[9px] uppercase tracking-widest text-gray-500">Hebrew (MT)</span>
                                {renderAudioButton(citation.languages.hebrew_masoretic, 'he-IL', `he-full-${idx}`)}
                              </div>
                              <div className="text-gray-300 font-serif text-right text-base leading-relaxed" dir="rtl">
                                {renderInteractiveClauses(citation.languages.hebrew_masoretic, 'he-IL', `he-${idx}`)}
                              </div>
                            </div>
                          )}
                          
                          {citation.languages?.aramaic && citation.languages.aramaic !== "null" && (
                            <div className="space-y-1">
                              <div className="flex justify-between items-center">
                                <span className="text-[9px] uppercase tracking-widest text-gray-500">Aramaic</span>
                                {renderAudioButton(citation.languages.aramaic, 'he-IL', `ar-full-${idx}`)}
                              </div>
                              <div className="text-gray-300 font-serif text-right text-base leading-relaxed" dir="rtl">
                                {renderInteractiveClauses(citation.languages.aramaic, 'he-IL', `ar-${idx}`)}
                              </div>
                            </div>
                          )}
                          
                          {citation.languages?.greek_manuscript && citation.languages.greek_manuscript !== "null" && (
                            <div className="space-y-1">
                              <div className="flex justify-between items-center">
                                <span className="text-[9px] uppercase tracking-widest text-gray-500">Greek (LXX/NT)</span>
                                {renderAudioButton(citation.languages.greek_manuscript, 'el-GR', `gr-full-${idx}`)}
                              </div>
                              <div className="text-gray-300 font-serif leading-relaxed">
                                {renderInteractiveClauses(citation.languages.greek_manuscript, 'el-GR', `gr-${idx}`)}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}

                      {nodeText ? (
                        <div className="bg-gray-800/50 p-3 rounded border border-gray-700/50">
                          <div className="flex justify-between items-center mb-2 border-b border-gray-700 pb-2">
                            <span className="text-[10px] uppercase tracking-widest text-cyan-700">English Manuscript Source</span>
                            {renderAudioButton(nodeText, 'en-US', `en-full-${selectedNode.id}`)}
                          </div>
                          <div className="italic text-gray-200 text-sm leading-relaxed">
                            "{renderInteractiveClauses(nodeText, 'en-US', `en-${selectedNode.id}`)}"
                          </div>
                        </div>
                      ) : (
                        <div className="text-gray-500 italic flex flex-col gap-2">
                          <span>The archive contains no legible English text for this coordinate.</span>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}