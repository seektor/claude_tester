import type { Grid as GridType, InteractionMode } from '../types';
import { Node } from './Node';
import './Grid.css';

interface GridProps {
  grid: GridType;
  mode: InteractionMode;
  onMouseDown: (row: number, col: number) => void;
  onMouseEnter: (row: number, col: number) => void;
  onMouseUp: () => void;
}

export function Grid({ grid, mode, onMouseDown, onMouseEnter, onMouseUp }: GridProps) {
  return (
    <div className="grid" onMouseUp={onMouseUp} onMouseLeave={onMouseUp}>
      {grid.map((row) =>
        row.map((node) => (
          <Node
            key={`${node.row}-${node.col}`}
            node={node}
            mode={mode}
            onMouseDown={onMouseDown}
            onMouseEnter={onMouseEnter}
          />
        ))
      )}
    </div>
  );
}
