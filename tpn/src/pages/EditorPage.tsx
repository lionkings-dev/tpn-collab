import {
  ReactFlow,
  Background,
  Controls,
  MarkerType,
  type ColorMode,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useState, useEffect, useMemo, useRef, type PointerEvent } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import { useFlow } from "../hooks/useFlow";
import { useAwareness, useYjsProvider } from "../yjs";
import ThemePanel from "../components/panels/ThemePanel";
import ActionsPanel from "../components/panels/ActionsPanel";
import EditorHeader from "../components/panels/EditorHeader";
import { nodeTypes, edgeTypes } from "../flow-config";
import {
  checkRoomExists,
  generateRoomName,
  isValidRoomId,
} from "../utils/roomRouting";

const CURSOR_THROTTLE_MS = 40;
const ROOM_META_PREFIX = "room-meta:";

type RoomRouteState = {
  roomName?: string;
};

export default function EditorPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const activeRoomId = roomId || "default-room";
  const [colorMode, setColorMode] = useState<ColorMode>("dark");
  const [isRoomAllowed, setIsRoomAllowed] = useState(false);
  const [isCheckingRoom, setIsCheckingRoom] = useState(true);
  const lastCursorUpdateRef = useRef(0);

  const routeRoomName = (location.state as RoomRouteState | null)?.roomName;
  const initialRoomName = useMemo(() => {
    const stored = localStorage.getItem(`${ROOM_META_PREFIX}${activeRoomId}`);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as { name?: string };
        if (parsed.name && parsed.name.trim()) return parsed.name;
      } catch {
        // Ignore malformed local storage
      }
    }

    if (routeRoomName && routeRoomName.trim()) {
      return routeRoomName.trim();
    }

    return generateRoomName(activeRoomId);
  }, [activeRoomId, routeRoomName]);
  const [roomName, setRoomName] = useState(initialRoomName);

  const { ydoc, provider } = useYjsProvider(activeRoomId, isRoomAllowed);
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

  useEffect(() => {
    let cancelled = false;

    const verifyRoom = async () => {
      if (!roomId || !isValidRoomId(roomId)) {
        navigate("/", {
          replace: true,
          state: { joinError: "Invalid room ID." },
        });
        return;
      }

      setIsCheckingRoom(true);

      try {
        const exists = await checkRoomExists(roomId);
        if (cancelled) return;

        if (!exists) {
          navigate("/", {
            replace: true,
            state: {
              joinError: "Room not found. Create a room from landing page.",
            },
          });
          return;
        }

        setIsRoomAllowed(true);
      } catch {
        if (cancelled) return;
        navigate("/", {
          replace: true,
          state: { joinError: "Could not verify room. Please try again." },
        });
      } finally {
        if (!cancelled) {
          setIsCheckingRoom(false);
        }
      }
    };

    setIsRoomAllowed(false);
    void verifyRoom();

    return () => {
      cancelled = true;
    };
  }, [roomId, navigate]);

  useEffect(() => {
    setRoomName(initialRoomName);
  }, [initialRoomName]);

  const handleSaveRoom = (nextName: string) => {
    setRoomName(nextName);
    localStorage.setItem(
      `${ROOM_META_PREFIX}${activeRoomId}`,
      JSON.stringify({
        name: nextName,
        updatedAt: Date.now(),
      }),
    );
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const now = Date.now();
    if (now - lastCursorUpdateRef.current < CURSOR_THROTTLE_MS) return;

    lastCursorUpdateRef.current = now;
    updateLocalCursor(event.clientX, event.clientY);
  };

  const handlePointerLeave = () => {
    clearLocalCursor();
  };

  if (isCheckingRoom || !isRoomAllowed) {
    return (
      <div
        className={`theme-container ${colorMode === "light" ? "light-theme" : ""}`}
        style={{ width: "100vw", height: "100vh", display: "grid", placeItems: "center" }}
      >
        <p>Validating room...</p>
      </div>
    );
  }

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
        <EditorHeader
          roomId={activeRoomId}
          roomName={roomName}
          onSaveRoom={handleSaveRoom}
        />
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
