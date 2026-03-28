import type { Grid, GridNode } from '../types';

const DIRECTIONS = [
  [-1, 0], // up
  [1, 0],  // down
  [0, -1], // left
  [0, 1],  // right
] as const;

export interface BFSResult {
  /** Nodes in the order they were first visited (for step-by-step animation). */
  visitedInOrder: GridNode[];
  /** The shortest path from start to end (empty if no path found). */
  shortestPath: GridNode[];
}

/**
 * BFS guarantees the shortest path on an unweighted grid.
 * Time: O(V+E) = O(rows * cols). Space: O(rows * cols) for the queue.
 */
export function bfs(grid: Grid, start: GridNode, end: GridNode): BFSResult {
  const rows = grid.length;
  const cols = grid[0].length;

  // parent map: tracks where we came from for path reconstruction
  const parent = new Map<string, GridNode | null>();
  const key = (n: GridNode) => `${n.row},${n.col}`;

  const queue: GridNode[] = [start];
  parent.set(key(start), null);

  const visitedInOrder: GridNode[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    visitedInOrder.push(current);

    if (current.row === end.row && current.col === end.col) {
      return { visitedInOrder, shortestPath: reconstructPath(parent, end, key) };
    }

    for (const [dr, dc] of DIRECTIONS) {
      const nr = current.row + dr;
      const nc = current.col + dc;

      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;

      const neighbor = grid[nr][nc];
      if (neighbor.state === 'wall') continue;
      if (parent.has(key(neighbor))) continue;

      parent.set(key(neighbor), current);
      queue.push(neighbor);
    }
  }

  return { visitedInOrder, shortestPath: [] }; // no path
}

function reconstructPath(
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
