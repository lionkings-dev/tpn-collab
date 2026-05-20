type TransitionBound = number | null;

export function normalizeTransitionBound(
  value: unknown,
  fallback: TransitionBound,
): TransitionBound {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.floor(value));
}

export function isValidConnection(
  connection: { source: string | null; target: string | null },
  nodes: { id: string; type?: string }[],
): boolean {
  const sourceNode = nodes.find((node) => node.id === connection.source);
  const targetNode = nodes.find((node) => node.id === connection.target);

  if (!sourceNode || !targetNode) return false;
  if (sourceNode.id === targetNode.id) return false;
  if (sourceNode.type === "place" && targetNode.type === "transition") return true;
  if (sourceNode.type === "transition" && targetNode.type === "place") return true;
  return false;
}
