import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ROOM_ERROR_CODES } from "@tpn/contracts/error-codes";
import "./LandingPage.css";
import ToastPopup, { type ToastType } from "../components/panels/toastPopup";
import { useAuth } from "../auth/AuthContext";
import {
  checkRoomExists,
  clearRoomClaimToken,
  generateRoomId,
  generateRoomName,
  saveRoomClaimToken,
  isValidRoomId,
  normalizeRoomInput,
  registerRoom,
} from "../features/rooms";

type ToastState = {
  open: boolean;
  message: string;
  type: ToastType;
};

const CREATE_ROOM_MAX_ATTEMPTS = 5;

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const routeJoinError =
    (location.state as { joinError?: string } | null)?.joinError || "";
  const consumedRouteJoinErrorRef = useRef<string | null>(null);
  const [joinInput, setJoinInput] = useState("");
  const [joinError, setJoinError] = useState(routeJoinError);
  const [isJoining, setIsJoining] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [toast, setToast] = useState<ToastState>({
    open: false,
    message: "",
    type: "info",
  });
  const { user, backendUser, isAuthenticated, authLoading, signInWithGoogle, signOutUser } =
    useAuth();
  const [isAuthActionLoading, setIsAuthActionLoading] = useState(false);

  const showToast = (message: string, type: ToastType = "info") => {
    setToast({
      open: true,
      message,
      type,
    });
  };

  const closeToast = () => {
    setToast((current) => ({
      ...current,
      open: false,
    }));
  };

  useEffect(() => {
    if (!routeJoinError) {
      consumedRouteJoinErrorRef.current = null;
      return;
    }

    if (consumedRouteJoinErrorRef.current === routeJoinError) {
      return;
    }

    consumedRouteJoinErrorRef.current = routeJoinError;
    setJoinError(routeJoinError);
    showToast(routeJoinError, "error");
    navigate(location.pathname, { replace: true, state: null });
  }, [routeJoinError, navigate, location.pathname]);

  const handleCreateModel = async () => {
    setIsCreating(true);

    try {
      let idToken: string | undefined;
      if (user) {
        idToken = await user.getIdToken();
      }

      for (let attempt = 1; attempt <= CREATE_ROOM_MAX_ATTEMPTS; attempt += 1) {
        const roomId = generateRoomId();
        const roomName = generateRoomName(roomId);

        try {
          const createdRoom = await registerRoom(roomId, {
            idToken,
            name: roomName,
          });
          const createdRoomId = createdRoom.roomId;

          if (createdRoom.claimToken) {
            saveRoomClaimToken(createdRoomId, createdRoom.claimToken);
          } else {
            clearRoomClaimToken(createdRoomId);
          }

          navigate(`/room/${createdRoomId}`, {
            state: {
              roomName,
            },
          });
          return;
        } catch (error) {
          if (
            error instanceof Error &&
            error.message === ROOM_ERROR_CODES.ROOM_ID_COLLISION &&
            attempt < CREATE_ROOM_MAX_ATTEMPTS
          ) {
            continue;
          }

          throw error;
        }
      }

      const collisionMessage = "Could not allocate a unique room ID. Please try again.";
      setJoinError(collisionMessage);
      showToast(collisionMessage, "error");
    } catch {
      const message = "Could not create room right now. Please try again.";
      setJoinError(message);
      showToast(message, "error");
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinRoom = async () => {
    const normalizedRoomId = normalizeRoomInput(joinInput);

    if (!joinInput.trim()) {
      const message = "Room ID or invite link is required.";
      setJoinError(message);
      showToast(message, "error");
      return;
    }

    if (!normalizedRoomId) {
      const message = "Invalid invite link. Use /room/<room-id> format.";
      setJoinError(message);
      showToast(message, "error");
      return;
    }

    if (!isValidRoomId(normalizedRoomId)) {
      const message = "Invalid room ID format.";
      setJoinError(message);
      showToast(message, "error");
      return;
    }

    setIsJoining(true);

    let roomExists = false;
    try {
      roomExists = await checkRoomExists(normalizedRoomId);
    } catch {
      const message = "Could not verify room right now. Please try again.";
      setJoinError(message);
      showToast(message, "error");
      setIsJoining(false);
      return;
    }

    if (!roomExists) {
      const message = "Room not found. Check your room ID or invite link.";
      setJoinError(message);
      showToast(message, "error");
      setIsJoining(false);
      return;
    }

    setJoinError("");
    setIsJoining(false);
    navigate(`/room/${normalizedRoomId}`);
  };

  const handleJoinInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setJoinInput(event.target.value);
    if (joinError) {
      setJoinError("");
      navigate(location.pathname, { replace: true, state: null });
    }
  };

  const handleJoinKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      void handleJoinRoom();
    }
  };

  const handleSignIn = async () => {
    setIsAuthActionLoading(true);
    try {
      await signInWithGoogle();
      showToast("Signed in successfully.", "success");
    } catch {
      showToast("Google sign-in failed. Please try again.", "error");
    } finally {
      setIsAuthActionLoading(false);
    }
  };

  const handleSignOut = async () => {
    setIsAuthActionLoading(true);
    try {
      await signOutUser();
      showToast("Signed out.", "info");
    } catch {
      showToast("Sign out failed. Please try again.", "error");
    } finally {
      setIsAuthActionLoading(false);
    }
  };

  const authName =
    backendUser?.displayName || user?.displayName || user?.email || "Authenticated User";

  return (
    <div className="landing-container">
      <header className="landing-header ui-page-shell">
        <div className="logo">TPN Collab</div>
        <nav className="main-nav" aria-label="Account actions">
          {isAuthenticated ? (
            <>
              <span className="nav-user-name" title={authName}>
                {authName}
              </span>
              <button
                className="ui-button ui-button-ghost"
                onClick={() => {
                  navigate("/rooms");
                }}
              >
                My Rooms
              </button>
              <button
                className="ui-button ui-button-secondary"
                onClick={() => {
                  void handleSignOut();
                }}
                disabled={isAuthActionLoading || authLoading}
              >
                {isAuthActionLoading ? "Signing out..." : "Sign Out"}
              </button>
            </>
          ) : (
            <button
              className="ui-button ui-button-primary"
              onClick={() => {
                void handleSignIn();
              }}
              disabled={isAuthActionLoading || authLoading}
            >
              {isAuthActionLoading ? "Signing in..." : "Sign In with Google"}
            </button>
          )}
        </nav>
      </header>

      <main className="landing-main">
        <div className="landing-box ui-card">
          <span className="landing-chip">Collaborative modeling</span>
          <h1 className="landing-title">
            Timed Petri Net Collaborative Editor
          </h1>
          <p className="landing-description">
            Start a new session and share the link to collaborate with your team
            instantly.
          </p>
          <button
            className="ui-button ui-button-primary landing-button"
            onClick={() => {
              void handleCreateModel();
            }}
            disabled={isCreating}
          >
            {isCreating ? "Creating..." : "Create New Model"}
          </button>

          <div className="join-room-section">
            <span className="join-or-text">or</span>
            <div className="join-input-group">
              <input
                type="text"
                placeholder="Enter Room ID..."
                className={`ui-control room-id-input ${joinError ? "is-invalid" : ""}`}
                value={joinInput}
                onChange={handleJoinInputChange}
                onKeyDown={handleJoinKeyDown}
              />
              <button
                className="ui-button ui-button-secondary join-button"
                onClick={() => {
                  void handleJoinRoom();
                }}
                disabled={isJoining}
              >
                {isJoining ? "Joining..." : "Join Room"}
              </button>
            </div>
          </div>
        </div>
      </main>
      <ToastPopup
        open={toast.open}
        message={toast.message}
        type={toast.type}
        durationMs={2600}
        showCloseButton
        onClose={closeToast}
      />
    </div>
  );
};

export default LandingPage;
