import React, { useCallback, useRef, useState } from "react";
import { Panel } from "@xyflow/react";
import "./EditorHeader.css";
import type { ToastType } from "./toastPopup";
import type { ExportFormatOption, FormatId } from "../../features/export";

type EditorHeaderProps = {
  roomId: string;
  roomName: string;
  onOpenSavePrompt: () => void;
  onNotify: (message: string, type?: ToastType) => void;
  exportFormats: ExportFormatOption[];
  onExport: (formatId: FormatId) => void;
  onImportFile: (file: File) => void | Promise<void>;
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
  exportFormats,
  onExport,
  onImportFile,
  currentUserName,
  isAuthenticated,
  isAuthLoading,
  onLogin,
  onLogout,
}) => {
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [exportSelection, setExportSelection] = useState<FormatId | "">("");

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

  const handleImportClick = useCallback(() => {
    importInputRef.current?.click();
  }, []);

  const handleImportFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0] ?? null;
      event.target.value = "";
      if (!file) return;

      void Promise.resolve(onImportFile(file)).catch(() => {
        onNotify("Import failed. Please check your file format.", "error");
      });
    },
    [onImportFile, onNotify],
  );

  const handleExportSelection = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const formatId = event.target.value as FormatId | "";
      setExportSelection(formatId);
      if (!formatId) return;

      onExport(formatId);
      setExportSelection("");
    },
    [onExport],
  );

  return (
    <Panel position="top-left" className="editor-header ui-panel">
      <span className="room-name">{roomName}</span>
      <button className="ui-button ui-button-secondary" onClick={handleInvite}>
        Invite
      </button>
      <button className="ui-button ui-button-secondary" onClick={onOpenSavePrompt}>
        Rename Room
      </button>
      <select
        className="editor-format-select ui-control"
        value={exportSelection}
        onChange={handleExportSelection}
        aria-label="Export graph format"
      >
        <option value="">Export...</option>
        {exportFormats.map((format) => (
          <option key={format.id} value={format.id}>
            {format.label}
          </option>
        ))}
      </select>
      <button className="ui-button ui-button-secondary" onClick={handleImportClick}>
        Import
      </button>
      <input
        ref={importInputRef}
        type="file"
        accept=".pnml,.xml,.ppp,.spec,.txt,application/xml,text/xml,text/plain"
        style={{ display: "none" }}
        onChange={handleImportFileChange}
      />
      {isAuthenticated ? (
        <>
          <span className="editor-auth-name" title={currentUserName || "Authenticated User"}>
            {currentUserName || "Authenticated User"}
          </span>
          <button className="ui-button ui-button-ghost" onClick={onLogout} disabled={isAuthLoading}>
            {isAuthLoading ? "Signing out..." : "Sign Out"}
          </button>
        </>
      ) : (
        <button className="ui-button ui-button-primary" onClick={onLogin} disabled={isAuthLoading}>
          {isAuthLoading ? "Signing in..." : "Log in with Google"}
        </button>
      )}
    </Panel>
  );
};

export default EditorHeader;
