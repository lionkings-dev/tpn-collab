import type { Edge, Node } from "@xyflow/react";
import { inferArcHandles } from "./core/handles";

type PlaceNodeData = {
  label: string;
  tokens: number;
};

type TransitionNodeData = {
  label: string;
  lb: number | null;
  ub: number | null;
  isEditing: boolean;
};

type SupportedNodeType = "place" | "transition";
type EndpointKind = "source" | "target";

const PLACE_SOURCE_HANDLES = new Set([
  "t.source",
  "b.source",
  "l.source",
  "r.source",
]);
const PLACE_TARGET_HANDLES = new Set([
  "t.target",
  "b.target",
  "l.target",
  "r.target",
]);
const TRANSITION_SOURCE_HANDLES = new Set(["l.source", "r.source"]);
const TRANSITION_TARGET_HANDLES = new Set(["l.target", "r.target"]);

function toInteger(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

export type PnmlImportResult = {
  netId: string;
  netName: string;
  nodes: Node[];
  edges: Edge[];
};

function toNonNegativeInteger(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.floor(value));
  }

  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      return Math.max(0, parsed);
    }
  }

  return fallback;
}

function parseBinaryMarking(value: unknown) {
  const parsed = toNonNegativeInteger(value, 0);
  if (parsed !== 0 && parsed !== 1) {
    throw new Error("pnml_import_invalid_initial_marking");
  }
  return parsed;
}

function firstDirectChildByLocalName(parent: Element, localName: string) {
  return Array.from(parent.children).find(
    (child) => child.localName === localName,
  );
}

function nestedText(parent: Element, path: string[]) {
  let current: Element | undefined = parent;

  for (const segment of path) {
    current = current && firstDirectChildByLocalName(current, segment);
    if (!current) return undefined;
  }

  const text = current.textContent?.trim();
  return text ? text : undefined;
}

function parsePosition(element: Element) {
  const graphics = firstDirectChildByLocalName(element, "graphics");
  const position = graphics && firstDirectChildByLocalName(graphics, "position");
  const x = toInteger(position?.getAttribute("x"), 0);
  const y = toInteger(position?.getAttribute("y"), 0);

  return { x, y };
}

function parseTransitionInterval(transition: Element) {
  const toolspecificElements = Array.from(transition.children).filter(
    (child) => child.localName === "toolspecific",
  );

  for (const toolspecific of toolspecificElements) {
    const timeInterval = firstDirectChildByLocalName(toolspecific, "timeInterval");
    if (!timeInterval) continue;

    const parseTransitionBound = (
      value: unknown,
      fallback: number | null,
    ): number | null => {
      if (value === undefined || value === null) {
        return fallback;
      }

      if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        if (!normalized) {
          return fallback;
        }
        if (normalized === "inf" || normalized === "infinity") {
          return null;
        }

        const parsed = Number.parseInt(normalized, 10);
        if (Number.isFinite(parsed)) {
          return Math.max(0, parsed);
        }
        return fallback;
      }

      if (typeof value === "number" && Number.isFinite(value)) {
        return Math.max(0, Math.floor(value));
      }

      return fallback;
    };

    const lb = parseTransitionBound(nestedText(timeInterval, ["lb"]), 0);
    const ub = parseTransitionBound(nestedText(timeInterval, ["ub"]), lb);

    if (lb === null && ub !== null) {
      throw new Error("pnml_import_invalid_transition_interval");
    }
    if (lb !== null && ub !== null && lb > ub) {
      throw new Error("pnml_import_invalid_transition_interval");
    }

    return {
      lb,
      ub,
    };
  }

  return { lb: 0, ub: 0 };
}

function toNodeType(value: Node["type"]): SupportedNodeType | null {
  if (value === "place" || value === "transition") {
    return value;
  }
  return null;
}

function isValidHandleForEndpoint(
  nodeType: SupportedNodeType,
  endpointKind: EndpointKind,
  handle: string,
) {
  if (endpointKind === "source") {
    return nodeType === "place"
      ? PLACE_SOURCE_HANDLES.has(handle)
      : TRANSITION_SOURCE_HANDLES.has(handle);
  }

  return nodeType === "place"
    ? PLACE_TARGET_HANDLES.has(handle)
    : TRANSITION_TARGET_HANDLES.has(handle);
}

function parseArcHandleHints(arc: Element) {
  const toolSpecificElements = Array.from(arc.children).filter(
    (child) => child.localName === "toolspecific",
  );

  let fallback: { sourceHandle?: string; targetHandle?: string } | null = null;

  for (const toolSpecific of toolSpecificElements) {
    const sourceHandle = nestedText(toolSpecific, ["sourceHandle"]);
    const targetHandle = nestedText(toolSpecific, ["targetHandle"]);
    if (!sourceHandle && !targetHandle) {
      continue;
    }

    const handleHints = {
      sourceHandle: sourceHandle?.trim(),
      targetHandle: targetHandle?.trim(),
    };

    if (toolSpecific.getAttribute("tool") === "tpn-collab") {
      return handleHints;
    }

    fallback = handleHints;
  }

  return fallback || {};
}

