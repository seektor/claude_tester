export type NodeState =
  | 'empty'
  | 'wall'
  | 'start'
  | 'end'
  | 'visited'
  | 'path';

export interface GridNode {
  row: number;
  col: number;
  state: NodeState;
  // Used by algorithms at runtime — not mutated on the grid directly
  g?: number; // cost from start (Dijkstra / A*)
  h?: number; // heuristic cost to end (A*)
  f?: number; // g + h (A*)
  parent?: GridNode | null;
}

export type Grid = GridNode[][];

export type InteractionMode = 'wall' | 'start' | 'end';

export type Algorithm = 'bfs' | 'dijkstra';
