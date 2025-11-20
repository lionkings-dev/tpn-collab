import {
  ReactFlow,
  Background,
  Controls,
  MarkerType,
  type ColorMode,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";

import { useFlow } from "../hooks/useFlow";
import ThemePanel from "../components/panels/ThemePanel";
import ActionsPanel from "../components/panels/ActionsPanel";
import EditorHeader from "../components/panels/EditorHeader";
import { nodeTypes, edgeTypes } from "../flow-config";

export default function EditorPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const [colorMode, setColorMode] = useState<ColorMode>("dark");

  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    isValidConnection,
    addPlaces,
    addTransition,
    clearCanvas,
    addToken,
    onNodeDoubleClick,
  } = useFlow();

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(colorMode);
  }, [colorMode]);

  return (
    <div className={`theme-container ${colorMode === 'light' ? 'light-theme' : ''}`} style={{ width: "100vw", height: "100vh" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        isValidConnection={isValidConnection}
        onNodeDoubleClick={onNodeDoubleClick}
        defaultEdgeOptions={{
          className: 'themed-edge',
          markerEnd: { type: MarkerType.ArrowClosed },
        }}
        colorMode={colorMode}
        fitView
      >
        <Background />
        <Controls />
        <EditorHeader />
        <ThemePanel colorMode={colorMode} setColorMode={setColorMode} />
        <ActionsPanel
          addPlaces={addPlaces}
          addTransition={addTransition}
          clearCanvas={clearCanvas}
          addToken={addToken}
        />
      </ReactFlow>
    </div>
  );
}
