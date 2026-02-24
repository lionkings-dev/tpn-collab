import React from "react";
import { Panel } from "@xyflow/react";
import "./EditorHeader.css";
import type { ToastType } from "./toastPopup";

type EditorHeaderProps = {
  roomId: string;
  roomName: string;
  onOpenSavePrompt: () => void;
  onNotify: (message: string, type?: ToastType) => void;
  currentUserName: string | null;
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  onLogin: () => void;
  onLogout: () => void;
};

const EditorHeader: React.FC<EditorHeaderProps> = ({
  roomId,
  roomName,
  onOpenSavePrompt,
  onNotify,
  currentUserName,
  isAuthenticated,
  isAuthLoading,
  onLogin,
  onLogout,
}) => {
  const handleInvite = () => {
    const inviteLink = `${window.location.origin}/room/${roomId}`;

    const clipboardApi = navigator.clipboard;
    if (clipboardApi?.writeText) {
      clipboardApi
        .writeText(inviteLink)
        .then(() => onNotify("Invite link copied to clipboard.", "success"))
        .catch(() => onNotify(`Copy link manually: ${inviteLink}`, "error"));
      return;
    }

    const tempInput = document.createElement("textarea");
    tempInput.value = inviteLink;
    tempInput.setAttribute("readonly", "");
    tempInput.style.position = "absolute";
    tempInput.style.left = "-9999px";
    document.body.appendChild(tempInput);
    tempInput.select();

    try {
      const copied = document.execCommand("copy");
      if (copied) {
        onNotify("Invite link copied to clipboard.", "success");
      } else {
        onNotify(`Copy link manually: ${inviteLink}`, "error");
      }
    } catch {
      onNotify(`Copy link manually: ${inviteLink}`, "error");
    } finally {
      document.body.removeChild(tempInput);
    }
  };

  const handleExport = () => {
    onNotify("Export functionality to be implemented.", "info");
  };

  return (
    <Panel position="top-left" className="editor-header">
      <span className="room-name">{roomName}</span>
      <button onClick={handleInvite}>Invite</button>
      <button onClick={onOpenSavePrompt}>Rename Room</button>
      <button onClick={handleExport}>Export</button>
      {isAuthenticated ? (
        <>
          <span className="editor-auth-name" title={currentUserName || "Authenticated User"}>
            {currentUserName || "Authenticated User"}
          </span>
          <button onClick={onLogout} disabled={isAuthLoading}>
            {isAuthLoading ? "Signing out..." : "Sign Out"}
          </button>
        </>
      ) : (
        <button onClick={onLogin} disabled={isAuthLoading}>
          {isAuthLoading ? "Signing in..." : "Log in with Google"}
        </button>
      )}
    </Panel>
  );
};

export default EditorHeader;
