import {
  ReactFlow,
  Background,
  Controls,
  MarkerType,
  type ColorMode,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useState, useEffect, useRef, type PointerEvent } from "react";
import { useParams } from "react-router-dom";

import { useFlow } from "../hooks/useFlow";
import { useAwareness, useYjsProvider } from "../yjs";
import ThemePanel from "../components/panels/ThemePanel";
import ActionsPanel from "../components/panels/ActionsPanel";
import EditorHeader from "../components/panels/EditorHeader";
import { nodeTypes, edgeTypes } from "../flow-config";

const CURSOR_THROTTLE_MS = 40;

export default function EditorPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const activeRoomId = roomId || "default-room";
  const [colorMode, setColorMode] = useState<ColorMode>("dark");
  const lastCursorUpdateRef = useRef(0);

  const { ydoc, provider } = useYjsProvider(activeRoomId);
  const { remoteUsers, updateLocalCursor, clearLocalCursor } = useAwareness(
    activeRoomId,
    provider,
  );

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
  } = useFlow(ydoc);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(colorMode);
  }, [colorMode]);

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const now = Date.now();
    if (now - lastCursorUpdateRef.current < CURSOR_THROTTLE_MS) return;

    lastCursorUpdateRef.current = now;
    updateLocalCursor(event.clientX, event.clientY);
  };

  const handlePointerLeave = () => {
    clearLocalCursor();
  };

  return (
    <div
      className={`theme-container ${colorMode === "light" ? "light-theme" : ""}`}
      style={{ width: "100vw", height: "100vh", position: "relative" }}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
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
          className: "themed-edge",
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
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          zIndex: 20,
        }}
      >
        {remoteUsers.map((remoteUser) => {
          if (!remoteUser.cursor) return null;

          return (
            <div
              key={remoteUser.clientId}
              style={{
                position: "absolute",
                transform: `translate(${remoteUser.cursor.x}px, ${remoteUser.cursor.y}px)`,
                display: "flex",
                alignItems: "center",
                gap: "0.35rem",
              }}
            >
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 999,
                  backgroundColor: remoteUser.user.color,
                  boxShadow: "0 0 0 2px rgba(0, 0, 0, 0.35)",
                }}
              />
              <span
                style={{
                  padding: "0.1rem 0.4rem",
                  borderRadius: 6,
                  background: "rgba(10, 10, 10, 0.8)",
                  color: "#fff",
                  fontSize: 12,
                  lineHeight: 1.2,
                  whiteSpace: "nowrap",
                }}
              >
                {remoteUser.user.name}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
