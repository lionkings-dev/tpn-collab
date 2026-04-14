import type { Edge, Node } from "@xyflow/react";

import {
  inferArcHandles,
  inferSharedPlaceTransitionHandles,
} from "../core/handles";
import { computeClusteredBipartiteLayout } from "../core/layout";
import type { GraphImportResult } from "../core/types";

type TransitionBound = number | null;

type ParsedConnection = {
  transitionName: string;
  lb: TransitionBound;
  ub: TransitionBound;
  inputPlaces: string[];
  outputPlaces: string[];
};

type ParsedDefinition = {
  transitionName: string;
  mappedName: string;
};

type EdgeHandles = {
  sourceHandle?: string;
  targetHandle?: string;
};

const CONNECTION_RE =
  /^([^\s\[]+)\s*(?:\[\s*([^,\]]+)\s*,\s*([^\]]+)\s*\])?\s*\(([^)]*)\)\s*\/\s*\(([^)]*)\)\s*;$/;
const DEFINITION_RE = /^([^\s=]+)\s*=\s*\(([^)]*)\)\s*;$/;

function parseCsvList(segment: string) {
  const normalized = segment.trim();
  if (!normalized) return [];
  return normalized
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

function parseSpecTransitions(specHeader: string) {
  const separatorIndex = specHeader.indexOf(";");
  const transitionsSegment =
    separatorIndex >= 0 ? specHeader.slice(separatorIndex + 1) : specHeader;
  return parseCsvList(transitionsSegment);
}

function parseBoundToken(rawToken: string): TransitionBound {
  const normalized = rawToken.trim().toLowerCase();
  if (!normalized) {
    throw new Error("ppp_import_invalid_transition_interval");
  }

  if (normalized === "9999" || normalized === "inf" || normalized === "infinity") {
    return null;
  }

  if (!/^\d+$/.test(normalized)) {
    throw new Error("ppp_import_invalid_transition_interval");
  }

  return Number.parseInt(normalized, 10);
}

function validateTransitionInterval(lb: TransitionBound, ub: TransitionBound) {
  if (lb === null && ub !== null) {
    throw new Error("ppp_import_invalid_transition_interval");
  }

  if (lb !== null && ub !== null && lb > ub) {
    throw new Error("ppp_import_invalid_transition_interval");
  }
}

function parseConnectionLine(line: string): ParsedConnection {
  const match = line.match(CONNECTION_RE);
  if (!match) {
    throw new Error("ppp_import_invalid_connection_syntax");
  }

  const transitionName = match[1].trim();
  if (!transitionName) {
    throw new Error("ppp_import_invalid_connection_syntax");
  }

  const hasInterval = match[2] !== undefined && match[3] !== undefined;
  const lb = hasInterval ? parseBoundToken(match[2]) : 0;
  const ub = hasInterval ? parseBoundToken(match[3]) : null;
  validateTransitionInterval(lb, ub);

  const inputPlaces = parseCsvList(match[4]);
  const outputPlaces = parseCsvList(match[5]);

  return {
    transitionName,
    lb,
    ub,
    inputPlaces,
    outputPlaces,
  };
}

function parseDefinitionLine(line: string): ParsedDefinition {
  const match = line.match(DEFINITION_RE);
  if (!match) {
    throw new Error("ppp_import_invalid_transition_definition");
  }

  const transitionName = match[1].trim();
  const mappedName = match[2].trim();
  if (!transitionName || !mappedName) {
    throw new Error("ppp_import_invalid_transition_definition");
  }

  return {
    transitionName,
    mappedName,
  };
}

function assertNoDuplicates(values: string[], errorCode: string) {
  const seen = new Set<string>();
  values.forEach((value) => {
    if (seen.has(value)) {
      throw new Error(errorCode);
    }
    seen.add(value);
  });
}

function createEdge(
  id: string,
  source: string,
  target: string,
  handles: EdgeHandles,
): Edge {
  return {
    id,
    source,
    target,
    type: "edge",
    ...(handles.sourceHandle ? { sourceHandle: handles.sourceHandle } : {}),
    ...(handles.targetHandle ? { targetHandle: handles.targetHandle } : {}),
  };
}

export function importPpp(content: string): GraphImportResult {
  if (!content.trim()) {
    throw new Error("ppp_import_empty_content");
  }

  const rootMatch = content.match(/^\s*spec\s*\(([^)]*)\)\s*\{([\s\S]*)\}\s*$/i);
  if (!rootMatch) {
    throw new Error("ppp_import_invalid_root");
  }

  const specHeaderTransitions = parseSpecTransitions(rootMatch[1]);
  const body = rootMatch[2];
  const lines = body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  let placeNames: string[] | null = null;
  let transitionNames: string[] | null = null;
  let tokenNames: string[] | null = null;
  const connections = new Map<string, ParsedConnection>();
  const definitions: ParsedDefinition[] = [];

  for (const line of lines) {
    const placeMatch = line.match(/^place\s*\(([^)]*)\)\s*;$/i);
    if (placeMatch) {
      if (placeNames) throw new Error("ppp_import_duplicate_place_section");
      placeNames = parseCsvList(placeMatch[1]);
      continue;
    }

    const transitionMatch = line.match(/^trans\s*\(([^)]*)\)\s*;$/i);
    if (transitionMatch) {
      if (transitionNames) throw new Error("ppp_import_duplicate_trans_section");
      transitionNames = parseCsvList(transitionMatch[1]);
      continue;
    }

    const tokenMatch = line.match(/^token\s*\(([^)]*)\)\s*;$/i);
    if (tokenMatch) {
      if (tokenNames) throw new Error("ppp_import_duplicate_token_section");
      tokenNames = parseCsvList(tokenMatch[1]);
      continue;
    }

    if (line.includes("/")) {
      const parsedConnection = parseConnectionLine(line);
      if (connections.has(parsedConnection.transitionName)) {
        throw new Error("ppp_import_duplicate_transition_connection");
      }
      connections.set(parsedConnection.transitionName, parsedConnection);
      continue;
    }

    if (line.includes("=")) {
      const parsedDefinition = parseDefinitionLine(line);
      definitions.push(parsedDefinition);
      continue;
    }

    throw new Error("ppp_import_invalid_statement");
  }

  if (!placeNames) {
    throw new Error("ppp_import_missing_place_section");
  }
  if (!transitionNames) {
    throw new Error("ppp_import_missing_trans_section");
  }
  if (!tokenNames) {
    throw new Error("ppp_import_missing_token_section");
  }

  assertNoDuplicates(placeNames, "ppp_import_duplicate_place_name");
  assertNoDuplicates(transitionNames, "ppp_import_duplicate_transition_name");

  const placeSet = new Set(placeNames);
  const transitionSet = new Set(transitionNames);

  specHeaderTransitions.forEach((name) => {
    if (!transitionSet.has(name)) {
      throw new Error("ppp_import_spec_transition_not_found");
    }
  });

  tokenNames.forEach((placeName) => {
    if (!placeSet.has(placeName)) {
      throw new Error("ppp_import_invalid_token_reference");
    }
  });

  connections.forEach((connection, transitionName) => {
    if (!transitionSet.has(transitionName)) {
      throw new Error("ppp_import_connection_transition_not_found");
    }

    connection.inputPlaces.forEach((placeName) => {
      if (!placeSet.has(placeName)) {
        throw new Error("ppp_import_connection_place_not_found");
      }
    });

    connection.outputPlaces.forEach((placeName) => {
      if (!placeSet.has(placeName)) {
        throw new Error("ppp_import_connection_place_not_found");
      }
    });
  });

  definitions.forEach((definition) => {
    if (!transitionSet.has(definition.transitionName)) {
      throw new Error("ppp_import_definition_transition_not_found");
    }
    if (!transitionSet.has(definition.mappedName)) {
      throw new Error("ppp_import_definition_transition_not_found");
    }
  });

  const placeIdByName = new Map(
    placeNames.map((name, index) => [name, `ppp-place-${index + 1}`]),
  );
  const transitionIdByName = new Map(
    transitionNames.map((name, index) => [name, `ppp-transition-${index + 1}`]),
  );

  const layoutNodes = [
    ...Array.from(placeIdByName.values()).map((id) => ({
      id,
      kind: "place" as const,
    })),
    ...Array.from(transitionIdByName.values()).map((id) => ({
      id,
      kind: "transition" as const,
    })),
  ];

  const layoutLinks = transitionNames.flatMap((transitionName) => {
    const transitionId = transitionIdByName.get(transitionName);
    const connection = connections.get(transitionName);
    if (!transitionId || !connection) return [];

    const inputLinks = connection.inputPlaces
      .map((placeName) => placeIdByName.get(placeName))
      .filter((id): id is string => Boolean(id))
      .map((placeId) => ({
        sourceId: placeId,
        targetId: transitionId,
      }));

    const outputLinks = connection.outputPlaces
      .map((placeName) => placeIdByName.get(placeName))
      .filter((id): id is string => Boolean(id))
      .map((placeId) => ({
        sourceId: transitionId,
        targetId: placeId,
      }));

    return [...inputLinks, ...outputLinks];
  });

  const orderHint = new Map<string, number>();

  placeNames.forEach((placeName, index) => {
    const placeId = placeIdByName.get(placeName);
    if (!placeId) return;
    orderHint.set(placeId, index);
  });

  transitionNames.forEach((transitionName, index) => {
    const transitionId = transitionIdByName.get(transitionName);
    if (!transitionId) return;
    orderHint.set(transitionId, placeNames.length + index);
  });

  const positions = computeClusteredBipartiteLayout(layoutNodes, layoutLinks, {
    startX: 140,
    startY: 120,
    columnGap: 220,
    rowGap: 150,
    componentGapX: 260,
    componentGapY: 220,
    orderHint,
  });

  const tokenSet = new Set(tokenNames);
  const nodes: Node[] = [];

  placeNames.forEach((placeName) => {
    const id = placeIdByName.get(placeName);
    const position = id ? positions.get(id) : null;
    if (!id || !position) {
      throw new Error("ppp_import_internal_position_error");
    }

    nodes.push({
      id,
      type: "place",
      position,
      data: {
        label: placeName,
        tokens: tokenSet.has(placeName) ? 1 : 0,
      },
    });
  });

  transitionNames.forEach((transitionName) => {
    const id = transitionIdByName.get(transitionName);
    const position = id ? positions.get(id) : null;
    if (!id || !position) {
      throw new Error("ppp_import_internal_position_error");
    }

    const connection = connections.get(transitionName);
    const lb = connection ? connection.lb : 0;
    const ub = connection ? connection.ub : null;

    nodes.push({
      id,
      type: "transition",
      position,
      data: {
        label: transitionName,
        lb,
        ub,
        isEditing: false,
      },
    });
  });

  const edges: Edge[] = [];
  let edgeCounter = 1;
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const sharedLoopHandles = inferSharedPlaceTransitionHandles();

  transitionNames.forEach((transitionName) => {
    const connection = connections.get(transitionName);
    if (!connection) return;

    const transitionId = transitionIdByName.get(transitionName);
    if (!transitionId) {
      throw new Error("ppp_import_internal_node_mapping_error");
    }

    const outputPlaceSet = new Set(connection.outputPlaces);
    const inputPlaceSet = new Set(connection.inputPlaces);

    connection.inputPlaces.forEach((placeName) => {
      const placeId = placeIdByName.get(placeName);
      if (!placeId) {
        throw new Error("ppp_import_internal_node_mapping_error");
      }

      const handles = outputPlaceSet.has(placeName)
        ? sharedLoopHandles.placeToTransition
        : (() => {
            const placeNode = nodeById.get(placeId);
            const transitionNode = nodeById.get(transitionId);
            if (!placeNode || !transitionNode) {
              throw new Error("ppp_import_internal_node_mapping_error");
            }
            return inferArcHandles(placeNode, transitionNode);
          })();

      edges.push(
        createEdge(`ppp-edge-${edgeCounter++}`, placeId, transitionId, handles),
      );
    });

    connection.outputPlaces.forEach((placeName) => {
      const placeId = placeIdByName.get(placeName);
      if (!placeId) {
        throw new Error("ppp_import_internal_node_mapping_error");
      }

      const handles = inputPlaceSet.has(placeName)
        ? sharedLoopHandles.transitionToPlace
        : (() => {
            const transitionNode = nodeById.get(transitionId);
            const placeNode = nodeById.get(placeId);
            if (!transitionNode || !placeNode) {
              throw new Error("ppp_import_internal_node_mapping_error");
            }
            return inferArcHandles(transitionNode, placeNode);
          })();

      edges.push(
        createEdge(`ppp-edge-${edgeCounter++}`, transitionId, placeId, handles),
      );
    });
  });

  return {
    netId: "ppp-imported",
    netName: "PPP Imported Graph",
    nodes,
    edges,
  };
}

export type PppImportResult = GraphImportResult;
