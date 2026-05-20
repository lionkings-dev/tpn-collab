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

type BlockKind = "module" | "spec";

type RawBlock = {
  kind: BlockKind;
  slug: string;
  inputs: string[];
  outputs: string[];
  body: string;
  declarationIndex: number;
};

type ParsedBlock = {
  kind: BlockKind;
  slug: string;
  inputs: string[];
  outputs: string[];
  placeNames: string[];
  transitionNames: string[];
  tokenNames: string[];
  connections: Map<string, ParsedConnection>;
  definitions: ParsedDefinition[];
  declarationIndex: number;
};

const CONNECTION_RE =
  /^([^\s[]+)\s*(?:\[\s*([^,\]]+)\s*,\s*([^\]]+)\s*\])?\s*\(([^)]*)\)\s*\/\s*\(([^)]*)\)\s*;$/;
const DEFINITION_RE = /^([^\s=]+)\s*=\s*\(([^)]*)\)\s*;$/;
const MODULE_HEADER_RE = /^module\s+([^\s(]+)\s*\(([^)]*)\)\s*\{/i;
const SPEC_HEADER_RE = /^spec\s*\(([^)]*)\)\s*\{/i;
const SPEC_RESERVED_SLUG = "spec";
const MODULE_VERTICAL_GAP = 200;
const MODULE_DEFAULT_HEIGHT = 220;

function stripComments(content: string) {
  return content
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");
}

function parseCsvList(segment: string) {
  const normalized = segment.trim();
  if (!normalized) return [];
  return normalized
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

function parseHeaderSignature(rawHeader: string) {
  const semicolonIndex = rawHeader.indexOf(";");
  if (semicolonIndex < 0) {
    return {
      inputs: [] as string[],
      outputs: parseCsvList(rawHeader),
    };
  }

  return {
    inputs: parseCsvList(rawHeader.slice(0, semicolonIndex)),
    outputs: parseCsvList(rawHeader.slice(semicolonIndex + 1)),
  };
}

function scanBlocks(content: string): RawBlock[] {
  const blocks: RawBlock[] = [];
  let cursor = 0;
  let declarationIndex = 0;

  while (cursor < content.length) {
    while (cursor < content.length && /\s/.test(content[cursor])) {
      cursor += 1;
    }
    if (cursor >= content.length) break;

    const remainder = content.slice(cursor);
    const moduleMatch = remainder.match(MODULE_HEADER_RE);
    const specMatch = remainder.match(SPEC_HEADER_RE);

    let chosen: { kind: BlockKind; match: RegExpMatchArray } | null = null;
    if (moduleMatch) {
      chosen = { kind: "module", match: moduleMatch };
    } else if (specMatch) {
      chosen = { kind: "spec", match: specMatch };
    }

    if (!chosen) {
      throw new Error("ppp_import_invalid_root");
    }

    const headerEnd = chosen.match[0].length;
    const bodyStart = cursor + headerEnd;
    const closeBraceIndex = findMatchingClose(content, bodyStart - 1);
    if (closeBraceIndex < 0) {
      throw new Error("ppp_import_unterminated_block");
    }

    const body = content.slice(bodyStart, closeBraceIndex);

    if (chosen.kind === "module") {
      const slug = chosen.match[1].trim();
      if (!slug) {
        throw new Error("ppp_import_invalid_module_header");
      }
      if (slug.toLowerCase() === SPEC_RESERVED_SLUG) {
        throw new Error("ppp_import_module_slug_reserved");
      }
      const signature = parseHeaderSignature(chosen.match[2]);
      blocks.push({
        kind: "module",
        slug,
        inputs: signature.inputs,
        outputs: signature.outputs,
        body,
        declarationIndex: declarationIndex++,
      });
    } else {
      const signature = parseHeaderSignature(chosen.match[1]);
      blocks.push({
        kind: "spec",
        slug: SPEC_RESERVED_SLUG,
        inputs: signature.inputs,
        outputs: signature.outputs,
        body,
        declarationIndex: declarationIndex++,
      });
    }

    cursor = closeBraceIndex + 1;
  }

  if (blocks.length === 0) {
    throw new Error("ppp_import_invalid_root");
  }

  return blocks;
}

function findMatchingClose(content: string, openBraceIndex: number) {
  let depth = 0;
  for (let i = openBraceIndex; i < content.length; i += 1) {
    const ch = content[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
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

function parseBlockBody(raw: RawBlock): ParsedBlock {
  const lines = raw.body
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

  raw.inputs.forEach((name) => {
    if (!transitionSet.has(name)) {
      throw new Error("ppp_import_signature_transition_not_found");
    }
  });
  raw.outputs.forEach((name) => {
    if (!transitionSet.has(name)) {
      throw new Error("ppp_import_signature_transition_not_found");
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

  return {
    kind: raw.kind,
    slug: raw.slug,
    inputs: raw.inputs,
    outputs: raw.outputs,
    placeNames,
    transitionNames,
    tokenNames,
    connections,
    definitions,
    declarationIndex: raw.declarationIndex,
  };
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

function classifyModuleRole(
  transitionName: string,
  inputs: Set<string>,
  outputs: Set<string>,
): "input" | "output" | "internal" {
  if (inputs.has(transitionName)) return "input";
  if (outputs.has(transitionName)) return "output";
  return "internal";
}

export function importPpp(content: string): GraphImportResult {
  if (!content.trim()) {
    throw new Error("ppp_import_empty_content");
  }

  const stripped = stripComments(content);
  const rawBlocks = scanBlocks(stripped);

  const seenSlugs = new Set<string>();
  let specCount = 0;
  rawBlocks.forEach((block) => {
    if (block.kind === "spec") {
      specCount += 1;
      if (specCount > 1) {
        throw new Error("ppp_import_duplicate_spec_block");
      }
    }
    if (seenSlugs.has(block.slug)) {
      throw new Error("ppp_import_duplicate_module");
    }
    seenSlugs.add(block.slug);
  });

  const parsedBlocks = rawBlocks.map(parseBlockBody);

  parsedBlocks.sort((a, b) => {
    if (a.kind !== b.kind) {
      return a.kind === "spec" ? 1 : -1;
    }
    return a.declarationIndex - b.declarationIndex;
  });

  const nodes: Node[] = [];
  const edges: Edge[] = [];
  let edgeCounter = 1;
  const sharedLoopHandles = inferSharedPlaceTransitionHandles();
  let cursorY = 120;

  parsedBlocks.forEach((block) => {
    const placeIdByName = new Map(
      block.placeNames.map((name, index) => [
        name,
        `ppp-${block.slug}-place-${index + 1}`,
      ]),
    );
    const transitionIdByName = new Map(
      block.transitionNames.map((name, index) => [
        name,
        `ppp-${block.slug}-transition-${index + 1}`,
      ]),
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

    const layoutLinks = block.transitionNames.flatMap((transitionName) => {
      const transitionId = transitionIdByName.get(transitionName);
      const connection = block.connections.get(transitionName);
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
    block.placeNames.forEach((placeName, index) => {
      const placeId = placeIdByName.get(placeName);
      if (!placeId) return;
      orderHint.set(placeId, index);
    });
    block.transitionNames.forEach((transitionName, index) => {
      const transitionId = transitionIdByName.get(transitionName);
      if (!transitionId) return;
      orderHint.set(transitionId, block.placeNames.length + index);
    });

    const positions = computeClusteredBipartiteLayout(layoutNodes, layoutLinks, {
      startX: 140,
      startY: cursorY,
      columnGap: 220,
      rowGap: 150,
      componentGapX: 260,
      componentGapY: 220,
      orderHint,
    });

    const tokenSet = new Set(block.tokenNames);
    const inputsSet = new Set(block.inputs);
    const outputsSet = new Set(block.outputs);
    const blockNodeIds: string[] = [];

    block.placeNames.forEach((placeName) => {
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
          pppModule: block.slug,
        },
      });
      blockNodeIds.push(id);
    });

    block.transitionNames.forEach((transitionName) => {
      const id = transitionIdByName.get(transitionName);
      const position = id ? positions.get(id) : null;
      if (!id || !position) {
        throw new Error("ppp_import_internal_position_error");
      }

      const connection = block.connections.get(transitionName);
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
          pppModule: block.slug,
          pppModuleKind: block.kind,
          pppModuleRole: classifyModuleRole(transitionName, inputsSet, outputsSet),
        },
      });
      blockNodeIds.push(id);
    });

    const nodeById = new Map(
      nodes.filter((node) => blockNodeIds.includes(node.id)).map((node) => [node.id, node]),
    );

    block.transitionNames.forEach((transitionName) => {
      const connection = block.connections.get(transitionName);
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

    const blockMaxY = blockNodeIds.reduce((acc, id) => {
      const pos = positions.get(id);
      if (!pos) return acc;
      return Math.max(acc, pos.y);
    }, cursorY);
    const advancedY = blockMaxY > cursorY ? blockMaxY : cursorY + MODULE_DEFAULT_HEIGHT;
    cursorY = advancedY + MODULE_VERTICAL_GAP;
  });

  const netName = parsedBlocks
    .map((block) => (block.kind === "spec" ? "spec" : `module ${block.slug}`))
    .join(", ");

  return {
    netId: "ppp-imported",
    netName: netName || "PPP Imported Graph",
    nodes,
    edges,
  };
}

export type PppImportResult = GraphImportResult;
