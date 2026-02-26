import { useCallback, useRef, useState, type PointerEvent, type RefObject } from "react";
import type { Viewport } from "@xyflow/react";

import type { AwarenessCursor } from "../../collaboration";

// Extracted from EditorPage (step 2) to isolate cursor math and pointer handlers.

const DEFAULT_CURSOR_THROTTLE_MS = 40;

type CursorPosition = {
  x: number;
  y: number;
};

type UseCursorLayerParams = {
  editorRef: RefObject<HTMLDivElement | null>;
  updateLocalCursor: (flowX: number, flowY: number) => void;
  clearLocalCursor: () => void;
  throttleMs?: number;
};

export function useCursorLayer({
  editorRef,
  updateLocalCursor,
  clearLocalCursor,
  throttleMs = DEFAULT_CURSOR_THROTTLE_MS,
}: UseCursorLayerParams) {
  const viewportRef = useRef<Viewport>({ x: 0, y: 0, zoom: 1 });
  const [, setViewportVersion] = useState(0);
  const lastCursorUpdateRef = useRef(0);

  const handleViewportChange = useCallback((nextViewport: Viewport) => {
    viewportRef.current = nextViewport;
    // Keep overlay rendering in sync with pan/zoom changes.
    setViewportVersion((version) => version + 1);
  }, []);

  const onPointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const now = Date.now();
      if (now - lastCursorUpdateRef.current < throttleMs) return;

      const editorElement = editorRef.current;
      if (!editorElement) return;

      const rect = editorElement.getBoundingClientRect();
      const localX = event.clientX - rect.left;
      const localY = event.clientY - rect.top;
      const { x: viewportX, y: viewportY, zoom } = viewportRef.current;
      const flowX = (localX - viewportX) / zoom;
      const flowY = (localY - viewportY) / zoom;

      lastCursorUpdateRef.current = now;
      updateLocalCursor(flowX, flowY);
    },
    [editorRef, throttleMs, updateLocalCursor],
  );

  const onPointerLeave = useCallback(() => {
    clearLocalCursor();
  }, [clearLocalCursor]);

  const resolveRemoteCursorPosition = useCallback(
    (cursor?: AwarenessCursor): CursorPosition | null => {
      if (!cursor) return null;

      if (typeof cursor.flowX === "number" && typeof cursor.flowY === "number") {
        const { x: viewportX, y: viewportY, zoom } = viewportRef.current;
        return {
          x: cursor.flowX * zoom + viewportX,
          y: cursor.flowY * zoom + viewportY,
        };
      }

      if (typeof cursor.x === "number" && typeof cursor.y === "number") {
        const rect = editorRef.current?.getBoundingClientRect();
        if (!rect) {
          return { x: cursor.x, y: cursor.y };
        }

        return {
          x: cursor.x - rect.left,
          y: cursor.y - rect.top,
        };
      }

      return null;
    },
    [editorRef],
  );

  const isRemoteCursorVisible = useCallback(
    (position: CursorPosition) => {
      const rect = editorRef.current?.getBoundingClientRect();
      if (!rect) return true;

      const visibilityPadding = 24;

      return (
        position.x >= -visibilityPadding &&
        position.x <= rect.width + visibilityPadding &&
        position.y >= -visibilityPadding &&
        position.y <= rect.height + visibilityPadding
      );
    },
    [editorRef],
  );

  return {
    handleViewportChange,
    onPointerMove,
    onPointerLeave,
    resolveRemoteCursorPosition,
    isRemoteCursorVisible,
  };
}
