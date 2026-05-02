import {
  ReactFlow,
  Background,
  Controls,
  MarkerType,
  type ColorMode,
  type Viewport,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import { useFlow } from "../hooks/useFlow";
import { useAwareness, useYjsProvider } from "../features/collaboration";
import {
  buildDownloadFileName,
  detectImportFormat,
  downloadTextFile,
  exportGraph,
  getFormatById,
  importGraph,
  listExportFormats,
  type FormatId,
} from "../features/export";
import { useToastState } from "../features/editor/hooks/useToastState";
import { useCursorLayer } from "../features/editor/hooks/useCursorLayer";
import { useEditorRoomAccess } from "../features/editor/hooks/useEditorRoomAccess";
import { useEditorAuthActions } from "../features/editor/hooks/useEditorAuthActions";
import RemoteCursorsLayer from "../features/editor/components/RemoteCursorsLayer";
import { useAuth } from "../auth/AuthContext";
import ThemePanel from "../components/panels/ThemePanel";
import ActionsPanel from "../components/panels/ActionsPanel";
import EditorHeader from "../components/panels/EditorHeader";
import InputPrompt from "../components/panels/inputPrompt";
import SignInToSavePrompt from "../components/panels/signInToSavePrompt";
import ToastPopup from "../components/panels/toastPopup";
import { nodeTypes, edgeTypes } from "../flow-config";
import "./EditorPage.css";

type RoomRouteState = {
  roomName?: string;
};

const FULL_SCREEN_EDITOR_STYLE = {
  width: "100vw",
  height: "100vh",
  position: "relative",
} as const;

const FULL_SCREEN_CENTER_STYLE = {
  width: "100vw",
  height: "100vh",
  display: "grid",
  placeItems: "center",
} as const;

function validateRoomName(value: string) {
  if (!value.trim()) return "Room name cannot be empty.";
  if (value.trim().length < 2)
    return "Room name must be at least 2 characters.";
  if (value.trim().length > 60)
    return "Room name must be 60 characters or less.";
  return null;
}

export default function EditorPage() {
  // Routing + page-level UI state.
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [colorMode, setColorMode] = useState<ColorMode>(() => {
    const savedColorMode = localStorage.getItem("tpn-color-mode");
    if (savedColorMode === "dark" || savedColorMode === "light" || savedColorMode === "system") {
      return savedColorMode;
    }
    return "system";
  });

  // Cross-cutting UI feedback state.
  const { toast, notify, closeToast } = useToastState();
  const [isSavePromptOpen, setIsSavePromptOpen] = useState(false);

  // Root editor element used for pointer-to-canvas projection.
  const editorRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<Viewport>({ x: 0, y: 0, zoom: 1 });

  // Auth session and identity used in header and awareness labels.
  const {
    user,
    backendUser,
    isAuthenticated,
    authLoading,
    signInWithGoogle,
    signOutUser,
  } = useAuth();
  const authDisplayName =
    backendUser?.displayName || user?.displayName || user?.email || null;
  const awarenessIdentity = useMemo(() => {
    if (!authDisplayName) return null;
    return {
      id: backendUser?.id || user?.uid || user?.email || authDisplayName,
      name: authDisplayName,
    };
  }, [authDisplayName, backendUser?.id, user?.uid, user?.email]);

  const routeRoomName = (location.state as RoomRouteState | null)?.roomName;

  useEffect(() => {
    const rootElement = document.documentElement;
    const applyThemeClass = () => {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const shouldUseDark = colorMode === "dark" || (colorMode === "system" && prefersDark);
      rootElement.classList.toggle("dark-theme", shouldUseDark);
    };

    applyThemeClass();

    if (colorMode !== "system") {
      localStorage.setItem("tpn-color-mode", colorMode);
      return undefined;
    }

    localStorage.setItem("tpn-color-mode", "system");
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      applyThemeClass();
    };
    mediaQuery.addEventListener("change", handleChange);
    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, [colorMode]);

  const handleJoinErrorRedirect = useCallback(
    (message: string) => {
      navigate("/", {
        replace: true,
        state: { joinError: message },
      });
    },
    [navigate],
  );

  // Room guard + metadata hydration + rename behavior.
  const { activeRoomId, roomName, isRoomAllowed, isCheckingRoom, renameRoom } =
    useEditorRoomAccess({
      roomId,
      routeRoomName,
      onJoinErrorRedirect: handleJoinErrorRedirect,
    });

  // Yjs document/provider lifecycle for the active room.
  const { ydoc, provider } = useYjsProvider(activeRoomId, isRoomAllowed);

  // Awareness channel for remote cursors and user presence identity.
  const { remoteUsers, updateLocalCursor, clearLocalCursor } = useAwareness(
    activeRoomId,
    provider,
    awarenessIdentity,
  );

  // Sign-in prompt + ownership-claim actions for guest-created rooms.
  const {
    isSignInPromptOpen,
    isAuthActionLoading,
    dismissSignInPrompt,
    login,
    logout,
  } = useEditorAuthActions({
    activeRoomId,
    isRoomAllowed,
    isCheckingRoom,
    isAuthenticated,
    signInWithGoogle,
    signOutUser,
    notify,
  });

  // Pointer capture and cursor projection between screen-space and flow-space.
  const {
    handleViewportChange,
    onPointerMove,
    onPointerLeave,
    resolveRemoteCursorPosition,
    isRemoteCursorVisible,
  } = useCursorLayer({
    editorRef,
    updateLocalCursor,
    clearLocalCursor,
  });

  const onViewportChange = useCallback(
    (vp: Viewport) => {
      handleViewportChange(vp);
      viewportRef.current = vp;
    },
    [handleViewportChange],
  );

  // React Flow state/actions synchronized to Yjs maps.
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
    replaceGraph,
    addToken,
    onNodeDoubleClick,
  } = useFlow(ydoc, () => viewportRef.current);

  const handleOpenSavePrompt = useCallback(() => {
    setIsSavePromptOpen(true);
  }, []);

  const handleCloseSavePrompt = useCallback(() => {
    setIsSavePromptOpen(false);
  }, []);

  const handleConfirmRenamePrompt = useCallback(
    (nextName: string) => {
      void (async () => {
        const result = await renameRoom(nextName);

        if (result === "persisted") {
          setIsSavePromptOpen(false);
          notify("Room renamed.", "success");
          return;
        }

        if (result === "local_only") {
          setIsSavePromptOpen(false);
          notify(
            "Name saved locally only. Owner login is required to persist.",
            "info",
          );
          return;
        }

        notify("Rename failed. Please try again.", "error");
      })();
    },
    [notify, renameRoom],
  );

  const handleLogin = useCallback(() => {
    void login();
  }, [login]);

  const handleLogout = useCallback(() => {
    void logout();
  }, [logout]);

  const exportFormats = useMemo(() => listExportFormats(), []);

  const handleExport = useCallback((formatId: FormatId) => {
    try {
      const serializedGraph = exportGraph(formatId, {
        roomId: activeRoomId,
        roomName,
        nodes,
        edges,
      });
      const format = getFormatById(formatId);
      const fileName = buildDownloadFileName(
        roomName || activeRoomId,
        format.extensions[0] || ".txt",
      );
      const mimeType = format.mimeTypes[0] || "text/plain;charset=utf-8";

      downloadTextFile(serializedGraph, fileName, mimeType);
      notify(`${format.label} exported successfully.`, "success");
    } catch {
      notify(
        "Export failed. Please verify your graph before retrying.",
        "error",
      );
    }
  }, [activeRoomId, roomName, nodes, edges, notify]);

  const handleImport = useCallback(
    async (file: File) => {
      let resolvedFormatId: FormatId | null = null;

      try {
        const content = await file.text();
        resolvedFormatId = detectImportFormat(content, file.name);

        if (!resolvedFormatId) {
          throw new Error("import_format_not_detected");
        }

        const importedGraph = importGraph(content, {
          formatId: "auto",
          fileName: file.name,
        });
        replaceGraph(importedGraph.nodes, importedGraph.edges);
        const format = getFormatById(resolvedFormatId);
        notify(
          `${format.label} imported: ${importedGraph.nodes.length} nodes, ${importedGraph.edges.length} arcs.`,
          "success",
        );
      } catch (error) {
        if (
          error instanceof Error &&
          error.message === "import_format_not_detected"
        ) {
          notify(
            "Import format not detected. Upload PNML (.pnml/.xml) or PPP (.ppp/.spec/.txt).",
            "error",
          );
          return;
        }

        if (resolvedFormatId) {
          const format = getFormatById(resolvedFormatId);
          notify(
            `${format.label} import failed. Please verify file content and retry.`,
            "error",
          );
          return;
        }

        notify("Import failed. Please upload a valid PNML or PPP file.", "error");
      }
    },
    [notify, replaceGraph],
  );

  if (isCheckingRoom || !isRoomAllowed) {
    return (
      <div className="editor-page" style={FULL_SCREEN_CENTER_STYLE}>
        <p>Validating room...</p>
      </div>
    );
  }
  // Render gated editor only after strict room validation succeeds.
  return (
    <div
      ref={editorRef}
      className="editor-page"
      style={FULL_SCREEN_EDITOR_STYLE}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
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
          markerEnd: { type: MarkerType.ArrowClosed },
        }}
        colorMode={colorMode}
        style={{ background: "var(--surface-muted)" }}
        onMove={(_event, nextViewport) => {
          onViewportChange(nextViewport);
        }}
        fitView
      >
        <Background />
        <Controls />
        <EditorHeader
          roomId={activeRoomId}
          roomName={roomName}
          onOpenSavePrompt={handleOpenSavePrompt}
          onNotify={notify}
          exportFormats={exportFormats}
          onExport={handleExport}
          onImportFile={handleImport}
          currentUserName={authDisplayName}
          isAuthenticated={isAuthenticated}
          isAuthLoading={authLoading || isAuthActionLoading}
          onLogin={handleLogin}
          onLogout={handleLogout}
        />
        <ThemePanel colorMode={colorMode} setColorMode={setColorMode} />
        <ActionsPanel
          addPlaces={addPlaces}
          addTransition={addTransition}
          clearCanvas={clearCanvas}
          addToken={addToken}
        />
      </ReactFlow>
      <RemoteCursorsLayer
        remoteUsers={remoteUsers}
        resolveRemoteCursorPosition={resolveRemoteCursorPosition}
        isRemoteCursorVisible={isRemoteCursorVisible}
      />
      <ToastPopup
        open={toast.open}
        message={toast.message}
        type={toast.type}
        durationMs={2600}
        showCloseButton
        onClose={closeToast}
      />
      <InputPrompt
        open={isSavePromptOpen}
        title="Rename room"
        description="Set a display name for this room."
        placeholder="Enter room name"
        defaultValue={roomName}
        confirmLabel="Rename"
        cancelLabel="Cancel"
        validate={validateRoomName}
        onConfirm={handleConfirmRenamePrompt}
        onCancel={handleCloseSavePrompt}
      />
      <SignInToSavePrompt
        open={isSignInPromptOpen}
        onClose={dismissSignInPrompt}
        onSignIn={handleLogin}
      />
    </div>
  );
}
