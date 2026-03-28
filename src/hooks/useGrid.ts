import { useState, useCallback, useRef } from 'react';
import type { Grid, GridNode, InteractionMode } from '../types';

const ROWS = 20;
const COLS = 40;
const START: [number, number] = [10, 5];
const END: [number, number] = [10, 34];

function makeGrid(): Grid {
  return Array.from({ length: ROWS }, (_, row) =>
    Array.from({ length: COLS }, (_, col) => ({
      row,
      col,
      state:
        row === START[0] && col === START[1]
          ? 'start'
          : row === END[0] && col === END[1]
          ? 'end'
          : 'empty',
    }))
  );
}

export function useGrid() {
  const [grid, setGrid] = useState<Grid>(makeGrid);
  const [mode, setMode] = useState<InteractionMode>('wall');
  const isMouseDown = useRef(false);

  const getStartEnd = useCallback((g: Grid) => {
    let start: GridNode | null = null;
    let end: GridNode | null = null;
    for (const row of g) {
      for (const node of row) {
        if (node.state === 'start') start = node;
        if (node.state === 'end') end = node;
      }
    }
    return { start, end };
  }, []);

  const handleMouseDown = useCallback(
    (row: number, col: number) => {
      isMouseDown.current = true;
      setGrid((prev) => {
        const next = prev.map((r) => r.map((n) => ({ ...n })));
        const node = next[row][col];

        if (mode === 'start') {
          // clear previous start
          for (const r of next)
            for (const n of r) if (n.state === 'start') n.state = 'empty';
          node.state = 'start';
        } else if (mode === 'end') {
          for (const r of next)
            for (const n of r) if (n.state === 'end') n.state = 'empty';
          node.state = 'end';
        } else {
          // wall toggle
          if (node.state === 'empty') node.state = 'wall';
          else if (node.state === 'wall') node.state = 'empty';
        }
        return next;
      });
    },
    [mode]
  );

  const handleMouseEnter = useCallback(
    (row: number, col: number) => {
      if (!isMouseDown.current || mode !== 'wall') return;
      setGrid((prev) => {
        const next = prev.map((r) => r.map((n) => ({ ...n })));
        const node = next[row][col];
        if (node.state === 'empty') node.state = 'wall';
        return next;
      });
    },
    [mode]
  );

  const handleMouseUp = useCallback(() => {
    isMouseDown.current = false;
  }, []);

  const resetGrid = useCallback(() => setGrid(makeGrid()), []);

  const clearPath = useCallback(() => {
    setGrid((prev) =>
      prev.map((r) =>
        r.map((n) =>
          n.state === 'visited' || n.state === 'path' ? { ...n, state: 'empty' } : { ...n }
        )
      )
    );
  }, []);

  return {
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
    ROWS,
    COLS,
  };
}
