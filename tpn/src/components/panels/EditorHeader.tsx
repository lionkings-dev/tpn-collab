import React from "react";
import { Panel } from "@xyflow/react";
import "./EditorHeader.css";
import type { ToastType } from "./toastPopup";

type EditorHeaderProps = {
  roomId: string;
  roomName: string;
  onOpenSavePrompt: () => void;
  onNotify: (message: string, type?: ToastType) => void;
  isAnonymous?: boolean;
};

const EditorHeader: React.FC<EditorHeaderProps> = ({
  roomId,
  roomName,
  onOpenSavePrompt,
  onNotify,
  isAnonymous = true,
}) => {
  const handleInvite = () => {
    const inviteLink = `${window.location.origin}/room/${roomId}`;
    navigator.clipboard
      .writeText(inviteLink)
      .then(() => onNotify("Invite link copied to clipboard.", "success"))
      .catch(() => onNotify(`Copy link manually: ${inviteLink}`, "error"));
  };

  const handleExport = () => {
    onNotify("Export functionality to be implemented.", "info");
  };

  const handleLogin = () => {
    onNotify("Login functionality to be implemented.", "info");
  };

  return (
    <Panel position="top-left" className="editor-header">
      <span className="room-name">{roomName}</span>
      <button onClick={handleInvite}>Invite</button>
      <button onClick={onOpenSavePrompt}>Save Room</button>
      <button onClick={handleExport}>Export</button>
      {isAnonymous && <button onClick={handleLogin}>Log in to save</button>}
    </Panel>
  );
};

export default EditorHeader;
