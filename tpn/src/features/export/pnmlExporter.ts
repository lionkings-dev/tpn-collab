import type { Edge, Node } from "@xyflow/react";
import { formatPnmlXml } from "../../utils/pnmlFormat";

const PNML_NS = "http://www.pnml.org/version-2009/grammar/pnml";
const PT_NET_TYPE = "http://www.pnml.org/version-2009/grammar/ptnet";

type PlaceNodeData = {
  label?: string;
  tokens?: number;
};

type TransitionNodeData = {
  label?: string;
  lb?: number;
  ub?: number;
};

export type PnmlExportInput = {
  roomId: string;
  roomName?: string;
  nodes: Node[];
  edges: Edge[];
};

type XmlElement = Element;

function normalizeHandleValue(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function toInteger(value: unknown, fallback = 0) {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  return Math.max(0, Math.floor(value));
}

function toBinaryMarking(value: unknown) {
  const marking = toInteger(value, 0);
  if (marking !== 0 && marking !== 1) {
    throw new Error("pnml_export_invalid_initial_marking");
  }
  return marking;
}

function ensureExportGraphValidity(nodes: Node[], edges: Edge[]) {
  const ids = new Set<string>();
  for (const node of nodes) {
    if (!node.id) throw new Error("pnml_export_invalid_node_id");
    if (ids.has(node.id)) throw new Error("pnml_export_duplicate_node_id");
    ids.add(node.id);
    if (node.type !== "place" && node.type !== "transition") {
      throw new Error("pnml_export_unsupported_node_type");
    }
  }

  const edgeIds = new Set<string>();
  for (const edge of edges) {
    if (!edge.id) throw new Error("pnml_export_invalid_arc_id");
    if (edgeIds.has(edge.id)) throw new Error("pnml_export_duplicate_arc_id");
    edgeIds.add(edge.id);

    if (!ids.has(edge.source) || !ids.has(edge.target)) {
      throw new Error("pnml_export_arc_endpoint_not_found");
    }

    const sourceType = nodes.find((node) => node.id === edge.source)?.type;
    const targetType = nodes.find((node) => node.id === edge.target)?.type;
    if (!sourceType || !targetType || sourceType === targetType) {
      throw new Error("pnml_export_invalid_arc_direction");
    }
  }
}

export function exportPnml(input: PnmlExportInput): string {
  ensureExportGraphValidity(input.nodes, input.edges);

  const roomName = input.roomName?.trim() || input.roomId;

  const xmlDocument = new DOMParser().parseFromString(
    `<?xml version="1.0" encoding="UTF-8"?><pnml xmlns="${PNML_NS}" />`,
    "application/xml",
  );
  const pnml = xmlDocument.documentElement;
  const net = xmlDocument.createElementNS(PNML_NS, "net");
  net.setAttribute("id", input.roomId);
  net.setAttribute("type", PT_NET_TYPE);
  pnml.appendChild(net);

  const netNameElement = xmlDocument.createElementNS(PNML_NS, "name");
  netNameElement.appendChild(createTextElement(xmlDocument, "text", roomName));
  net.appendChild(netNameElement);

  const page = xmlDocument.createElementNS(PNML_NS, "page");
  page.setAttribute("id", `page-${input.roomId}`);
  net.appendChild(page);

  const appendGraphicsPosition = (parent: XmlElement, x: number, y: number) => {
    const graphics = xmlDocument.createElementNS(PNML_NS, "graphics");
    const position = xmlDocument.createElementNS(PNML_NS, "position");
    position.setAttribute("x", String(Math.round(x)));
    position.setAttribute("y", String(Math.round(y)));
    graphics.appendChild(position);
    parent.appendChild(graphics);
  };
  //append place and transition node
  for (const node of input.nodes) {
    //Append every place nodes first
    if (node.type === "place") {
      const data = (node.data || {}) as PlaceNodeData;
      const place = xmlDocument.createElementNS(PNML_NS, "place");
      place.setAttribute("id", node.id);

      const placeName = xmlDocument.createElementNS(PNML_NS, "name");
      placeName.appendChild(
        createTextElement(xmlDocument, "text", data.label?.trim() || node.id),
      );
      place.appendChild(placeName);

      appendGraphicsPosition(place, node.position.x, node.position.y);

      const marking = toBinaryMarking(data.tokens);
      const initialMarking = xmlDocument.createElementNS(
        PNML_NS,
        "initialMarking",
      );
      initialMarking.appendChild(
        createTextElement(xmlDocument, "text", String(marking)),
      );
      place.appendChild(initialMarking);
      page.appendChild(place);

      continue;
    }

    const data = (node.data || {}) as TransitionNodeData;
    const transition = xmlDocument.createElementNS(PNML_NS, "transition");
    transition.setAttribute("id", node.id);

    const transitionName = xmlDocument.createElementNS(PNML_NS, "name");
    transitionName.appendChild(
      createTextElement(xmlDocument, "text", data.label?.trim() || node.id),
    );
    transition.appendChild(transitionName);

    appendGraphicsPosition(transition, node.position.x, node.position.y);

    const lb = toInteger(data.lb, 0);
    const ub = toInteger(data.ub, 0);
    // lb,ub using toolspecific
    const toolSpecific = xmlDocument.createElementNS(PNML_NS, "toolspecific");
    toolSpecific.setAttribute("tool", "tpn-collab");
    toolSpecific.setAttribute("version", "1.0");
    const timeInterval = xmlDocument.createElementNS(PNML_NS, "timeInterval");
    timeInterval.appendChild(createTextElement(xmlDocument, "lb", String(lb)));
    timeInterval.appendChild(
      createTextElement(xmlDocument, "ub", String(Math.max(lb, ub))),
    );
    toolSpecific.appendChild(timeInterval);
    transition.appendChild(toolSpecific);
    page.appendChild(transition);
  }
  //connect edge with source and target data
  for (const edge of input.edges) {
    const arc = xmlDocument.createElementNS(PNML_NS, "arc");
    arc.setAttribute("id", edge.id);
    arc.setAttribute("source", edge.source);
    arc.setAttribute("target", edge.target);

    const weight =
      typeof edge.data === "object" &&
      edge.data &&
      "weight" in edge.data &&
      typeof edge.data.weight === "number"
        ? Math.max(1, Math.floor(edge.data.weight))
        : 1;

    const inscription = xmlDocument.createElementNS(PNML_NS, "inscription");
    inscription.appendChild(
      createTextElement(xmlDocument, "text", String(weight)),
    );
    arc.appendChild(inscription);

    const sourceHandle = normalizeHandleValue(edge.sourceHandle);
    const targetHandle = normalizeHandleValue(edge.targetHandle);
    if (sourceHandle || targetHandle) {
      const toolSpecific = xmlDocument.createElementNS(PNML_NS, "toolspecific");
      toolSpecific.setAttribute("tool", "tpn-collab");
      toolSpecific.setAttribute("version", "1.0");

      if (sourceHandle) {
        toolSpecific.appendChild(
          createTextElement(xmlDocument, "sourceHandle", sourceHandle),
        );
      }

      if (targetHandle) {
        toolSpecific.appendChild(
          createTextElement(xmlDocument, "targetHandle", targetHandle),
        );
      }

      arc.appendChild(toolSpecific);
    }

    page.appendChild(arc);
  }

  const serializer = new XMLSerializer();
  const serialized = serializer.serializeToString(xmlDocument);
  const hasXmlDeclaration = serialized.trimStart().startsWith("<?xml");
  const xmlOutput = hasXmlDeclaration
    ? serialized
    : `<?xml version="1.0" encoding="UTF-8"?>\n${serialized}`;
  return formatPnmlXml(xmlOutput);
}

function createTextElement(
  xmlDocument: XMLDocument,
  name: string,
  value: string,
) {
  const element = xmlDocument.createElementNS(PNML_NS, name);
  element.textContent = value;
  return element;
}
