import { useState, useCallback } from 'react';
import { Grid } from './components/Grid';
import { bfs } from './algorithms/bfs';
import { useGrid } from './hooks/useGrid';
import { useTheme } from './hooks/useTheme';
import type { InteractionMode } from './types';
import './App.css';

const VISIT_DELAY_MS = 15;
const PATH_DELAY_MS = 40;

export default function App() {
  const {
    grid,
    setGrid,
    mode,
    setMode,
    handleMouseDown,
    handleMouseEnter,
    handleMouseUp,
    resetGrid,
    clearPath,
    getStartEnd,
    COLS,
  } = useGrid();

  const { theme, toggle: toggleTheme } = useTheme();
  const [isRunning, setIsRunning] = useState(false);

  const runBFS = useCallback(async () => {
    clearPath();

    // Use a fresh read of the grid state after clearPath — but since setState is
    // async, we pass a callback to capture the post-clear grid.
    // Simpler: grab start/end from current grid before clearing visited/path nodes.
    const { start, end } = getStartEnd(grid);

    if (!start || !end) {
      alert('Place both a start and an end node first.');
      return;
    }

    setIsRunning(true);

    const { visitedInOrder, shortestPath } = bfs(grid, start, end);

    // --- Animate visited nodes via direct DOM manipulation ---
    // Why DOM instead of setState per frame?
    // setState batches and schedules re-renders asynchronously — animating
    // thousands of cells via state would cause React to reconcile the entire
    // grid on each tick, making it janky. Direct DOM classList writes are O(1)
    // and let CSS animations do the heavy lifting without React overhead.
    for (let i = 0; i < visitedInOrder.length; i++) {
      await delay(VISIT_DELAY_MS);
      const { row, col } = visitedInOrder[i];
      if (grid[row][col].state === 'start' || grid[row][col].state === 'end') continue;
      const el = document.getElementById(`node-${row}-${col}`);
      el?.classList.replace('node--empty', 'node--visited');
    }

    for (let i = 0; i < shortestPath.length; i++) {
      await delay(PATH_DELAY_MS);
      const { row, col } = shortestPath[i];
      if (grid[row][col].state === 'start' || grid[row][col].state === 'end') continue;
      const el = document.getElementById(`node-${row}-${col}`);
      el?.classList.replace('node--visited', 'node--path');
      el?.classList.replace('node--empty', 'node--path');
    }

    // Sync React state with what the DOM now shows so grid reset works correctly
    setGrid((prev) =>
      prev.map((r) =>
        r.map((n) => {
          if (n.state !== 'empty' && n.state !== 'visited' && n.state !== 'path') return n;
          const el = document.getElementById(`node-${n.row}-${n.col}`);
          if (el?.classList.contains('node--path')) return { ...n, state: 'path' };
          if (el?.classList.contains('node--visited')) return { ...n, state: 'visited' };
          return n;
        })
      )
    );

    setIsRunning(false);
  }, [grid, clearPath, getStartEnd, setGrid]);

  return (
    <div className="app">
      <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle theme">
        {theme === 'light' ? (
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="5"/>
            <line x1="12" y1="1" x2="12" y2="3"/>
            <line x1="12" y1="21" x2="12" y2="23"/>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
            <line x1="1" y1="12" x2="3" y2="12"/>
            <line x1="21" y1="12" x2="23" y2="12"/>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
          </svg>
        )}
      </button>

      <header className="app__header">
        <h1>Pathfinding Visualizer</h1>
        <p className="app__subtitle">Algorithm: <strong>BFS</strong></p>
      </header>

      <div className="app__controls">
        <div className="mode-buttons">
          {(['wall', 'start', 'end'] as InteractionMode[]).map((m) => (
            <button
              key={m}
              className={`btn btn--mode ${mode === m ? 'btn--active' : ''}`}
              onClick={() => setMode(m)}
              disabled={isRunning}
            >
              {m === 'wall' ? 'Draw Walls' : m === 'start' ? 'Set Start' : 'Set End'}
            </button>
          ))}
        </div>

        <div className="action-buttons">
          <button className="btn btn--run" onClick={runBFS} disabled={isRunning}>
            {isRunning ? 'Running…' : 'Run BFS'}
          </button>
          <button className="btn btn--secondary" onClick={clearPath} disabled={isRunning}>
            Clear Path
          </button>
          <button className="btn btn--secondary" onClick={resetGrid} disabled={isRunning}>
            Reset Grid
          </button>
        </div>
      </div>

      <div className="app__legend">
        <span className="legend-item legend-item--start">Start</span>
        <span className="legend-item legend-item--end">End</span>
        <span className="legend-item legend-item--wall">Wall</span>
        <span className="legend-item legend-item--visited">Visited</span>
        <span className="legend-item legend-item--path">Shortest Path</span>
      </div>

      <div
        className="grid-wrapper"
        style={{ '--grid-cols': COLS } as React.CSSProperties}
      >
        <Grid
          grid={grid}
          mode={mode}
          onMouseDown={handleMouseDown}
          onMouseEnter={handleMouseEnter}
          onMouseUp={handleMouseUp}
        />
      </div>
    </div>
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
