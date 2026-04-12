type Point = {
  x: number;
  y: number;
};

export type LayoutNodeKind = "place" | "transition";

export type LayoutNode = {
  id: string;
  kind: LayoutNodeKind;
};

export type LayoutLink = {
  sourceId: string;
  targetId: string;
};

type ComputeGridLayoutOptions = {
  startX?: number;
  startY?: number;
  columnCount?: number;
  gapX?: number;
  gapY?: number;
};

export function computeGridLayout(
  ids: string[],
  {
    startX = 120,
    startY = 100,
    columnCount = 6,
    gapX = 220,
    gapY = 160,
  }: ComputeGridLayoutOptions = {},
) {
  const sortedIds = [...ids].sort((a, b) => a.localeCompare(b));
  const positions = new Map<string, Point>();

  sortedIds.forEach((id, index) => {
    const col = index % columnCount;
    const row = Math.floor(index / columnCount);
    positions.set(id, {
      x: startX + col * gapX,
      y: startY + row * gapY,
    });
  });

  return positions;
}

type ComputeClusteredBipartiteLayoutOptions = {
  startX?: number;
  startY?: number;
  columnGap?: number;
  rowGap?: number;
  componentGapX?: number;
  componentGapY?: number;
  maxRowWidth?: number;
};

function connectedComponents(nodeIds: string[], links: LayoutLink[]) {
  const adjacency = new Map<string, Set<string>>();
  nodeIds.forEach((id) => adjacency.set(id, new Set()));

  links.forEach(({ sourceId, targetId }) => {
    if (!adjacency.has(sourceId) || !adjacency.has(targetId)) return;
    adjacency.get(sourceId)?.add(targetId);
    adjacency.get(targetId)?.add(sourceId);
  });

  const visited = new Set<string>();
  const components: string[][] = [];

  nodeIds
    .slice()
    .sort((a, b) => a.localeCompare(b))
    .forEach((startId) => {
      if (visited.has(startId)) return;

      const queue: string[] = [startId];
      const component: string[] = [];
      visited.add(startId);

      while (queue.length > 0) {
        const currentId = queue.shift();
        if (!currentId) continue;
        component.push(currentId);

        const neighbors = adjacency.get(currentId);
        if (!neighbors) continue;

        Array.from(neighbors)
          .sort((a, b) => a.localeCompare(b))
          .forEach((neighborId) => {
            if (visited.has(neighborId)) return;
            visited.add(neighborId);
            queue.push(neighborId);
          });
      }

      components.push(component);
    });

  return components;
}

export function computeClusteredBipartiteLayout(
  nodes: LayoutNode[],
  links: LayoutLink[],
  {
    startX = 120,
    startY = 120,
    columnGap = 220,
    rowGap = 150,
    componentGapX = 240,
    componentGapY = 220,
    maxRowWidth = 2400,
  }: ComputeClusteredBipartiteLayoutOptions = {},
) {
  const positions = new Map<string, Point>();
  if (nodes.length === 0) {
    return positions;
  }

  const nodeKindById = new Map(nodes.map((node) => [node.id, node.kind]));
  const nodeIds = nodes.map((node) => node.id);
  const outgoingCount = new Map<string, number>();
  const incomingCount = new Map<string, number>();

  nodeIds.forEach((id) => {
    outgoingCount.set(id, 0);
    incomingCount.set(id, 0);
  });

  links.forEach(({ sourceId, targetId }) => {
    if (!outgoingCount.has(sourceId) || !incomingCount.has(targetId)) return;
    outgoingCount.set(sourceId, (outgoingCount.get(sourceId) ?? 0) + 1);
    incomingCount.set(targetId, (incomingCount.get(targetId) ?? 0) + 1);
  });

  const components = connectedComponents(nodeIds, links).sort((a, b) => {
    const aKey = a.slice().sort((x, y) => x.localeCompare(y))[0] ?? "";
    const bKey = b.slice().sort((x, y) => x.localeCompare(y))[0] ?? "";
    return aKey.localeCompare(bKey);
  });

  let cursorX = startX;
  let cursorY = startY;
  let rowMaxHeight = 0;

  components.forEach((componentNodeIds) => {
    const leftPlaces: string[] = [];
    const rightPlaces: string[] = [];
    const transitions: string[] = [];

    componentNodeIds
      .slice()
      .sort((a, b) => a.localeCompare(b))
      .forEach((id) => {
        const kind = nodeKindById.get(id);
        if (kind === "transition") {
          transitions.push(id);
          return;
        }

        if (kind === "place") {
          const outgoing = outgoingCount.get(id) ?? 0;
          const incoming = incomingCount.get(id) ?? 0;
          if (outgoing >= incoming) {
            leftPlaces.push(id);
          } else {
            rightPlaces.push(id);
          }
        }
      });

    const hasLeft = leftPlaces.length > 0;
    const hasRight = rightPlaces.length > 0;
    const maxRows = Math.max(leftPlaces.length, transitions.length, rightPlaces.length, 1);
    const componentHeight = Math.max(0, (maxRows - 1) * rowGap);
    const columnCount = hasLeft && hasRight ? 3 : 2;
    const componentWidth = Math.max(0, (columnCount - 1) * columnGap);

    if (cursorX > startX && cursorX + componentWidth > startX + maxRowWidth) {
      cursorX = startX;
      cursorY += rowMaxHeight + componentGapY;
      rowMaxHeight = 0;
    }

    const transitionX = hasLeft ? cursorX + columnGap : cursorX;
    const leftX = hasLeft ? cursorX : transitionX - columnGap;
    const rightX = hasRight ? transitionX + columnGap : transitionX + columnGap;

    const placeLeftOffset = ((maxRows - leftPlaces.length) * rowGap) / 2;
    const transitionOffset = ((maxRows - transitions.length) * rowGap) / 2;
    const placeRightOffset = ((maxRows - rightPlaces.length) * rowGap) / 2;

    leftPlaces.forEach((id, index) => {
      positions.set(id, {
        x: leftX,
        y: cursorY + placeLeftOffset + index * rowGap,
      });
    });

    transitions.forEach((id, index) => {
      positions.set(id, {
        x: transitionX,
        y: cursorY + transitionOffset + index * rowGap,
      });
    });

    rightPlaces.forEach((id, index) => {
      positions.set(id, {
        x: rightX,
        y: cursorY + placeRightOffset + index * rowGap,
      });
    });

    cursorX += componentWidth + componentGapX;
    rowMaxHeight = Math.max(rowMaxHeight, componentHeight);
  });

  return positions;
}
