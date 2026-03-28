# Pathfinding Visualizer

React + TypeScript (Vite) app that visualizes graph search algorithms on an interactive grid.

## Stack

- **React 18** + **TypeScript** (strict mode)
- **Vite 5** for bundling/dev server
- **Yarn** — use `yarn` not `npm`

## Dev

```bash
yarn dev      # start dev server
yarn build    # tsc + vite build
yarn preview  # preview production build
```

## Project structure

```
src/
  types/index.ts          — shared types (GridNode, Grid, Algorithm, etc.)
  algorithms/             — pure algorithm functions, no React deps
    bfs.ts                — BFS (done)
  hooks/
    useGrid.ts            — grid state and mouse interaction logic
  components/
    Grid.tsx / Grid.css   — renders the full grid
    Node.tsx / Node.css   — single cell with CSS keyframe animations
  App.tsx / App.css       — top-level UI, controls, animation orchestration
```

## Algorithm contract

Every algorithm must return `{ visitedInOrder: GridNode[], shortestPath: GridNode[] }`.
The animation loop in `App.tsx` is algorithm-agnostic and depends on this shape.

## Animation approach

Visited/path animations write directly to the DOM (`getElementById` + `classList`) to avoid
React reconciling the full grid (~800 nodes) on every animation frame. State is synced back
once the animation completes. This is intentional — do not replace with `setState` per frame.

## Task specs

Feature/task definitions live in `tasks/*.md`. To implement one, say:
> "Implement tasks/foo.md"

Use `tasks/_template.md` as the starting point for new specs. Each spec has:
- **Goal** — what and why
- **Acceptance criteria** — observable behaviors when done
- **Technical notes** — constraints, file locations, contracts to follow
- **Out of scope** — what to intentionally skip

## Roadmap

- [ ] Dijkstra (`src/algorithms/dijkstra.ts`)
- [ ] A* (`src/algorithms/astar.ts`)
- [ ] Multi-agent code review (3 reviewer personalities via Claude agents)
