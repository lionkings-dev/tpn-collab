import React from "react";
import { Panel } from "@xyflow/react";
import "./EditorHeader.css";

// For the mock-up, we can assume the user is anonymous
type EditorHeaderProps = {
  isAnonymous?: boolean;
};

const EditorHeader: React.FC<EditorHeaderProps> = ({ isAnonymous = true }) => {
  const handleInvite = () => {
    alert("Invite functionality to be implemented.");
  };

  const handleExport = () => {
    alert("Export functionality to be implemented.");
  };

  const handleLogin = () => {
    alert("Login functionality to be implemented.");
  };

  return (
    <Panel position="top-left" className="editor-header">
      <button onClick={handleInvite}>Invite</button>
      <button onClick={handleExport}>Export</button>
      {isAnonymous && <button onClick={handleLogin}>Log in to save</button>}
    </Panel>
  );
};

export default EditorHeader;
