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
const purpleGlowTexture = generateGlowTexture(139, 92, 246);
const greenGlowTexture = generateGlowTexture(57, 255, 20); // Satellite Glow

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

export default function StarMap({ 
    activeNodes, 
    activeConnections = [], 
    activeCommentaries = [],
    isChatOpen = false, 
    chatWidth = 450 
}: { 
    activeNodes: any[], 
    activeConnections?: any[], 
    activeCommentaries?: any[],
    isChatOpen?: boolean, 
    chatWidth?: number 
}) {
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
  
  // SEMANTIC MULTI-HOP STATE
  const [semanticLinks, setSemanticLinks] = useState<any[]>([]);
  const [isScanningSemantic, setIsScanningSemantic] = useState(false);

  // MULTI-PANE READING STATE
  const [selectedNodes, setSelectedNodes] = useState<any[]>([]);
  const [nodeTexts, setNodeTexts] = useState<Record<string, string>>({});
  const [loadingTexts, setLoadingTexts] = useState<Record<string, boolean>>({});
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);

  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [audioRate, setAudioRate] = useState<number>(1);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);

  const stableCoordsRef = useRef<Record<string, {x: number, y: number, z: number}>>({});
  const hasCaptured = useRef(false);
  const fgRef = useRef<any>();

  const activeUniverseRef = useRef(activeUniverse);
  useEffect(() => { activeUniverseRef.current = activeUniverse; }, [activeUniverse]);

  const activeChapterIds = useMemo(() => normalizedActiveNodes.map(node => `${node.book} ${node.chapter}`), [normalizedActiveNodes]);
  const hasActiveNodes = normalizedActiveNodes.length > 0;
  const isHeatmapActive = Object.keys(heatmapScores).length > 0;

  // DERIVED STATE: Automatically pulls valid ghost nodes from valid links
  const semanticIds = useMemo(() => {
    return Array.from(new Set(semanticLinks.map(l => l.target?.id || l.target)));
  }, [semanticLinks]);

  // CLEARS MAP WHEN ORACLE GENERATES A NEW CONSTELLATION
  useEffect(() => {
    setSemanticLinks([]);
  }, [activeNodes]);

  // CLEARS ORPHANED GHOST NODES WHEN A WINDOW IS CLOSED
  useEffect(() => {
    setSemanticLinks(prev => {
      const activeSelectedIds = selectedNodes.map(n => n.id);
      return prev.filter(l => activeSelectedIds.includes(l.source?.id || l.source));
    });
  }, [selectedNodes]);

  // MULTI-HOP API CALL 
  const handleScanSiblings = async (chapterId: string) => {
    setIsScanningSemantic(true);
    try {
      const res = await fetch('/api/semantic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chapterId })
      });
      const data = await res.json();
      
      setSemanticLinks(prev => {
        const existing = new Set(prev.map(l => `${l.source?.id || l.source}-${l.target?.id || l.target}`));
        const toAdd = data.connections.filter((c: any) => !existing.has(`${c.source}-${c.target}`));
        return [...prev, ...toAdd];
      });
    } catch (err) {
       console.error("Semantic Scan failed:", err);
    } finally {
       setIsScanningSemantic(false);
    }
  };

  // MULTI-FETCH EFFECT
  useEffect(() => {
    selectedNodes.forEach(node => {
      if (!node.isCommentary && !nodeTexts[node.id] && !loadingTexts[node.id]) {
        setLoadingTexts(prev => ({ ...prev, [node.id]: true }));
        fetch('/api/manuscript', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chapterId: node.id })
        })
        .then(res => res.json())
        .then(data => setNodeTexts(prev => ({ ...prev, [node.id]: data.text || "No manuscript data found." })))
        .catch(() => setNodeTexts(prev => ({ ...prev, [node.id]: "Error establishing connection to archives." })))
        .finally(() => setLoadingTexts(prev => ({ ...prev, [node.id]: false })));
      }
    });
  }, [selectedNodes]);

  const handleThemeSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!themeQuery.trim()) return;
    
    setIsSearchingTheme(true);
    setHighlightedBook(''); 
    setLocatorQuery('');
    setSelectedNodes([]); 
    
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

  // MULTI-SELECT KEYBOARD NAVIGATION
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT') return;
      if (selectedNodes.length === 0) return;
      
      const lastNode = selectedNodes[selectedNodes.length - 1];
      if (lastNode.isCommentary) return; 
      
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        const targetChapter = e.key === 'ArrowRight' ? lastNode.chapter + 1 : lastNode.chapter - 1;
        const targetNode = activeUniverseRef.current.nodes.find((n: any) => n.id === `${lastNode.book} ${targetChapter}`);
        if (targetNode) { 
            e.preventDefault(); 
            setSelectedNodes(prev => [...prev.filter(n => n.id !== lastNode.id), targetNode]);
            const distance = 120; 
            const distRatio = 1 + distance / Math.hypot(targetNode.x, targetNode.y, targetNode.z);
            if (fgRef.current) fgRef.current.cameraPosition({ x: targetNode.x * distRatio, y: targetNode.y * distRatio, z: targetNode.z * distRatio }, targetNode, 2000);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodes]);

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
  }, [selectedNodes]);

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

  // CORE GALAXY BUILDER
  useEffect(() => {
    if (!baseUniverse.nodes.length) return;
    
    // 1. Map base primary nodes
    const newUniverseNodes = baseUniverse.nodes.map((n: any) => {
         const cloned = { ...n };
         const isNodeActive = activeChapterIds.includes(cloned.id) || semanticIds.includes(cloned.id);
         
         const shouldLock = !isDynamicLayout || !isNodeActive;
         if (shouldLock && stableCoordsRef.current[cloned.id]) {
            cloned.fx = stableCoordsRef.current[cloned.id].x;
            cloned.fy = stableCoordsRef.current[cloned.id].y;
            cloned.fz = stableCoordsRef.current[cloned.id].z;
         } else {
            cloned.fx = undefined; cloned.fy = undefined; cloned.fz = undefined;
         }
         return cloned;
    });

    const newUniverseLinks = baseUniverse.links.map((link: any) => ({
        ...link,
        source: typeof link.source === 'object' ? link.source.id : link.source,
        target: typeof link.target === 'object' ? link.target.id : link.target
    }));

    // 2. Inject Connections generated by the AI Oracle
    if (activeConnections && activeConnections.length > 0) {
      const validLinks = activeConnections.filter(link => {
        return activeChapterIds.includes(link.source) && activeChapterIds.includes(link.target);
      }).map(link => ({ source: link.source, target: link.target, isDynamic: true }));
      newUniverseLinks.push(...validLinks);
    }

    // 3. Inject Cross References based on selection
    selectedNodes.forEach(sn => {
      if (crossRefDatabase[sn.id]) {
        crossRefDatabase[sn.id].forEach(targetId => {
          if (baseUniverse.nodes.some((n:any) => n.id === targetId)) {
            newUniverseLinks.push({ source: sn.id, target: targetId, isStaticReference: true });
          }
        });
      }
    });

    // 4. Inject Semantic Connections
    if (semanticLinks && semanticLinks.length > 0) {
        const validSemanticLinks = semanticLinks.filter(link => {
            return baseUniverse.nodes.some((n: any) => n.id === (link.source.id || link.source)) && 
                   baseUniverse.nodes.some((n: any) => n.id === (link.target.id || link.target));
        });
        newUniverseLinks.push(...validSemanticLinks);
    }

    // 5. Inject Commentary Satellite Nodes and their Tethers
    activeCommentaries.forEach(comm => {
      const normalizedTargetId = comm.targetNodeId.trim().toLowerCase();
      const hostNode = baseUniverse.nodes.find((n: any) => n.id.toLowerCase() === normalizedTargetId);

      if (hostNode) {
        // PREVENT PANIC: Check if this satellite is already in the universe with established coordinates
        const existingSat = activeUniverseRef.current.nodes.find((n: any) => n.id === comm.id) as any;
        
        let startX = 0; let startY = 0; let startZ = 0;
        
        if (existingSat && existingSat.x !== undefined) {
            // Keep its current position so it doesn't jump
            startX = existingSat.x;
            startY = existingSat.y;
            startZ = existingSat.z;
        } else if (stableCoordsRef.current[hostNode.id]) {
            // Only apply the random offset if it's spawning for the very first time
            startX = stableCoordsRef.current[hostNode.id].x + (Math.random() * 10 - 5);
            startY = stableCoordsRef.current[hostNode.id].y + (Math.random() * 10 - 5);
            startZ = stableCoordsRef.current[hostNode.id].z + (Math.random() * 10 - 5);
        }

        newUniverseNodes.push({
          id: comm.id,
          isCommentary: true,
          author: comm.author,
          era: comm.era,
          excerpt: comm.excerpt,
          targetNodeId: hostNode.id,
          x: startX, y: startY, z: startZ 
        });

        newUniverseLinks.push({ source: comm.id, target: hostNode.id, isSatelliteLink: true });
      }
    });

    setActiveUniverse({ nodes: newUniverseNodes as any, links: newUniverseLinks as any });
    
    // Adjust Physics Engine params
    setTimeout(() => {
      if (fgRef.current) {
        const linkForce = fgRef.current.d3Force('link');
        if (linkForce) {
          linkForce.distance((link: any) => {
            if (link.isSatelliteLink) return 25; // Pull satellites very close
            return link.isDynamic ? 60 : 30;
          });
          linkForce.strength((link: any) => {
            if (link.isSatelliteLink) return 1.2; // High strength to keep orbit tight
            if (link.isSemantic) return 0; 
            if (link.isStaticReference) return 0; 
            if (!isDynamicLayout) return link.isDynamic ? 0 : 0.4; 
            return link.isDynamic ? 0.8 : 0.4;
          });
        }
      }
    }, 50);
  }, [JSON.stringify(activeConnections), JSON.stringify(activeChapterIds), JSON.stringify(activeCommentaries), baseUniverse, isDynamicLayout, selectedNodes, crossRefDatabase, semanticIds, semanticLinks]); 

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

  // MULTI-SELECT CLICK HANDLER
  const handleNodeClick = useCallback((node: any, event?: any) => {
    if (node.x === undefined || node.y === undefined || node.z === undefined) return;
    
    const distance = 120; 
    const distRatio = 1 + distance / Math.hypot(node.x, node.y, node.z);
    if (fgRef.current) fgRef.current.cameraPosition({ x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio }, node, 2000);
    
    setSelectedNodes(prev => {
      const isMulti = (event && (event.ctrlKey || event.metaKey)) || isMultiSelectMode;
  
      if (isMulti) {
        if (prev.find(n => n.id === node.id)) return prev;
        if (prev.length >= 4) {
           return [...prev.slice(1), node];
        }
        return [...prev, node];
      } else {
        return [node];
      }
    });
  }, [isMultiSelectMode]);

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

          <button 
            onClick={() => setIsMultiSelectMode(!isMultiSelectMode)}
            className={`text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded border transition-all duration-300 shadow-md ${
              isMultiSelectMode 
                ? 'bg-purple-900/50 border-purple-500 text-purple-300 shadow-[0_0_10px_rgba(139,92,246,0.3)]' 
                : 'border-gray-600 bg-gray-800 text-gray-400 hover:text-white hover:border-gray-400'
            }`}
          >
            {isMultiSelectMode ? 'Multi-Select : ON' : 'Multi-Select : OFF'}
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
              setSelectedNodes([]);
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
                        setSelectedNodes([]);
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
            const isSelected = selectedNodes.some(n => n.id === node.id);
            const isSemanticTarget = semanticIds.includes(node.id) && !activeChapterIds.includes(node.id);
            const isCommentary = node.isCommentary;
            
            let isTarget = false;
            selectedNodes.forEach(sn => {
              if (crossRefDatabase[sn.id] && crossRefDatabase[sn.id].includes(node.id)) {
                isTarget = true;
              }
            });

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
            } else if (isCommentary) {
              const coreGeo = new THREE.SphereGeometry(2.5, 16, 16); 
              const coreMat = new THREE.MeshBasicMaterial({ color: '#39ff14' });
              const core = new THREE.Mesh(coreGeo, coreMat);
              group.add(core);

              if (greenGlowTexture) {
                const spriteMat = new THREE.SpriteMaterial({ map: greenGlowTexture, color: 0x39ff14, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
                const sprite = new THREE.Sprite(spriteMat);
                sprite.scale.set(22, 22, 1); group.add(sprite);
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
              let inactiveOpacity = (hasActiveNodes || highlightedBook || selectedNodes.length > 0) ? 0.2 : 0.6;
              if (isHeatmapActive) inactiveOpacity = 0.05; 
              
              const inactiveMat = new THREE.MeshLambertMaterial({ color: '#cbd5e1', transparent: true, opacity: inactiveOpacity });
              const inactiveMesh = new THREE.Mesh(inactiveGeo, inactiveMat);
              group.add(inactiveMesh);
            }

            return group;
          }}

          linkColor={(link: any) => {
            if (link.isSatelliteLink) return 'rgba(57, 255, 20, 0.4)'; // Faint green tether
            if (link.isSemantic) return 'rgba(139, 92, 246, 0.4)'; 
            if (link.isStaticReference) return 'rgba(255, 215, 0, 0.15)'; 
            
            // FIX: Enforce active check for dynamic lines to prevent blank terminuses
            if (link.isDynamic) {
                const isSourceActive = activeChapterIds.includes(link.source?.id || link.source);
                const isTargetActive = activeChapterIds.includes(link.target?.id || link.target);
                if (isSourceActive && isTargetActive) {
                    return 'rgba(0, 255, 255, 0.9)';
                }
                return 'rgba(0, 255, 255, 0.0)'; 
            }
            
            const sourceBook = getBookName(link.source);
            const targetBook = getBookName(link.target);

            if (isHeatmapActive) return 'rgba(0,0,0,0)';

            if (highlightedBook && sourceBook.toLowerCase() === highlightedBook.toLowerCase() && targetBook.toLowerCase() === highlightedBook.toLowerCase()) {
               return 'rgba(255, 204, 0, 0.8)';
            }
            
            return (hasActiveNodes || highlightedBook) ? 'rgba(55, 65, 81, 0.1)' : 'rgba(55, 65, 81, 0.4)';
          }}
          
          linkWidth={(link: any) => {
            if (isHeatmapActive) return 0; 
            if (link.isSatelliteLink) return 0.5; 
            if (link.isSemantic) return 0.5; 
            if (link.isStaticReference) return 0.5;
            if (link.isDynamic) return 1.5;
            const sourceBook = getBookName(link.source);
            const targetBook = getBookName(link.target);
            if (highlightedBook && sourceBook.toLowerCase() === highlightedBook.toLowerCase() && targetBook.toLowerCase() === highlightedBook.toLowerCase()) return 1.5; 
            return 0.3;
          }}

          linkDirectionalParticles={(link: any) => {
             if (link.isSatelliteLink) return 1;
             return (!isHeatmapActive && link.isStaticReference) ? 3 : 0;
          }}
          linkDirectionalParticleWidth={(link: any) => link.isStaticReference || link.isSatelliteLink ? 2 : 0}
          linkDirectionalParticleColor={(link: any) => link.isSatelliteLink ? 'rgba(57, 255, 20, 0.6)' : 'rgba(255, 215, 0, 0.8)'}
          linkDirectionalParticleSpeed={0.005}
          
          linkOpacity={0.8}
          enableNodeDrag={true}
          enableNavigationControls={true}
          showNavInfo={false}
          backgroundColor="#000000"
          onNodeClick={handleNodeClick}
        />
      )}

      {/* NEW MULTI-PANE READING INTERFACE */}
      {selectedNodes.length > 0 && (
        <div 
          className="absolute bottom-10 left-10 flex items-end gap-4 overflow-x-auto overflow-y-hidden custom-scrollbar pb-4 pt-4 px-2 pointer-events-none z-10 transition-all duration-500"
          style={{ right: isChatOpen ? `${chatWidth + 16}px` : '16px' }}
        >
          {selectedNodes.map((node) => {
            
            if (node.isCommentary) {
                return (
                    <div key={node.id} className="relative flex-1 w-full min-w-[150px] max-w-[400px] bg-green-950/80 border border-green-500/50 rounded-lg p-5 shadow-[0_0_20px_rgba(0,0,0,0.8)] pointer-events-auto backdrop-blur-md transition-all duration-300 flex flex-col max-h-[65vh]">
                      <button onClick={() => { 
                        setSelectedNodes(prev => prev.filter(n => n.id !== node.id));
                        if (playingAudioId?.includes(node.id)) {
                          window.speechSynthesis?.cancel(); 
                          setPlayingAudioId(null); 
                        }
                      }} className="absolute top-2 right-3 text-gray-400 hover:text-white hover:text-red-400 transition-colors">✕</button>
                      
                      <div className="flex justify-between items-start mb-1 pr-6 shrink-0">
                        <h3 className="text-xl font-bold text-green-400 tracking-wide">{node.author}</h3>
                      </div>
      
                      <p className="text-[10px] text-green-600/70 uppercase mb-3 border-b border-green-900 pb-2 flex justify-between items-center shrink-0">
                        <span>Class: Historical Satellite</span>
                        <span className="bg-green-900/40 px-1.5 py-0.5 rounded border border-green-800 text-green-400">{node.era}</span>
                      </p>
                      
                      <div className="text-sm text-green-100 leading-relaxed overflow-y-auto pr-2 custom-scrollbar flex-1">
                        <div className="space-y-4 pb-4">
                            <p className="text-[10px] text-green-600 italic mb-2">💡 Orbiting Primary Node: {node.targetNodeId}</p>
                            
                            <div className="bg-green-900/30 p-3 rounded border border-green-800/50">
                                <div className="flex justify-between items-center mb-2 border-b border-green-800/50 pb-2">
                                  <span className="text-[10px] uppercase tracking-widest text-green-500">Scholar Excerpt</span>
                                  {renderAudioButton(node.excerpt, 'en-US', `en-full-${node.id}`)}
                                </div>
                                <div className="italic text-green-200 text-sm leading-relaxed font-serif">
                                  "{renderInteractiveClauses(node.excerpt, 'en-US', `en-${node.id}`)}"
                                </div>
                            </div>
                        </div>
                      </div>
                    </div>
                );
            }

            const activeCitations = normalizedActiveNodes.filter(n => `${n.book} ${n.chapter}` === node.id);
            const hasAncientLanguages = activeCitations.length > 0 && activeCitations.some(c => c.languages);

            return (
              <div key={node.id} className="relative flex-1 w-full min-w-[150px] max-w-[400px] bg-gray-900/95 border border-cyan-500/50 rounded-lg p-5 shadow-[0_0_20px_rgba(0,0,0,0.8)] pointer-events-auto backdrop-blur-md transition-all duration-300 flex flex-col max-h-[65vh]">
                
                <button onClick={() => { 
                  setSelectedNodes(prev => prev.filter(n => n.id !== node.id));
                  if (playingAudioId?.includes(node.id)) {
                    window.speechSynthesis?.cancel(); 
                    setPlayingAudioId(null); 
                  }
                }} className="absolute top-2 right-3 text-gray-400 hover:text-white hover:text-red-400 transition-colors">✕</button>
                
                <div className="flex justify-between items-start mb-1 pr-6 shrink-0">
                  <h3 className="text-xl font-bold text-cyan-400 uppercase tracking-widest">{node.id}</h3>
                  
                  <div className="flex gap-2">
                      <button 
                        onClick={() => handleScanSiblings(node.id)} 
                        disabled={isScanningSemantic}
                        className="text-[8px] uppercase font-bold tracking-wider px-2 py-1 rounded border border-purple-500 bg-purple-900/20 text-purple-400 hover:bg-purple-900/40 hover:text-purple-300 transition-all shadow-[0_0_10px_rgba(139,92,246,0.2)] disabled:opacity-50"
                      >
                        {isScanningSemantic ? 'SCANNING...' : 'SCAN SIBLINGS'}
                      </button>
                      <button onClick={() => setAudioRate(prev => prev === 1 ? 0.5 : (prev === 0.5 ? 0.25 : 1))} className={`text-[8px] font-bold tracking-wider px-2 py-1 rounded border transition-all ${audioRate < 1 ? 'bg-yellow-500/20 border-yellow-500 text-yellow-500' : 'bg-gray-800 border-gray-600 text-gray-400 hover:text-white'}`}>SPEED: {audioRate}x</button>
                  </div>
                </div>

                <p className="text-[10px] text-gray-500 uppercase mb-3 border-b border-gray-700 pb-2 flex justify-between items-center shrink-0">
                  <span>Class: {node.book || "Manuscript"}</span>
                  <span className="text-[8px] text-gray-600 bg-gray-800 px-1.5 py-0.5 rounded border border-gray-700">Use ⬅ ➡ Arrows to Navigate</span>
                </p>
                
                <div className="text-sm text-gray-300 leading-relaxed overflow-y-auto pr-2 custom-scrollbar flex-1">
                  {loadingTexts[node.id] ? (
                    <div className="flex flex-col items-center justify-center py-10 space-y-3">
                      <div className="w-5 h-5 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
                      <div className="text-cyan-500 text-[10px] uppercase tracking-widest animate-pulse">Extracting records from archives...</div>
                    </div>
                  ) : (
                    <div className="space-y-4 pb-4">
                      <p className="text-[10px] text-cyan-600 italic mb-2">💡 Click on any phrase below to hear it spoken aloud.</p>
                      
                      {hasAncientLanguages && activeCitations.map((citation, idx) => (
                        <div key={`ancient-${idx}`} className="space-y-3 bg-gray-800/50 p-3 rounded border border-gray-700/50 mb-4">
                          <div className="text-cyan-400 text-xs font-mono font-bold border-b border-gray-700 pb-1">Targeted Citation: {citation.verses ? `Verses ${citation.verses}` : `Chapter ${citation.chapter}`}</div>
                          
                          {citation.languages?.hebrew_masoretic && citation.languages.hebrew_masoretic !== "null" && (
                            <div className="space-y-1">
                              <div className="flex justify-between items-center">
                                <span className="text-[9px] uppercase tracking-widest text-gray-500">Hebrew (MT)</span>
                                {renderAudioButton(citation.languages.hebrew_masoretic, 'he-IL', `he-full-${idx}-${node.id}`)}
                              </div>
                              <div className="text-gray-300 font-serif text-right text-base leading-relaxed" dir="rtl">
                                {renderInteractiveClauses(citation.languages.hebrew_masoretic, 'he-IL', `he-${idx}-${node.id}`)}
                              </div>
                            </div>
                          )}
                          
                          {citation.languages?.aramaic && citation.languages.aramaic !== "null" && (
                            <div className="space-y-1">
                              <div className="flex justify-between items-center">
                                <span className="text-[9px] uppercase tracking-widest text-gray-500">Aramaic</span>
                                {renderAudioButton(citation.languages.aramaic, 'he-IL', `ar-full-${idx}-${node.id}`)}
                              </div>
                              <div className="text-gray-300 font-serif text-right text-base leading-relaxed" dir="rtl">
                                {renderInteractiveClauses(citation.languages.aramaic, 'he-IL', `ar-${idx}-${node.id}`)}
                              </div>
                            </div>
                          )}
                          
                          {citation.languages?.greek_manuscript && citation.languages.greek_manuscript !== "null" && (
                            <div className="space-y-1">
                              <div className="flex justify-between items-center">
                                <span className="text-[9px] uppercase tracking-widest text-gray-500">Greek (LXX/NT)</span>
                                {renderAudioButton(citation.languages.greek_manuscript, 'el-GR', `gr-full-${idx}-${node.id}`)}
                              </div>
                              <div className="text-gray-300 font-serif leading-relaxed">
                                {renderInteractiveClauses(citation.languages.greek_manuscript, 'el-GR', `gr-${idx}-${node.id}`)}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}

                      {nodeTexts[node.id] ? (
                        <div className="bg-gray-800/50 p-3 rounded border border-gray-700/50">
                          <div className="flex justify-between items-center mb-2 border-b border-gray-700 pb-2">
                            <span className="text-[10px] uppercase tracking-widest text-cyan-700">English Manuscript Source</span>
                            {renderAudioButton(nodeTexts[node.id], 'en-US', `en-full-${node.id}`)}
                          </div>
                          <div className="italic text-gray-200 text-sm leading-relaxed">
                            "{renderInteractiveClauses(nodeTexts[node.id], 'en-US', `en-${node.id}`)}"
                          </div>
                        </div>
                      ) : (
                        <div className="text-gray-500 italic text-xs">
                          <span>The archive contains no legible English text for this coordinate.</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}