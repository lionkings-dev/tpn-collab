import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  applyEdgeChanges,
  applyNodeChanges,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type Connection,
  type NodeChange,
  type EdgeChange,
  type Viewport,
} from "@xyflow/react";

import * as Y from "yjs";

const POSITION_UPDATE_ORIGIN = "position_origin_ref";
const POSITION_THROTTLE_MS = 30;

function createId(prefix: string) {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) {
    return `${prefix}-${uuid}`;
  }

  const timePart = Date.now().toString(36);
  const randomPart = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${timePart}${randomPart}`;
}

export function useFlow(
  ydoc: Y.Doc,
  getViewport: () => Viewport,
) {
  const [nodes, setNodes] = useNodesState<Node>([]);
  const [edges, setEdges] = useEdgesState<Edge>([]);

  const yNodes = ydoc.getMap<Node>("nodes");
  const yEdges = ydoc.getMap<Edge>("edges");
  const pendingPositionsRef = useRef<Map<string, { x: number; y: number }>>(
    new Map(),
  );
  const positionFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const flushPendingPositions = useCallback(() => {
    if (positionFlushTimerRef.current) {
      clearTimeout(positionFlushTimerRef.current);
      positionFlushTimerRef.current = null;
    }

    if (pendingPositionsRef.current.size === 0) return;

    const updates = Array.from(pendingPositionsRef.current.entries());
    pendingPositionsRef.current.clear();

    ydoc.transact(() => {
      updates.forEach(([nodeId, position]) => {
        const yNode = yNodes.get(nodeId);
        if (!yNode) return;

        const currentX = yNode.position?.x;
        const currentY = yNode.position?.y;
        if (currentX === position.x && currentY === position.y) return;

        yNodes.set(nodeId, {
          ...yNode,
          position,
        });
      });
    }, POSITION_UPDATE_ORIGIN);
  }, [ydoc, yNodes]);

  //detect yjs change in yNodes and yedges then update react flow locally with setNodes and set edges
  useEffect(() => {
    const pendingPositions = pendingPositionsRef.current;

    const onNodesDocChange = (
      _event: Y.YMapEvent<Node>,
      transaction: Y.Transaction,
    ) => {
      if (transaction.origin === POSITION_UPDATE_ORIGIN) {
        return;
      }
      setNodes(Array.from(yNodes.values()) as Node[]);
    };

    const onEdgesDocChange = () => {
      setEdges(Array.from(yEdges.values()) as Edge[]);
    };

    setNodes(Array.from(yNodes.values()) as Node[]);
    onEdgesDocChange();

    yNodes.observe(onNodesDocChange);
    yEdges.observe(onEdgesDocChange);

    return () => {
      if (positionFlushTimerRef.current) {
        clearTimeout(positionFlushTimerRef.current);
        positionFlushTimerRef.current = null;
      }
      pendingPositions.clear();

      yNodes.unobserve(onNodesDocChange);
      yEdges.unobserve(onEdgesDocChange);
    };
  }, [setNodes, setEdges, yNodes, yEdges]);

  const isValidConnection = useCallback(
    (connection: Connection | Edge) => {
      const sourceNode = nodes.find((node) => node.id === connection.source);
      const targetNode = nodes.find((node) => node.id === connection.target);

      if (!sourceNode || !targetNode) {
        return false;
      }
      if (sourceNode.id === targetNode.id) {
        return false;
      }
      if (sourceNode.type === "place" && targetNode.type === "transition") {
        return true;
      }
      if (sourceNode.type === "transition" && targetNode.type === "place") {
        return true;
      }

      return false;
    },
    [nodes],
  );

  const onConnect = useCallback(
    (params: Connection) => {
      if (!params.source || !params.target) return;
      if (!isValidConnection(params)) return;

      const duplicate = Array.from(yEdges.values()).some((edge) => {
        return (
          edge.source === params.source &&
          edge.target === params.target &&
          (edge.sourceHandle ?? null) === (params.sourceHandle ?? null) &&
          (edge.targetHandle ?? null) === (params.targetHandle ?? null)
        );
      });
      if (duplicate) return;

      const edge: Edge = {
        id: createId("e"),
        source: params.source,
        target: params.target,
        sourceHandle: params.sourceHandle,
        targetHandle: params.targetHandle,
        type: "edge",
      };

      ydoc.transact(() => {
        yEdges.set(edge.id, edge);
      });
    },
    [isValidConnection, yEdges, ydoc],
  );

  const onNodesChange = useCallback(
    (changes: NodeChange<Node>[]) => {
      //local update first for smooth UX render
      setNodes((currentNodes) => applyNodeChanges(changes, currentNodes));

      let shouldFlushImmediately = false;

      ydoc.transact(() => {
        changes.forEach((change) => {
          if (change.type === "position") {
            if (!change.position) return;

            pendingPositionsRef.current.set(change.id, {
              x: change.position.x,
              y: change.position.y,
            });

            if (change.dragging === false) {
              shouldFlushImmediately = true;
            }
          }

          if (change.type === "remove") {
            yNodes.delete(change.id);
            yEdges.forEach((edge, edgeId) => {
              if (edge.source === change.id || edge.target === change.id) {
                yEdges.delete(edgeId);
              }
            });
          }
        });
      });

      if (shouldFlushImmediately) {
        flushPendingPositions();
        return;
      }

      if (
        pendingPositionsRef.current.size > 0 &&
        positionFlushTimerRef.current === null
      ) {
        positionFlushTimerRef.current = setTimeout(() => {
          flushPendingPositions();
        }, POSITION_THROTTLE_MS);
      }
    },
    [setNodes, ydoc, yNodes, yEdges, flushPendingPositions],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange<Edge>[]) => {
      //local update fist
      setEdges((currentEdges) => applyEdgeChanges(changes, currentEdges));

      ydoc.transact(() => {
        changes.forEach((change) => {
          if (change.type === "remove") {
            yEdges.delete(change.id);
          }
        });
      });
    },
    [setEdges, yEdges, ydoc],
  );

  const addPlaces = useCallback(() => {
    const placeCount = Array.from(yNodes.values()).filter(
      (n) => n.type === "place",
    ).length;
    const placeLabel = `p${placeCount + 1}`;

    const viewport = getViewport();
    const offsetX = (Math.random() - 0.5) * 100;
    const offsetY = (Math.random() - 0.5) * 100;
    const x = (-viewport.x + window.innerWidth / 2) / viewport.zoom + offsetX;
    const y = (-viewport.y + window.innerHeight / 2) / viewport.zoom + offsetY;

    const newNode: Node = {
      id: createId("p"),
      data: { label: placeLabel, tokens: 0 },
      type: "place",
      position: { x, y },
    };
    yNodes.set(newNode.id, newNode);
  }, [yNodes, getViewport]);

  const addTransition = useCallback(() => {
    const transitionCount = Array.from(yNodes.values()).filter(
      (n) => n.type === "transition",
    ).length;
    const transitionLabel = `t${transitionCount + 1}`;

    const viewport = getViewport();
    const offsetX = (Math.random() - 0.5) * 100;
    const offsetY = (Math.random() - 0.5) * 100;
    const x = (-viewport.x + window.innerWidth / 2) / viewport.zoom + offsetX;
    const y = (-viewport.y + window.innerHeight / 2) / viewport.zoom + offsetY;

    const newNode: Node = {
      id: createId("t"),
      data: { label: transitionLabel, lb: 0, ub: 0, isEditing: false },
      type: "transition",
      position: { x, y },
    };
    yNodes.set(newNode.id, newNode);
  }, [yNodes, getViewport]);

  const clearCanvas = useCallback(() => {
    yNodes.clear();
    yEdges.clear();
  }, [yNodes, yEdges]);

  const replaceGraph = useCallback(
    (nextNodes: Node[], nextEdges: Edge[]) => {
      flushPendingPositions();

      ydoc.transact(() => {
        yNodes.clear();
        yEdges.clear();

        nextNodes.forEach((node) => {
          yNodes.set(node.id, node);
        });

        nextEdges.forEach((edge) => {
          yEdges.set(edge.id, edge);
        });
      });
    },
    [flushPendingPositions, ydoc, yNodes, yEdges],
  );

  const addToken = useCallback(() => {
    ydoc.transact(() => {
      nodes.forEach((node) => {
        if (!node.selected || node.type !== "place") return;

        const yNode = yNodes.get(node.id) as Node | undefined;
        if (!yNode) return;
        const currentTokens = yNode.data.tokens === 1 ? 1 : 0;
        const nextTokens = currentTokens === 1 ? 0 : 1;

        yNodes.set(node.id, {
          ...yNode,
          data: {
            ...yNode.data,
            tokens: nextTokens,
          },
        });
      });
    });
  }, [nodes, yNodes, ydoc]);

  const onNodeDoubleClick = useCallback(
    (_event: unknown, node: Node) => {
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id === node.id) {
            return {
              ...n,
              data: {
                ...n.data,
                isEditing: !n.data.isEditing,
              },
            };
          }
          return n;
        }),
      );
    },
    [setNodes],
  );

  const updateTransitionTime = useCallback(
    (nodeId: string, lb: number, ub: number) => {
      const nextLb = Number.isFinite(lb) ? Math.max(0, Math.floor(lb)) : 0;
      const nextUb = Number.isFinite(ub) ? Math.max(0, Math.floor(ub)) : 0;

      if (nextLb > nextUb) return;

      const yNode = yNodes.get(nodeId) as Node | undefined;
      if (!yNode || yNode.type !== "transition") return;

      const currentLb = typeof yNode.data.lb === "number" ? yNode.data.lb : 0;
      const currentUb = typeof yNode.data.ub === "number" ? yNode.data.ub : 0;

      if (currentLb === nextLb && currentUb === nextUb) return;

      ydoc.transact(() => {
        yNodes.set(nodeId, {
          ...yNode,
          data: {
            ...yNode.data,
            lb: nextLb,
            ub: nextUb,
          },
        });
      });
    },
    [yNodes, ydoc],
  );

  const nodesWithCallbacks = useMemo(() => {
    return nodes.map((node) => {
      if (node.type === "transition") {
        return {
          ...node,
          data: {
            ...node.data,
            updateTransitionTime: updateTransitionTime,
          },
        };
      }
      return node;
    });
  }, [nodes, updateTransitionTime]);

  return {
    nodes: nodesWithCallbacks,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    isValidConnection,
    addPlaces,
    addTransition,
    clearCanvas,
    replaceGraph,
    addToken,
    onNodeDoubleClick,
    updateTransitionTime,
  };
}
