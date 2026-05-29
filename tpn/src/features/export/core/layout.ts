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
  orderHint?: ReadonlyMap<string, number>;
};

function compareIds(
  left: string,
  right: string,
  orderHint?: ReadonlyMap<string, number>,
) {
  const leftRank = orderHint?.get(left);
  const rightRank = orderHint?.get(right);

  if (leftRank !== undefined && rightRank !== undefined && leftRank !== rightRank) {
    return leftRank - rightRank;
  }

  if (leftRank !== undefined && rightRank === undefined) {
    return -1;
  }

  if (leftRank === undefined && rightRank !== undefined) {
    return 1;
  }

  return left.localeCompare(right);
}

function sortIds(ids: string[], orderHint?: ReadonlyMap<string, number>) {
  return ids.slice().sort((a, b) => compareIds(a, b, orderHint));
}

function connectedComponents(
  nodeIds: string[],
  adjacency: Map<string, Set<string>>,
  orderHint?: ReadonlyMap<string, number>,
) {
  const orderedNodeIds = sortIds(nodeIds, orderHint);
  const visited = new Set<string>();
  const components: string[][] = [];

  orderedNodeIds.forEach((startId) => {
    if (visited.has(startId)) return;

    const queue: string[] = [startId];
    const component: string[] = [];
    visited.add(startId);

    for (let index = 0; index < queue.length; index += 1) {
      const currentId = queue[index];
      component.push(currentId);

      const neighbors = adjacency.get(currentId);
      if (!neighbors) continue;

      sortIds(Array.from(neighbors), orderHint).forEach((neighborId) => {
        if (visited.has(neighborId)) return;
        visited.add(neighborId);
        queue.push(neighborId);
      });
    }

    components.push(component);
  });

  return components;
}

function choosePivotNode(
  componentNodeIds: string[],
  nodeKindById: Map<string, LayoutNodeKind>,
  outgoingCount: Map<string, number>,
  incomingCount: Map<string, number>,
  orderHint?: ReadonlyMap<string, number>,
) {
  const placeIds = componentNodeIds.filter((id) => nodeKindById.get(id) === "place");
  const candidates = placeIds.length > 0 ? placeIds : componentNodeIds;

  const sortedCandidates = candidates.slice().sort((left, right) => {
    const leftScore = (outgoingCount.get(left) ?? 0) - (incomingCount.get(left) ?? 0);
    const rightScore =
      (outgoingCount.get(right) ?? 0) - (incomingCount.get(right) ?? 0);
    if (leftScore !== rightScore) return rightScore - leftScore;

    const leftIncoming = incomingCount.get(left) ?? 0;
    const rightIncoming = incomingCount.get(right) ?? 0;
    if (leftIncoming !== rightIncoming) return leftIncoming - rightIncoming;

    return compareIds(left, right, orderHint);
  });

  return sortedCandidates[0] ?? componentNodeIds[0];
}

function computeDepthsFromPivot(
  pivotId: string,
  adjacency: Map<string, Set<string>>,
  orderHint?: ReadonlyMap<string, number>,
) {
  const depths = new Map<string, number>([[pivotId, 0]]);
  const queue: string[] = [pivotId];

  for (let index = 0; index < queue.length; index += 1) {
    const currentId = queue[index];
    const currentDepth = depths.get(currentId) ?? 0;
    const neighbors = adjacency.get(currentId);
    if (!neighbors) continue;

    sortIds(Array.from(neighbors), orderHint).forEach((neighborId) => {
      if (depths.has(neighborId)) return;
      depths.set(neighborId, currentDepth + 1);
      queue.push(neighborId);
    });
  }

  return depths;
}

