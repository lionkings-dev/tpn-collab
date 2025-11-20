import React from "react";
import { useNavigate } from "react-router-dom";
import "./LandingPage.css";

const LandingPage: React.FC = () => {
  const navigate = useNavigate();

  const handleCreateModel = () => {
    navigate("/room/dev-session");
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
          <button className="landing-button" onClick={handleCreateModel}>
            Create New Model
          </button>

          <div className="join-room-section">
            <span className="join-or-text">or</span>
            <div className="join-input-group">
              <input
                type="text"
                placeholder="Enter Room ID..."
                className="room-id-input"
              />
              <button className="join-button">Join Room</button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default LandingPage;
