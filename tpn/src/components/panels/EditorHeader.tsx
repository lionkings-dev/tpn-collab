import React from "react";
import { Panel } from "@xyflow/react";
import "./EditorHeader.css";

type EditorHeaderProps = {
  roomId: string;
  roomName: string;
  onSaveRoom: (nextName: string) => void;
  isAnonymous?: boolean;
};

const EditorHeader: React.FC<EditorHeaderProps> = ({
  roomId,
  roomName,
  onSaveRoom,
  isAnonymous = true,
}) => {
  const handleInvite = () => {
    const inviteLink = `${window.location.origin}/room/${roomId}`;
    navigator.clipboard
      .writeText(inviteLink)
      .then(() => alert("Invite link copied to clipboard."))
      .catch(() => alert(`Copy this invite link: ${inviteLink}`));
  };

  const handleExport = () => {
    alert("Export functionality to be implemented.");
  };

  const handleSaveRoom = () => {
    const input = window.prompt("Save room as", roomName);
    if (input === null) return;

    const trimmed = input.trim();
    if (!trimmed) {
      alert("Room name cannot be empty.");
      return;
    }

    onSaveRoom(trimmed);
  };

  const handleLogin = () => {
    alert("Login functionality to be implemented.");
  };

  return (
    <Panel position="top-left" className="editor-header">
      <span className="room-name">{roomName}</span>
      <button onClick={handleInvite}>Invite</button>
      <button onClick={handleSaveRoom}>Save Room</button>
      <button onClick={handleExport}>Export</button>
      {isAnonymous && <button onClick={handleLogin}>Log in to save</button>}
    </Panel>
  );
};

export default EditorHeader;
