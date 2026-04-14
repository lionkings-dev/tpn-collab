import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import { deleteOwnedRoom, getOwnedRooms, renameOwnedRoom, type OwnedRoom } from "../features/rooms";

type PageState = "loading" | "ready" | "error";

export default function MyRoomsPage() {
  const navigate = useNavigate();
  const { isAuthenticated, authLoading, user } = useAuth();
  const [rooms, setRooms] = useState<OwnedRoom[]>([]);
  const [state, setState] = useState<PageState>("loading");
  const [error, setError] = useState("");

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

  const handleRename = async (room: OwnedRoom) => {
    const nextName = window.prompt("Rename room", room.name)?.trim();
    if (!nextName || !user) return;

    try {
      const idToken = await user.getIdToken();
      const updatedRoom = await renameOwnedRoom(room.roomId, nextName, idToken);
      setRooms((current) =>
        current.map((item) => (item.roomId === updatedRoom.roomId ? updatedRoom : item)),
      );
    } catch {
      setError("Rename failed. Please try again.");
      setState("error");
    }
  };

  const handleDelete = async (room: OwnedRoom) => {
    if (!user) return;

    const accepted = window.confirm(`Archive room "${room.name}"?`);
    if (!accepted) return;

    try {
      const idToken = await user.getIdToken();
      await deleteOwnedRoom(room.roomId, idToken);
      setRooms((current) => current.filter((item) => item.roomId !== room.roomId));
    } catch {
      setError("Delete failed. Please try again.");
      setState("error");
    }
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "1rem" }}>
      <h1>My Rooms</h1>
      <button onClick={() => navigate("/")}>Back to Landing</button>
      {state === "loading" && <p>Loading rooms...</p>}
      {state === "error" && <p>{error || "Something went wrong."}</p>}
      {state === "ready" && rooms.length === 0 && <p>You do not own any rooms yet.</p>}
      {state === "ready" && rooms.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: "0.75rem" }}>
          {rooms.map((room) => (
            <li
              key={room.roomId}
              style={{
                border: "1px solid var(--fg-alt-color)",
                borderRadius: 8,
                padding: "0.75rem",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "0.75rem",
              }}
            >
              <div>
                <strong>{room.name}</strong>
                <p style={{ margin: 0, color: "var(--fg-alt-color)" }}>{room.roomId}</p>
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button onClick={() => navigate(`/room/${room.roomId}`)}>Open</button>
                <button onClick={() => void handleRename(room)}>Rename</button>
                <button onClick={() => void handleDelete(room)}>Delete</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
