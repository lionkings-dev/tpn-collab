import { useCallback, useMemo } from "react";
import {
  useNodesState,
  useEdgesState,
  addEdge,
  type Node,
  type Edge,
  type Connection,
} from "@xyflow/react";

export function useFlow() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const onConnect = useCallback(
    (params: Connection) => {
      const edge = { ...params, type: "edge" };
      setEdges((eds) => addEdge(edge, eds));
    },
    [setEdges],
  );

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

  const addPlaces = useCallback(() => {
    const newNode: Node = {
      id: `p${nodes.length + 1}`,
      data: { label: `p${nodes.length + 1}`, tokens: 0 },
      type: "place",
      position: {
        x: Math.random() * window.innerWidth - 100,
        y: Math.random() * window.innerHeight,
      },
    };
    setNodes((nds) => nds.concat(newNode));
  }, [nodes, setNodes]);

  const addTransition = useCallback(() => {
    const newNode: Node = {
      id: `t${nodes.length + 1}`,
      data: { label: "New Transition", lb: 0, ub: 0, isEditing: false },
      type: "transition",
      position: {
        x: Math.random() * window.innerWidth - 100,
        y: Math.random() * window.innerHeight,
      },
    };
    setNodes((nds) => nds.concat(newNode));
  }, [nodes, setNodes]);

  const clearCanvas = useCallback(() => {
    setNodes([]);
    setEdges([]);
  }, [setNodes, setEdges]);

  const addToken = useCallback(() => {
    setNodes((nds) =>
      nds.map((node) => {
        // Find the selected 'place' node and ensure it doesn't already have 1 token.
        if (node.selected && node.type === "place" && node.data.tokens !== 1) {
          return {
            ...node,
            data: {
              ...node.data,
              tokens: 1, // Set tokens to 1
            },
          };
        }
        return node;
      }),
    );
  }, [setNodes]);

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
      // Validation rules
      if (lb < 0 || ub < 0 || lb > ub) {
        return; // Or provide some feedback
      }

      setNodes((nds) =>
        nds.map((n) => {
          if (n.id === nodeId) {
            return {
              ...n,
              data: {
                ...n.data,
                lb,
                ub,
              },
            };
          }
          return n;
        }),
      );
    },
    [setNodes],
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
