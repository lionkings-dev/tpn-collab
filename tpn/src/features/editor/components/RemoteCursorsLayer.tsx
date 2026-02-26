import type { RemoteAwarenessUser } from "../../collaboration";

// Extracted from EditorPage (step 2) as a pure remote-cursor render layer.

type CursorPosition = {
  x: number;
  y: number;
};

type RemoteCursorsLayerProps = {
  remoteUsers: RemoteAwarenessUser[];
  resolveRemoteCursorPosition: (cursor: RemoteAwarenessUser["cursor"]) => CursorPosition | null;
  isRemoteCursorVisible: (position: CursorPosition) => boolean;
};

export default function RemoteCursorsLayer({
  remoteUsers,
  resolveRemoteCursorPosition,
  isRemoteCursorVisible,
}: RemoteCursorsLayerProps) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 20,
      }}
    >
      {remoteUsers.map((remoteUser) => {
        const position = resolveRemoteCursorPosition(remoteUser.cursor);
        if (!position) return null;
        if (!isRemoteCursorVisible(position)) return null;

        return (
          <div
            key={remoteUser.clientId}
            style={{
              position: "absolute",
              transform: `translate(${position.x}px, ${position.y}px)`,
              display: "flex",
              alignItems: "center",
              gap: "0.35rem",
            }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 999,
                backgroundColor: remoteUser.user.color,
                boxShadow: "0 0 0 2px rgba(0, 0, 0, 0.35)",
              }}
            />
            <span
              style={{
                padding: "0.1rem 0.4rem",
                borderRadius: 6,
                background: "rgba(10, 10, 10, 0.8)",
                color: "#fff",
                fontSize: 12,
                lineHeight: 1.2,
                whiteSpace: "nowrap",
              }}
            >
              {remoteUser.user.name}
            </span>
          </div>
        );
      })}
    </div>
  );
}