export function importPnml(xmlContent: string): PnmlImportResult {
  if (!xmlContent.trim()) {
    throw new Error("pnml_import_empty_content");
  }

  const xmlParser = new DOMParser();
  const xmlDocument = xmlParser.parseFromString(xmlContent, "application/xml");
  const parserError = xmlDocument.getElementsByTagName("parsererror").item(0);

  if (parserError) {
    throw new Error("pnml_import_invalid_xml");
  }

  const net = xmlDocument.getElementsByTagNameNS("*", "net").item(0);
  if (!net) {
    throw new Error("pnml_import_missing_net");
  }

  const netId = net.getAttribute("id")?.trim() || "imported-net";
  const netName = nestedText(net, ["name", "text"]) || netId;

  const placeElements = Array.from(net.getElementsByTagNameNS("*", "place"));
  const transitionElements = Array.from(
    net.getElementsByTagNameNS("*", "transition"),
  );
  const arcElements = Array.from(net.getElementsByTagNameNS("*", "arc"));

  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const nodeIds = new Set<string>();
  const edgeIds = new Set<string>();

  for (const place of placeElements) {
    const id = place.getAttribute("id")?.trim();
    if (!id) throw new Error("pnml_import_missing_place_id");
    if (nodeIds.has(id)) throw new Error("pnml_import_duplicate_node_id");

    const label = nestedText(place, ["name", "text"]) || id;
    const tokens = parseBinaryMarking(nestedText(place, ["initialMarking", "text"]));

    const node: Node = {
      id,
      type: "place",
      position: parsePosition(place),
      data: {
        label,
        tokens,
      } satisfies PlaceNodeData,
    };

    nodes.push(node);
    nodeIds.add(id);
  }

  for (const transition of transitionElements) {
    const id = transition.getAttribute("id")?.trim();
    if (!id) throw new Error("pnml_import_missing_transition_id");
    if (nodeIds.has(id)) throw new Error("pnml_import_duplicate_node_id");

    const label = nestedText(transition, ["name", "text"]) || id;
    const { lb, ub } = parseTransitionInterval(transition);
    const node: Node = {
      id,
      type: "transition",
      position: parsePosition(transition),
      data: {
        label,
        lb,
        ub,
        isEditing: false,
      } satisfies TransitionNodeData,
    };

    nodes.push(node);
    nodeIds.add(id);
  }

  const nodeById = new Map(nodes.map((node) => [node.id, node]));

  arcElements.forEach((arc, index) => {
    const source = arc.getAttribute("source")?.trim();
    const target = arc.getAttribute("target")?.trim();
    if (!source || !target) {
      throw new Error("pnml_import_missing_arc_endpoint");
    }

    let id = arc.getAttribute("id")?.trim() || `imported-arc-${index + 1}`;
    while (edgeIds.has(id)) {
      id = `${id}-dup`;
    }

    const weight = Math.max(
      1,
      toNonNegativeInteger(nestedText(arc, ["inscription", "text"]), 1),
    );

    const sourceNode = nodeById.get(source);
    const targetNode = nodeById.get(target);
    const sourceNodeType = sourceNode && toNodeType(sourceNode.type);
    const targetNodeType = targetNode && toNodeType(targetNode.type);

    const parsedHandleHints = parseArcHandleHints(arc);
    let sourceHandle = parsedHandleHints.sourceHandle;
    let targetHandle = parsedHandleHints.targetHandle;

    if (
      !sourceNodeType ||
      !sourceHandle ||
      !isValidHandleForEndpoint(sourceNodeType, "source", sourceHandle)
    ) {
      sourceHandle = undefined;
    }

    if (
      !targetNodeType ||
      !targetHandle ||
      !isValidHandleForEndpoint(targetNodeType, "target", targetHandle)
    ) {
      targetHandle = undefined;
    }

    if ((!sourceHandle || !targetHandle) && sourceNode && targetNode) {
      const inferred = inferArcHandles(sourceNode, targetNode);
      if (!sourceHandle) {
        sourceHandle = inferred.sourceHandle;
      }
      if (!targetHandle) {
        targetHandle = inferred.targetHandle;
      }
    }

    const edge: Edge = {
      id,
      source,
      target,
      type: "edge",
      data: { weight },
      ...(sourceHandle ? { sourceHandle } : {}),
      ...(targetHandle ? { targetHandle } : {}),
    };

    edges.push(edge);
    edgeIds.add(id);
  });

  const nodeTypeById = new Map(nodes.map((node) => [node.id, node.type]));
  for (const edge of edges) {
    const sourceType = nodeTypeById.get(edge.source);
    const targetType = nodeTypeById.get(edge.target);

    if (!sourceType || !targetType) {
      throw new Error("pnml_import_arc_endpoint_not_found");
    }

    if (sourceType === targetType) {
      throw new Error("pnml_import_invalid_arc_direction");
    }
  }

  return {
    netId,
    netName,
    nodes,
    edges,
  };
}
