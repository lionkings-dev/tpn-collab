import {
  ReactFlow,
  Background,
  Controls,
  MarkerType,
  type ColorMode,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useState, useMemo, useRef, useCallback } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import { useFlow } from "../hooks/useFlow";
import { useAwareness, useYjsProvider } from "../features/collaboration";
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
  const [colorMode, setColorMode] = useState<ColorMode>("dark");

  // Cross-cutting UI feedback state.
  const { toast, notify, closeToast } = useToastState();
  const [isSavePromptOpen, setIsSavePromptOpen] = useState(false);

  // Root editor element used for pointer-to-canvas projection.
  const editorRef = useRef<HTMLDivElement | null>(null);

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
    addToken,
    onNodeDoubleClick,
  } = useFlow(ydoc);

  const handleOpenSavePrompt = useCallback(() => {
    setIsSavePromptOpen(true);
  }, []);

  const handleCloseSavePrompt = useCallback(() => {
    setIsSavePromptOpen(false);
  }, []);

  const handleConfirmRenamePrompt = useCallback(
    (nextName: string) => {
      void renameRoom(nextName).finally(() => {
        setIsSavePromptOpen(false);
        notify("Room renamed.", "success");
      });
    },
    [notify, renameRoom],
  );

  const handleLogin = useCallback(() => {
    void login();
  }, [login]);

  const handleLogout = useCallback(() => {
    void logout();
  }, [logout]);

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
        style={{ background: "#ffffff" }}
        onMove={(_event, nextViewport) => {
          handleViewportChange(nextViewport);
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
