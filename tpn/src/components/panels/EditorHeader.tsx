import React, { useCallback, useRef } from "react";
import { Panel } from "@xyflow/react";
import "./EditorHeader.css";
import type { ToastType } from "./toastPopup";
import type { ExportFormatOption, FormatId } from "../../features/export";

type ImportFormatOption = {
  id: FormatId | "auto";
  label: string;
};

type EditorHeaderProps = {
  roomId: string;
  roomName: string;
  onOpenSavePrompt: () => void;
  onNotify: (message: string, type?: ToastType) => void;
  exportFormats: ExportFormatOption[];
  selectedExportFormat: FormatId;
  onExportFormatChange: (formatId: FormatId) => void;
  onExport: (formatId: FormatId) => void;
  importFormats: ImportFormatOption[];
  selectedImportFormat: FormatId | "auto";
  onImportFormatChange: (formatId: FormatId | "auto") => void;
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
  selectedExportFormat,
  onExportFormatChange,
  onExport,
  importFormats,
  selectedImportFormat,
  onImportFormatChange,
  onImportFile,
  currentUserName,
  isAuthenticated,
  isAuthLoading,
  onLogin,
  onLogout,
}) => {
  const importInputRef = useRef<HTMLInputElement | null>(null);

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

  return (
    <Panel position="top-left" className="editor-header">
      <span className="room-name">{roomName}</span>
      <button onClick={handleInvite}>Invite</button>
      <button onClick={onOpenSavePrompt}>Rename Room</button>
      <select
        className="editor-format-select"
        value={selectedExportFormat}
        onChange={(event) => onExportFormatChange(event.target.value as FormatId)}
        aria-label="Select export format"
      >
        {exportFormats.map((format) => (
          <option key={format.id} value={format.id}>
            {format.label}
          </option>
        ))}
      </select>
      <button onClick={() => onExport(selectedExportFormat)}>Export</button>
      <select
        className="editor-format-select"
        value={selectedImportFormat}
        onChange={(event) =>
          onImportFormatChange(event.target.value as FormatId | "auto")
        }
        aria-label="Select import format"
      >
        {importFormats.map((format) => (
          <option key={format.id} value={format.id}>
            {format.label}
          </option>
        ))}
      </select>
      <button onClick={handleImportClick}>Import</button>
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
