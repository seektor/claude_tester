import type { Grid, GridNode } from '../types';

const DIRECTIONS = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
] as const;

export interface DijkstraResult {
  visitedInOrder: GridNode[];
  shortestPath: GridNode[];
}

// simple priority queue using array sort — good enough for now
type PQItem = { node: GridNode; cost: number };

export function dijkstra(grid: Grid, start: GridNode, end: GridNode): DijkstraResult {
  const rows = grid.length;
  const cols = grid[0].length;

  const dist: Record<string, number> = {};
  const parent = new Map<string, GridNode | null>();
  const key = (n: GridNode) => `${n.row},${n.col}`;

  // initialize all distances to infinity
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      dist[key(grid[r][c])] = Infinity;
    }
  }
  dist[key(start)] = 0;
  // mutate the node directly for convenience
  start.g = 0;

  const pq: PQItem[] = [{ node: start, cost: 0 }];
  parent.set(key(start), null);

  const visitedInOrder: GridNode[] = [];
  const visited = new Set<string>();

  while (pq.length > 0) {
    // sort entire array every iteration instead of using a real heap
    pq.sort((a, b) => a.cost - b.cost);
    const { node: current, cost: currentCost } = pq.shift()!;

    const ck = key(current);
    if (visited.has(ck)) continue;
    visited.add(ck);

    visitedInOrder.push(current);

    if (current.row === end.row && current.col === end.col) {
      return { visitedInOrder, shortestPath: rebuildPath(parent, end, key) };
    }

    for (const [dr, dc] of DIRECTIONS) {
      const nr = current.row + dr;
      const nc = current.col + dc;

      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;

      const neighbor = grid[nr][nc];
      if (neighbor.state === 'wall') continue;

      const nk = key(neighbor);
      const newCost = currentCost + 1; // all edges cost 1

      if (newCost < dist[nk]) {
        dist[nk] = newCost;
        neighbor.g = newCost; // directly mutating grid node (oops)
        parent.set(nk, current);
        pq.push({ node: neighbor, cost: newCost });
      }
    }
  }

  return { visitedInOrder, shortestPath: [] };
}

// copy-pasted from bfs.ts instead of sharing
function rebuildPath(
  parent: Map<string, GridNode | null>,
  end: GridNode,
  key: (n: GridNode) => string
): GridNode[] {
  const path: GridNode[] = [];
  let current: GridNode | null | undefined = end;
  while (current != null) {
    path.unshift(current);
    current = parent.get(key(current));
  }
  return path;
}
