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
import { useAwareness, useYjsProvider } from "../features/collaboration";
import { useAuth } from "../auth/AuthContext";
import { firebaseAuth } from "../lib/firebase";
import ThemePanel from "../components/panels/ThemePanel";
import ActionsPanel from "../components/panels/ActionsPanel";
import EditorHeader from "../components/panels/EditorHeader";
import InputPrompt from "../components/panels/inputPrompt";
import SignInToSavePrompt from "../components/panels/signInToSavePrompt";
import ToastPopup, { type ToastType } from "../components/panels/toastPopup";
import { nodeTypes, edgeTypes } from "../flow-config";
import {
  checkRoomExists,
  claimRoomOwnership,
  clearRoomClaimToken,
  getRoomById,
  getRoomClaimToken,
  generateRoomName,
  isValidRoomId,
  renameOwnedRoom,
} from "../features/rooms";

const CURSOR_THROTTLE_MS = 40;
const ROOM_META_PREFIX = "room-meta:";
const SIGNIN_PROMPT_DISMISS_PREFIX = "room-signin-prompt-dismissed:";

type RoomRouteState = {
  roomName?: string;
};

type ToastState = {
  open: boolean;
  message: string;
  type: ToastType;
};

export default function EditorPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const activeRoomId = roomId || "default-room";
  const [colorMode, setColorMode] = useState<ColorMode>("dark");
  const [isRoomAllowed, setIsRoomAllowed] = useState(false);
  const [isCheckingRoom, setIsCheckingRoom] = useState(true);
  const [toast, setToast] = useState<ToastState>({
    open: false,
    message: "",
    type: "info",
  });
  const [isSavePromptOpen, setIsSavePromptOpen] = useState(false);
  const [isSignInPromptOpen, setIsSignInPromptOpen] = useState(false);
  const [isAuthActionLoading, setIsAuthActionLoading] = useState(false);
  const lastCursorUpdateRef = useRef(0);
  const { user, backendUser, isAuthenticated, authLoading, signInWithGoogle, signOutUser } =
    useAuth();
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
    awarenessIdentity,
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

        try {
          const room = await getRoomById(roomId);
          if (cancelled) return;

          setRoomName(room.name);
          localStorage.setItem(
            `${ROOM_META_PREFIX}${roomId}`,
            JSON.stringify({
              name: room.name,
              updatedAt: Date.now(),
            }),
          );
        } catch {
          if (cancelled) return;
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

  useEffect(() => {
    if (!isRoomAllowed || isCheckingRoom || isAuthenticated) {
      setIsSignInPromptOpen(false);
      return;
    }

    const claimToken = getRoomClaimToken(activeRoomId);
    if (!claimToken) {
      setIsSignInPromptOpen(false);
      return;
    }

    const dismissKey = `${SIGNIN_PROMPT_DISMISS_PREFIX}${activeRoomId}`;
    const dismissed = localStorage.getItem(dismissKey) === "true";
    if (!dismissed) {
      setIsSignInPromptOpen(true);
    }
  }, [activeRoomId, isAuthenticated, isCheckingRoom, isRoomAllowed]);

  const handleRenameRoom = async (nextName: string) => {
    setRoomName(nextName);

    const currentUser = firebaseAuth.currentUser;
    if (currentUser) {
      try {
        const idToken = await currentUser.getIdToken();
        await renameOwnedRoom(activeRoomId, nextName, idToken);
      } catch {
        // Fallback remains local-only for non-owner/guest flows.
      }
    }

    localStorage.setItem(
      `${ROOM_META_PREFIX}${activeRoomId}`,
      JSON.stringify({
        name: nextName,
        updatedAt: Date.now(),
      }),
    );
  };

  const handleNotify = (message: string, type: ToastType = "info") => {
    setToast({
      open: true,
      message,
      type,
    });
  };

  const handleCloseToast = () => {
    setToast((current) => ({
      ...current,
      open: false,
    }));
  };

  const handleOpenSavePrompt = () => {
    setIsSavePromptOpen(true);
  };

  const handleCloseSavePrompt = () => {
    setIsSavePromptOpen(false);
  };

  const handleDismissSignInPrompt = () => {
    localStorage.setItem(`${SIGNIN_PROMPT_DISMISS_PREFIX}${activeRoomId}`, "true");
    setIsSignInPromptOpen(false);
  };

  const validateRoomName = (value: string) => {
    if (!value.trim()) return "Room name cannot be empty.";
    if (value.trim().length < 2) return "Room name must be at least 2 characters.";
    if (value.trim().length > 60) return "Room name must be 60 characters or less.";
    return null;
  };

  const handleConfirmSavePrompt = (nextName: string) => {
    void handleRenameRoom(nextName).finally(() => {
      setIsSavePromptOpen(false);
      handleNotify("Room renamed.", "success");
    });
  };

  const tryClaimRoomOwnership = async () => {
    const signedInUser = firebaseAuth.currentUser;
    if (!signedInUser) return;

    const claimToken = getRoomClaimToken(activeRoomId);
    if (!claimToken) return;

    const idToken = await signedInUser.getIdToken();

    try {
      const result = await claimRoomOwnership(activeRoomId, idToken, claimToken);
      clearRoomClaimToken(activeRoomId);

      if (result.claimStatus === "claimed") {
        handleNotify("Room linked to your account.", "success");
      }
    } catch (error) {
      if (!(error instanceof Error)) return;

      if (error.message === "room_already_claimed") {
        clearRoomClaimToken(activeRoomId);
        handleNotify("This room is already owned by another account.", "info");
        return;
      }

      if (error.message === "claim_token_invalid_or_missing") {
        handleNotify("Ownership key is missing or invalid on this device.", "info");
      }
    }
  };

  const handleAuthLogin = async () => {
    setIsAuthActionLoading(true);
    try {
      await signInWithGoogle();
      await tryClaimRoomOwnership();
      setIsSignInPromptOpen(false);
      handleNotify("Signed in successfully.", "success");
    } catch {
      handleNotify("Google sign-in failed. Please try again.", "error");
    } finally {
      setIsAuthActionLoading(false);
    }
  };

  const handleAuthLogout = async () => {
    setIsAuthActionLoading(true);
    try {
      await signOutUser();
      handleNotify("Signed out.", "info");
    } catch {
      handleNotify("Sign out failed. Please try again.", "error");
    } finally {
      setIsAuthActionLoading(false);
    }
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
        className="editor-page"
        style={{ width: "100vw", height: "100vh", display: "grid", placeItems: "center" }}
      >
        <p>Validating room...</p>
      </div>
    );
  }

  return (
    <div
      className="editor-page"
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
          markerEnd: { type: MarkerType.ArrowClosed },
        }}
        colorMode={colorMode}
        style={{ background: "#ffffff" }}
        fitView
      >
        <Background />
        <Controls />
        <EditorHeader
          roomId={activeRoomId}
          roomName={roomName}
          onOpenSavePrompt={handleOpenSavePrompt}
          onNotify={handleNotify}
          currentUserName={authDisplayName}
          isAuthenticated={isAuthenticated}
          isAuthLoading={authLoading || isAuthActionLoading}
          onLogin={() => {
            void handleAuthLogin();
          }}
          onLogout={() => {
            void handleAuthLogout();
          }}
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
      <ToastPopup
        open={toast.open}
        message={toast.message}
        type={toast.type}
        durationMs={2600}
        showCloseButton
        onClose={handleCloseToast}
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
        onConfirm={handleConfirmSavePrompt}
        onCancel={handleCloseSavePrompt}
      />
      <SignInToSavePrompt
        open={isSignInPromptOpen}
        onClose={handleDismissSignInPrompt}
        onSignIn={() => {
          void handleAuthLogin();
        }}
      />
    </div>
  );
}
