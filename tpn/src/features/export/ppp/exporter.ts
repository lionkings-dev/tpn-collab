import type { Node } from "@xyflow/react";

import type { GraphExportInput } from "../core/types";

const PPP_INFINITY_ALIAS = 9999;
const PPP_UNSAFE_NAME_RE = /[,\s/()[\];=]/;
const SPEC_RESERVED_SLUG = "spec";

type TransitionBound = number | null;
type ModuleRole = "input" | "output" | "internal";
type BlockKind = "module" | "spec";

type PlaceData = {
  label?: string;
  tokens?: number;
  pppModule?: string;
};

type TransitionData = {
  label?: string;
  lb?: number | null;
  ub?: number | null;
  pppModule?: string;
  pppModuleKind?: BlockKind;
  pppModuleRole?: ModuleRole;
};

type PlaceEntry = {
  id: string;
  name: string;
  tokens: number;
};

type TransitionEntry = {
  id: string;
  name: string;
  data: TransitionData;
  inputPlaces: Set<string>;
  outputPlaces: Set<string>;
  role: ModuleRole;
};

type ExportBlock = {
  kind: BlockKind;
  slug: string;
  places: PlaceEntry[];
  transitions: TransitionEntry[];
  declarationIndex: number;
};

function normalizeName(value: unknown, fallback: string) {
  const candidate = typeof value === "string" ? value.trim() : "";
  return candidate || fallback;
}

function validatePppSafeName(name: string, errorCode: string) {
  if (!name || PPP_UNSAFE_NAME_RE.test(name)) {
    throw new Error(errorCode);
  }
}

function normalizeTransitionBound(
  value: unknown,
  fallback: TransitionBound,
): TransitionBound {
  if (value === null) return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.floor(value));
  }
  return fallback;
}

function formatTransitionBound(bound: TransitionBound) {
  return bound === null ? String(PPP_INFINITY_ALIAS) : String(bound);
}

function assertTransitionInterval(lb: TransitionBound, ub: TransitionBound) {
  if (lb === null && ub !== null) {
    throw new Error("ppp_export_invalid_transition_interval");
  }

  if (lb !== null && ub !== null && lb > ub) {
    throw new Error("ppp_export_invalid_transition_interval");
  }
}

function resolveTransitionInterval(data: TransitionData) {
  const hasLb = data.lb !== undefined;
  const hasUb = data.ub !== undefined;

  const lb = normalizeTransitionBound(data.lb, 0);
  const ubFallback = hasUb ? lb : hasLb ? lb : null;
  const ub = normalizeTransitionBound(data.ub, ubFallback);

  assertTransitionInterval(lb, ub);

  return { lb, ub };
}