function sortColumnByNeighbors(
  columnIds: string[],
  neighborColumnSet: Set<string>,
  adjacency: Map<string, Set<string>>,
  neighborIndexById: Map<string, number>,
  outgoingCount: Map<string, number>,
  incomingCount: Map<string, number>,
  orderHint?: ReadonlyMap<string, number>,
) {
  const barycenterById = new Map<string, number>();

  columnIds.forEach((id) => {
    const neighbors = adjacency.get(id);
    if (!neighbors) {
      barycenterById.set(id, Number.POSITIVE_INFINITY);
      return;
    }

    const anchorIndexes = Array.from(neighbors)
      .filter((neighborId) => neighborColumnSet.has(neighborId))
      .map((neighborId) => neighborIndexById.get(neighborId))
      .filter((index): index is number => index !== undefined);

    if (anchorIndexes.length === 0) {
      barycenterById.set(id, Number.POSITIVE_INFINITY);
      return;
    }

    const sum = anchorIndexes.reduce((acc, index) => acc + index, 0);
    barycenterById.set(id, sum / anchorIndexes.length);
  });

  return columnIds.slice().sort((left, right) => {
    const leftBarycenter = barycenterById.get(left) ?? Number.POSITIVE_INFINITY;
    const rightBarycenter = barycenterById.get(right) ?? Number.POSITIVE_INFINITY;

    const leftFinite = Number.isFinite(leftBarycenter);
    const rightFinite = Number.isFinite(rightBarycenter);

    if (leftFinite && rightFinite && leftBarycenter !== rightBarycenter) {
      return leftBarycenter - rightBarycenter;
    }

    if (leftFinite !== rightFinite) {
      return leftFinite ? -1 : 1;
    }

    const leftScore = (outgoingCount.get(left) ?? 0) - (incomingCount.get(left) ?? 0);
    const rightScore =
      (outgoingCount.get(right) ?? 0) - (incomingCount.get(right) ?? 0);
    if (leftScore !== rightScore) {
      return rightScore - leftScore;
    }

    return compareIds(left, right, orderHint);
  });
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
    orderHint,
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
  const undirectedAdjacency = new Map<string, Set<string>>();

  nodeIds.forEach((id) => {
    outgoingCount.set(id, 0);
    incomingCount.set(id, 0);
    undirectedAdjacency.set(id, new Set());
  });

  links.forEach(({ sourceId, targetId }) => {
    if (!outgoingCount.has(sourceId) || !incomingCount.has(targetId)) return;

    outgoingCount.set(sourceId, (outgoingCount.get(sourceId) ?? 0) + 1);
    incomingCount.set(targetId, (incomingCount.get(targetId) ?? 0) + 1);

    undirectedAdjacency.get(sourceId)?.add(targetId);
    undirectedAdjacency.get(targetId)?.add(sourceId);
  });

  const components = connectedComponents(nodeIds, undirectedAdjacency, orderHint).sort(
    (left, right) => {
      const leftKey = sortIds(left, orderHint)[0] ?? "";
      const rightKey = sortIds(right, orderHint)[0] ?? "";
      return compareIds(leftKey, rightKey, orderHint);
    },
  );

  let cursorX = startX;
  let cursorY = startY;
  let rowMaxHeight = 0;

  components.forEach((componentNodeIds) => {
    const orderedComponentNodeIds = sortIds(componentNodeIds, orderHint);
    const componentSet = new Set(orderedComponentNodeIds);

    const componentAdjacency = new Map<string, Set<string>>();
    orderedComponentNodeIds.forEach((id) => {
      const neighbors = undirectedAdjacency.get(id) ?? new Set<string>();
      componentAdjacency.set(
        id,
        new Set(
          Array.from(neighbors).filter((neighborId) => componentSet.has(neighborId)),
        ),
      );
    });

    const pivotId = choosePivotNode(
      orderedComponentNodeIds,
      nodeKindById,
      outgoingCount,
      incomingCount,
      orderHint,
    );

    const depths = computeDepthsFromPivot(pivotId, componentAdjacency, orderHint);

    const columns = new Map<number, string[]>();
    orderedComponentNodeIds.forEach((id) => {
      const depth = depths.get(id) ?? 0;
      const column = columns.get(depth) ?? [];
      column.push(id);
      columns.set(depth, column);
    });

    const sortedDepths = Array.from(columns.keys()).sort((a, b) => a - b);

    sortedDepths.forEach((depth) => {
      columns.set(depth, sortIds(columns.get(depth) ?? [], orderHint));
    });

    for (let depthIndex = 1; depthIndex < sortedDepths.length; depthIndex += 1) {
      const depth = sortedDepths[depthIndex];
      const previousDepth = sortedDepths[depthIndex - 1];
      const column = columns.get(depth) ?? [];
      const previousColumn = columns.get(previousDepth) ?? [];

      const previousIndexById = new Map(
        previousColumn.map((id, index) => [id, index]),
      );

      columns.set(
        depth,
        sortColumnByNeighbors(
          column,
          new Set(previousColumn),
          componentAdjacency,
          previousIndexById,
          outgoingCount,
          incomingCount,
          orderHint,
        ),
      );
    }

    for (let depthIndex = sortedDepths.length - 2; depthIndex >= 0; depthIndex -= 1) {
      const depth = sortedDepths[depthIndex];
      const nextDepth = sortedDepths[depthIndex + 1];
      const column = columns.get(depth) ?? [];
      const nextColumn = columns.get(nextDepth) ?? [];

      const nextIndexById = new Map(nextColumn.map((id, index) => [id, index]));

      columns.set(
        depth,
        sortColumnByNeighbors(
          column,
          new Set(nextColumn),
          componentAdjacency,
          nextIndexById,
          outgoingCount,
          incomingCount,
          orderHint,
        ),
      );
    }

    const maxRows = Math.max(
      1,
      ...Array.from(columns.values()).map((column) => column.length),
    );
    const minDepth = sortedDepths[0] ?? 0;
    const maxDepth = sortedDepths[sortedDepths.length - 1] ?? 0;
    const componentHeight = Math.max(0, (maxRows - 1) * rowGap);
    const componentWidth = Math.max(0, (maxDepth - minDepth) * columnGap);

    if (cursorX > startX && cursorX + componentWidth > startX + maxRowWidth) {
      cursorX = startX;
      cursorY += rowMaxHeight + componentGapY;
      rowMaxHeight = 0;
    }

    sortedDepths.forEach((depth) => {
      const column = columns.get(depth) ?? [];
      const verticalOffset = ((maxRows - column.length) * rowGap) / 2;

      column.forEach((id, rowIndex) => {
        positions.set(id, {
          x: cursorX + (depth - minDepth) * columnGap,
          y: cursorY + verticalOffset + rowIndex * rowGap,
        });
      });
    });

    cursorX += componentWidth + componentGapX;
    rowMaxHeight = Math.max(rowMaxHeight, componentHeight);
  });

  return positions;
}
