'use client';

import { useEffect, useState, useRef } from 'react';
import dynamic from 'next/dynamic';

// We dynamically import this so it only runs in the browser, not the server.
// 3D engines need access to the browser's 'window' object to render.
const ForceGraph3D = dynamic(() => import('react-force-graph-3d'), { ssr: false });

export default function CosmicGraph() {
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const graphRef = useRef<any>(null);

  useEffect(() => {
    // Fetch the brain data when the component loads
    fetch('/api/graph')
      .then((res) => res.json())
      .then((data) => {
        setGraphData(data);
      })
      .catch((err) => console.error("Error loading graph:", err));
  }, []);

  return (
    <ForceGraph3D
      ref={graphRef}
      graphData={graphData}
      nodeId="id" // Explicitly tell it how to identify stars
      nodeLabel={(node: any) => node.text || "Translating..."} // Fix the hover text
      nodeColor={() => '#a855f7'} 
      linkColor={() => 'rgba(34, 211, 238, 0.4)'} // Increased opacity to make lines visible
      backgroundColor="#000000" 
      nodeRelSize={4}
      linkWidth={0.5} // Made lines slightly thicker
      d3VelocityDecay={0.3}
      onEngineStop={() => {
        if (graphRef.current) {
            graphRef.current.zoomToFit(400);
        }
      }}
    />
  );
}