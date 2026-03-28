import type { GridNode, InteractionMode } from '../types';
import './Node.css';

interface NodeProps {
  node: GridNode;
  mode: InteractionMode;
  onMouseDown: (row: number, col: number) => void;
  onMouseEnter: (row: number, col: number) => void;
}

export function Node({ node, mode, onMouseDown, onMouseEnter }: NodeProps) {
  return (
    <div
      id={`node-${node.row}-${node.col}`}
      className={`node node--${node.state}`}
      onMouseDown={() => onMouseDown(node.row, node.col)}
      onMouseEnter={() => onMouseEnter(node.row, node.col)}
      // Prevent default drag behavior that interferes with wall painting
      onDragStart={(e) => e.preventDefault()}
    />
  );
}
