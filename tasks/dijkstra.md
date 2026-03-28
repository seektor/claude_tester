# Task: Implement Dijkstra's Algorithm

## Goal

Add Dijkstra's algorithm as a selectable option in the pathfinding visualizer. Unlike BFS, Dijkstra supports weighted grids — though the current grid is unweighted (all edges cost 1), the implementation should use a proper priority queue and cost tracking so the groundwork is in place for weighted edges later.

## Acceptance criteria

- User can select "Dijkstra" from the algorithm dropdown alongside "BFS"
- Running Dijkstra on an unweighted grid produces the same shortest path as BFS
- Visited nodes animate in cost order (closest nodes first), not insertion order
- If no path exists, the visualizer behaves identically to BFS (no path, visited nodes still animate)
- Switching algorithms mid-session resets the grid visualization correctly

## Technical notes

- Create `src/algorithms/dijkstra.ts` — export a `dijkstra(grid, start, end)` function
- Return shape must match `BFSResult`: `{ visitedInOrder: GridNode[], shortestPath: GridNode[] }`
- Use the `g` field on `GridNode` (already defined in `src/types/index.ts`) to track cost from start
- Implement a min-heap / priority queue internally — do not use `Array.sort` per iteration
- Path reconstruction follows the same pattern as BFS (`parent` map + `reconstructPath`)
- Extend the `Algorithm` type in `src/types/index.ts` to `'bfs' | 'dijkstra'`
- Wire into `App.tsx` wherever BFS is selected/dispatched — the animation loop is algorithm-agnostic and needs no changes
- Do not mutate `GridNode` objects on the grid directly; use local state inside the algorithm

## Out of scope

- Weighted edges / variable node costs (future task)
- A* heuristic (separate task)
- Any changes to animation timing or DOM-write strategy
- UI changes beyond adding "Dijkstra" to the algorithm selector
