import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./LandingPage.css";
import ToastPopup, { type ToastType } from "../components/panels/toastPopup";
import {
  checkRoomExists,
  generateRoomId,
  generateRoomName,
  isValidRoomId,
  normalizeRoomInput,
  registerRoom,
} from "../utils/roomRouting";

type ToastState = {
  open: boolean;
  message: string;
  type: ToastType;
};

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const routeJoinError =
    (location.state as { joinError?: string } | null)?.joinError || "";
  const [joinInput, setJoinInput] = useState("");
  const [joinError, setJoinError] = useState(routeJoinError);
  const [isJoining, setIsJoining] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [toast, setToast] = useState<ToastState>({
    open: false,
    message: "",
    type: "info",
  });

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
    if (!routeJoinError) return;
    showToast(routeJoinError, "error");
  }, [routeJoinError]);

  const handleCreateModel = async () => {
    setIsCreating(true);
    const roomId = generateRoomId();
    const roomName = generateRoomName(roomId);

    try {
      await registerRoom(roomId);
    } catch {
      const message = "Could not create room right now. Please try again.";
      setJoinError(message);
      showToast(message, "error");
      setIsCreating(false);
      return;
    } finally {
      setIsCreating(false);
    }

    navigate(`/room/${roomId}`, {
      state: {
        roomName,
      },
    });
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

  return (
    <div className="landing-container">
      <header className="landing-header">
        <div className="logo">TPN-Collab</div>
        <nav className="main-nav">
          <button className="nav-button login">Login</button>
          <button className="nav-button signup">Sign Up</button>
        </nav>
      </header>

      <main className="landing-main">
        <div className="landing-box">
          <h1 className="landing-title">
            Timed Petri Net Collaborative Editor
          </h1>
          <p className="landing-description">
            Start a new session and share the link to collaborate with your team
            instantly.
          </p>
          <button
            className="landing-button"
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
                className={`room-id-input ${joinError ? "input-error" : ""}`}
                value={joinInput}
                onChange={handleJoinInputChange}
                onKeyDown={handleJoinKeyDown}
              />
              <button
                className="join-button"
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
