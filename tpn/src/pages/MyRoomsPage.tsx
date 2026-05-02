import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import { deleteOwnedRoom, getOwnedRooms, renameOwnedRoom, type OwnedRoom } from "../features/rooms";
import InputPrompt from "../components/panels/inputPrompt";
import "./MyRoomsPage.css";

type PageState = "loading" | "ready" | "error";

export default function MyRoomsPage() {
  const navigate = useNavigate();
  const { isAuthenticated, authLoading, user } = useAuth();
  const [rooms, setRooms] = useState<OwnedRoom[]>([]);
  const [state, setState] = useState<PageState>("loading");
  const [error, setError] = useState("");
  const [roomToRename, setRoomToRename] = useState<OwnedRoom | null>(null);
  const [roomToArchive, setRoomToArchive] = useState<OwnedRoom | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);

  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated || !user) {
      navigate("/", { replace: true });
      return;
    }

    let cancelled = false;

    const load = async () => {
      setState("loading");
      try {
        const idToken = await user.getIdToken();
        const ownedRooms = await getOwnedRooms(idToken);
        if (cancelled) return;
        setRooms(ownedRooms);
        setState("ready");
      } catch {
        if (cancelled) return;
        setError("Could not load your rooms right now.");
        setState("error");
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [authLoading, isAuthenticated, navigate, user]);

  const handleRename = async (nextName: string) => {
    if (!roomToRename || !user || isActionLoading) return;

    setIsActionLoading(true);

    try {
      const idToken = await user.getIdToken();
      const updatedRoom = await renameOwnedRoom(roomToRename.roomId, nextName, idToken);
      setRooms((current) =>
        current.map((item) => (item.roomId === updatedRoom.roomId ? updatedRoom : item)),
      );
      setRoomToRename(null);
      setError("");
    } catch {
      setError("Rename failed. Please try again.");
      setState("error");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleArchive = async () => {
    if (!roomToArchive || !user || isActionLoading) return;

    setIsActionLoading(true);

    try {
      const idToken = await user.getIdToken();
      await deleteOwnedRoom(roomToArchive.roomId, idToken);
      setRooms((current) => current.filter((item) => item.roomId !== roomToArchive.roomId));
      setRoomToArchive(null);
      setError("");
    } catch {
      setError("Archive failed. Please try again.");
      setState("error");
    } finally {
      setIsActionLoading(false);
    }
  };

  return (
    <div className="rooms-page">
      <header className="rooms-header ui-page-shell">
        <div>
          <h1 className="rooms-title">My Rooms</h1>
          <p className="rooms-subtitle">Manage your saved collaborative models.</p>
        </div>
        <button className="ui-button ui-button-secondary" onClick={() => navigate("/")}>
          Back to Landing
        </button>
      </header>

      <main className="rooms-content ui-page-shell">
        {state === "loading" && <p className="rooms-message">Loading rooms...</p>}
        {state === "error" && <p className="rooms-message rooms-message-error">{error || "Something went wrong."}</p>}
        {state === "ready" && rooms.length === 0 && (
          <div className="rooms-empty ui-card">
            <h2>No rooms yet</h2>
            <p>Create a room from the landing page to get started.</p>
          </div>
        )}
        {state === "ready" && rooms.length > 0 && (
          <ul className="rooms-list">
            {rooms.map((room) => (
              <li key={room.roomId} className="room-item ui-card">
                <div className="room-metadata">
                  <strong className="room-name">{room.name}</strong>
                  <p className="room-id">{room.roomId}</p>
                </div>
                <div className="room-actions">
                  <button className="ui-button ui-button-primary" onClick={() => navigate(`/room/${room.roomId}`)}>
                    Open
                  </button>
                  <button className="ui-button ui-button-secondary" onClick={() => setRoomToRename(room)}>
                    Rename
                  </button>
                  <button className="ui-button ui-button-danger" onClick={() => setRoomToArchive(room)}>
                    Archive
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>

      <InputPrompt
        open={Boolean(roomToRename)}
        title="Rename room"
        description="Use a clear name so collaborators can identify this model quickly."
        placeholder="Enter room name"
        defaultValue={roomToRename?.name || ""}
        confirmLabel={isActionLoading ? "Saving..." : "Save name"}
        cancelLabel="Cancel"
        validate={(value) => {
          if (!value.trim()) return "Room name cannot be empty.";
          if (value.trim().length < 2) return "Room name must be at least 2 characters.";
          if (value.trim().length > 60) return "Room name must be 60 characters or less.";
          return null;
        }}
        onConfirm={(value) => {
          void handleRename(value);
        }}
        onCancel={() => {
          if (isActionLoading) return;
          setRoomToRename(null);
        }}
      />

      {roomToArchive && (
        <div className="room-archive-backdrop" role="dialog" aria-modal="true">
          <div className="room-archive-card ui-card">
            <h3>Archive room</h3>
            <p>
              Archive <strong>{roomToArchive.name}</strong>? Collaborators can still access it directly by
              link if they already have it.
            </p>
            <div className="room-archive-actions">
              <button
                className="ui-button ui-button-secondary"
                onClick={() => {
                  if (isActionLoading) return;
                  setRoomToArchive(null);
                }}
              >
                Cancel
              </button>
              <button className="ui-button ui-button-danger" onClick={() => void handleArchive()}>
                {isActionLoading ? "Archiving..." : "Archive"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
