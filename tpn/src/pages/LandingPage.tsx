import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./LandingPage.css";
import {
  checkRoomExists,
  generateRoomId,
  generateRoomName,
  isValidRoomId,
  normalizeRoomInput,
  registerRoom,
} from "../utils/roomRouting";

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const routeJoinError =
    (location.state as { joinError?: string } | null)?.joinError || "";
  const [joinInput, setJoinInput] = useState("");
  const [joinError, setJoinError] = useState(routeJoinError);
  const [isJoining, setIsJoining] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateModel = async () => {
    setIsCreating(true);
    const roomId = generateRoomId();
    const roomName = generateRoomName(roomId);

    try {
      await registerRoom(roomId);
    } catch {
      setJoinError("Could not create room right now. Please try again.");
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
      setJoinError("Room ID or invite link is required.");
      return;
    }

    if (!normalizedRoomId) {
      setJoinError("Invalid invite link. Use /room/<room-id> format.");
      return;
    }

    if (!isValidRoomId(normalizedRoomId)) {
      setJoinError("Invalid room ID format.");
      return;
    }

    setIsJoining(true);

    let roomExists = false;
    try {
      roomExists = await checkRoomExists(normalizedRoomId);
    } catch {
      setJoinError("Could not verify room right now. Please try again.");
      setIsJoining(false);
      return;
    }

    if (!roomExists) {
      setJoinError("Room not found. Check your room ID or invite link.");
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
            {joinError && <p className="join-error-text">{joinError}</p>}
          </div>
        </div>
      </main>
    </div>
  );
};

export default LandingPage;
