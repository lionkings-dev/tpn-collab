import type { GraphExportInput } from "../core/types";

const PPP_INFINITY_ALIAS = 9999;

type TransitionBound = number | null;

type PlaceData = {
  label?: string;
  tokens?: number;
};

type TransitionData = {
  label?: string;
  lb?: number | null;
  ub?: number | null;
};

function normalizeName(value: unknown, fallback: string) {
  const candidate = typeof value === "string" ? value.trim() : "";
  return candidate || fallback;
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

export function exportPpp(input: GraphExportInput) {
  const placeNodes = input.nodes.filter((node) => node.type === "place");
  const transitionNodes = input.nodes.filter((node) => node.type === "transition");
  const nodeById = new Map(input.nodes.map((node) => [node.id, node]));

  const placeEntries = placeNodes.map((node) => ({
    id: node.id,
    name: normalizeName((node.data as PlaceData | undefined)?.label, node.id),
    data: (node.data || {}) as PlaceData,
  }));
  const transitionEntries = transitionNodes.map((node) => ({
    id: node.id,
    name: normalizeName((node.data as TransitionData | undefined)?.label, node.id),
    data: (node.data || {}) as TransitionData,
  }));

  const placeNameSet = new Set<string>();
  placeEntries.forEach(({ name }) => {
    if (placeNameSet.has(name)) {
      throw new Error("ppp_export_duplicate_place_name");
    }
    placeNameSet.add(name);
  });

  const transitionNameSet = new Set<string>();
  transitionEntries.forEach(({ name }) => {
    if (transitionNameSet.has(name)) {
      throw new Error("ppp_export_duplicate_transition_name");
    }
    transitionNameSet.add(name);
  });

  const placeNameById = new Map(placeEntries.map(({ id, name }) => [id, name]));
  const transitionById = new Map(
    transitionEntries.map(({ id, name, data }) => [
      id,
      {
        name,
        data,
        inputPlaces: new Set<string>(),
        outputPlaces: new Set<string>(),
      },
    ]),
  );

  input.edges.forEach((edge) => {
    const sourceNode = nodeById.get(edge.source);
    const targetNode = nodeById.get(edge.target);
    if (!sourceNode || !targetNode) {
      throw new Error("ppp_export_arc_endpoint_not_found");
    }

    if (sourceNode.type === "place" && targetNode.type === "transition") {
      const transition = transitionById.get(targetNode.id);
      const placeName = placeNameById.get(sourceNode.id);
      if (!transition || !placeName) {
        throw new Error("ppp_export_arc_endpoint_not_found");
      }
      transition.inputPlaces.add(placeName);
      return;
    }

    if (sourceNode.type === "transition" && targetNode.type === "place") {
      const transition = transitionById.get(sourceNode.id);
      const placeName = placeNameById.get(targetNode.id);
      if (!transition || !placeName) {
        throw new Error("ppp_export_arc_endpoint_not_found");
      }
      transition.outputPlaces.add(placeName);
      return;
    }

    throw new Error("ppp_export_invalid_arc_direction");
  });

  const sortedPlaces = [...placeEntries].sort((a, b) => a.name.localeCompare(b.name));
  const sortedTransitions = [...transitionEntries].sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  const placeNames = sortedPlaces.map((entry) => entry.name);
  const transitionNames = sortedTransitions.map((entry) => entry.name);
  const tokenPlaces = sortUnique(
    sortedPlaces
      .filter((entry) => (entry.data.tokens ?? 0) === 1)
      .map((entry) => entry.name),
  );

  const lines: string[] = [];
  lines.push(`spec(;${transitionNames.join(",")}){`);
  lines.push(`place (${placeNames.join(",")});`);
  lines.push(`trans(${transitionNames.join(",")});`);
  lines.push(`token(${tokenPlaces.join(",")});`);

  sortedTransitions.forEach((transitionEntry) => {
    const transition = transitionById.get(transitionEntry.id);
    if (!transition) return;

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

  sortedTransitions.forEach((transitionEntry) => {
    lines.push(`${transitionEntry.name}=(${transitionEntry.name});`);
  });

  lines.push("}");

  return `${lines.join("\n")}\n`;
}

export type PppExportInput = GraphExportInput;
