import { useCallback, useEffect, useMemo } from "react";
import {
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type Connection,
  type NodeChange,
} from "@xyflow/react";

import * as Y from "yjs";

export function useFlow(ydoc: Y.Doc) {
  const [nodes, setNodes] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const yNodes = ydoc.getMap<Node>("nodes");
  const yEdges = ydoc.getMap<Edge>("edges");


  //detect yjs change in yNodes and yedges then update react flow locally with setNodes and set edges
  useEffect(() => {
    const onChange = () => {
      setNodes(Array.from(yNodes.values()) as Node[]);
      setEdges(Array.from(yEdges.values()) as Edge[]);
    };

    onChange();

    yNodes.observe(onChange);
    yEdges.observe(onChange);

    return () => {
      yNodes.unobserve(onChange);
      yEdges.unobserve(onChange);
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
        id: `e-${crypto.randomUUID()}`,
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
      ydoc.transact(() => {
        changes.forEach((change) => {
          if (change.type === "position") {
            if (!change.position) return;

            const yNode = yNodes.get(change.id);
            if (!yNode) return;

            const currentX = yNode.position?.x;
            const currentY = yNode.position?.y;

            if (
              currentX === change.position.x &&
              currentY === change.position.y
            ) {
              return;
            }

            yNodes.set(change.id, {
              ...yNode,
              position: {
                x: change.position.x,
                y: change.position.y,
              },
            });
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
    },
    [ydoc, yNodes, yEdges],
  );

  const addPlaces = useCallback(() => {
    const newNode: Node = {
      id: `p${yNodes.size + 1}`,
      data: { label: `p${yNodes.size + 1}`, tokens: 0 },
      type: "place",
      position: {
        x: Math.random() * window.innerWidth - 100,
        y: Math.random() * window.innerHeight,
      },
    };
    yNodes.set(newNode.id, newNode);
    console.log(yNodes.get(newNode.id));
  }, [yNodes]);

  const addTransition = useCallback(() => {
    const newNode: Node = {
      id: `t${Date.now()}`,
      data: { label: `t${yEdges.size + 1}`, lb: 0, ub: 0, isEditing: false },
      type: "transition",
      position: {
        x: Math.random() * window.innerWidth - 100,
        y: Math.random() * window.innerHeight,
      },
    };
    yNodes.set(newNode.id, newNode);
  }, [yEdges, yNodes]);

  const clearCanvas = useCallback(() => {
    yNodes.clear();
    yEdges.clear();
  }, [yNodes, yEdges]);

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
    (_, node: Node) => {
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
    addToken,
    onNodeDoubleClick,
    updateTransitionTime,
  };
}