function sortUnique(values: Iterable<string>) {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

function resolveBlockKind(slug: string, hintedKind: BlockKind | undefined): BlockKind {
  if (slug === SPEC_RESERVED_SLUG) return "spec";
  return hintedKind ?? "module";
}

function compareBlocks(a: ExportBlock, b: ExportBlock) {
  if (a.kind !== b.kind) {
    return a.kind === "spec" ? 1 : -1;
  }
  if (a.declarationIndex !== b.declarationIndex) {
    return a.declarationIndex - b.declarationIndex;
  }
  return a.slug.localeCompare(b.slug);
}

function emitBlock(block: ExportBlock, lines: string[]) {
  const sortedTransitions = block.transitions.slice();
  const transitionNames = sortedTransitions.map((entry) => entry.name);
  const placeNames = block.places.map((entry) => entry.name);

  const tokenPlaces = sortUnique(
    block.places.filter((entry) => entry.tokens === 1).map((entry) => entry.name),
  );

  const moduleInputs = sortedTransitions
    .filter((entry) => entry.role === "input")
    .map((entry) => entry.name);
  const moduleOutputs = sortedTransitions
    .filter((entry) => entry.role === "output")
    .map((entry) => entry.name);

  if (block.kind === "module") {
    const inputs = sortUnique(moduleInputs);
    const outputs = sortUnique(moduleOutputs);
    lines.push(`module ${block.slug}(${inputs.join(",")};${outputs.join(",")}){`);
  } else {
    const outputs = sortUnique(
      sortedTransitions
        .filter((entry) => entry.role !== "input")
        .map((entry) => entry.name),
    );
    lines.push(`spec(;${outputs.join(",")}){`);
  }

  lines.push(`place (${placeNames.join(",")});`);
  lines.push(`trans(${transitionNames.join(",")});`);
  lines.push(`token(${tokenPlaces.join(",")});`);

  sortedTransitions.forEach((transition) => {
    const { lb, ub } = resolveTransitionInterval(transition.data);
    const inputPlaces = sortUnique(transition.inputPlaces);
    const outputPlaces = sortUnique(transition.outputPlaces);

    const intervalSegment =
      lb === 0 && ub === null
        ? ""
        : ` [${formatTransitionBound(lb)},${formatTransitionBound(ub)}]`;

    lines.push(
      `${transition.name}${intervalSegment} (${inputPlaces.join(",")})/(${outputPlaces.join(",")});`,
    );
  });

  sortedTransitions.forEach((transition) => {
    lines.push(`${transition.name}=(${transition.name});`);
  });

  lines.push("}");
}

export function exportPpp(input: GraphExportInput) {
  const nodeById = new Map(input.nodes.map((node) => [node.id, node]));

  const blockBySlug = new Map<string, ExportBlock>();
  const placeIdToBlock = new Map<string, string>();
  const transitionIdToBlock = new Map<string, string>();
  let nextDeclarationIndex = 0;

  function ensureBlock(slug: string, hintedKind?: BlockKind) {
    const existing = blockBySlug.get(slug);
    if (existing) return existing;
    const block: ExportBlock = {
      kind: resolveBlockKind(slug, hintedKind),
      slug,
      places: [],
      transitions: [],
      declarationIndex: nextDeclarationIndex++,
    };
    blockBySlug.set(slug, block);
    return block;
  }

  input.nodes
    .filter((node) => node.type === "place")
    .forEach((node) => {
      const data = (node.data ?? {}) as PlaceData;
      const slug = (data.pppModule ?? SPEC_RESERVED_SLUG).trim() || SPEC_RESERVED_SLUG;
      const block = ensureBlock(slug);
      const name = normalizeName(data.label, node.id);
      validatePppSafeName(name, "ppp_export_invalid_place_name");
      const tokens = data.tokens ?? 0;
      if (tokens < 0) {
        throw new Error("ppp_export_unsupported_multi_token");
      }
      if (tokens > 1) {
        throw new Error("ppp_export_unsupported_multi_token");
      }
      block.places.push({ id: node.id, name, tokens });
      placeIdToBlock.set(node.id, slug);
    });

  input.nodes
    .filter((node) => node.type === "transition")
    .forEach((node) => {
      const data = (node.data ?? {}) as TransitionData;
      const slug = (data.pppModule ?? SPEC_RESERVED_SLUG).trim() || SPEC_RESERVED_SLUG;
      const block = ensureBlock(slug, data.pppModuleKind);
      const name = normalizeName(data.label, node.id);
      validatePppSafeName(name, "ppp_export_invalid_transition_name");
      block.transitions.push({
        id: node.id,
        name,
        data,
        inputPlaces: new Set<string>(),
        outputPlaces: new Set<string>(),
        role: data.pppModuleRole ?? "internal",
      });
      transitionIdToBlock.set(node.id, slug);
    });

  blockBySlug.forEach((block) => {
    const placeNameSet = new Set<string>();
    block.places.forEach(({ name }) => {
      if (placeNameSet.has(name)) {
        throw new Error("ppp_export_duplicate_place_name");
      }
      placeNameSet.add(name);
    });

    const transitionNameSet = new Set<string>();
    block.transitions.forEach(({ name }) => {
      if (transitionNameSet.has(name)) {
        throw new Error("ppp_export_duplicate_transition_name");
      }
      transitionNameSet.add(name);
    });
  });

  if (blockBySlug.size === 0) {
    const fallback = ensureBlock(SPEC_RESERVED_SLUG);
    void fallback;
  }

  const placeNameById = new Map<string, string>();
  blockBySlug.forEach((block) => {
    block.places.forEach((entry) => placeNameById.set(entry.id, entry.name));
  });

  const transitionEntryById = new Map<string, TransitionEntry>();
  blockBySlug.forEach((block) => {
    block.transitions.forEach((entry) => transitionEntryById.set(entry.id, entry));
  });

  input.edges.forEach((edge) => {
    const sourceNode = nodeById.get(edge.source);
    const targetNode = nodeById.get(edge.target);
    if (!sourceNode || !targetNode) {
      throw new Error("ppp_export_arc_endpoint_not_found");
    }

    if (sourceNode.type === "place" && targetNode.type === "transition") {
      const placeBlock = placeIdToBlock.get(sourceNode.id);
      const transitionBlock = transitionIdToBlock.get(targetNode.id);
      if (!placeBlock || !transitionBlock) {
        throw new Error("ppp_export_arc_endpoint_not_found");
      }
      if (placeBlock !== transitionBlock) {
        throw new Error("ppp_export_cross_module_arc");
      }
      const transition = transitionEntryById.get(targetNode.id);
      const placeName = placeNameById.get(sourceNode.id);
      if (!transition || !placeName) {
        throw new Error("ppp_export_arc_endpoint_not_found");
      }
      transition.inputPlaces.add(placeName);
      return;
    }

    if (sourceNode.type === "transition" && targetNode.type === "place") {
      const transitionBlock = transitionIdToBlock.get(sourceNode.id);
      const placeBlock = placeIdToBlock.get(targetNode.id);
      if (!transitionBlock || !placeBlock) {
        throw new Error("ppp_export_arc_endpoint_not_found");
      }
      if (placeBlock !== transitionBlock) {
        throw new Error("ppp_export_cross_module_arc");
      }
      const transition = transitionEntryById.get(sourceNode.id);
      const placeName = placeNameById.get(targetNode.id);
      if (!transition || !placeName) {
        throw new Error("ppp_export_arc_endpoint_not_found");
      }
      transition.outputPlaces.add(placeName);
      return;
    }

    throw new Error("ppp_export_invalid_arc_direction");
  });

  blockBySlug.forEach((block) => {
    block.places.sort((a, b) => a.name.localeCompare(b.name));
    block.transitions.sort((a, b) => a.name.localeCompare(b.name));
  });

  const orderedBlocks = Array.from(blockBySlug.values()).sort(compareBlocks);

  const lines: string[] = [];
  orderedBlocks.forEach((block, index) => {
    if (index > 0) {
      lines.push("");
    }
    emitBlock(block, lines);
  });

  return `${lines.join("\n")}\n`;
}

export type PppExportInput = GraphExportInput;

// Re-export utility for tests that need to introspect node typing.
export type PppNode = Node;
