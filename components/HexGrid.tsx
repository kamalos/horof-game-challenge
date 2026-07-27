import React from 'react';
import { HexCell } from './HexCell';
import { ROW_LENGTHS } from '@/lib/hexLayout';
import { Team } from '@/lib/gameState';

interface HexGridProps {
  hexOwnership: Record<string, Team | null>;
  hexLetters: Record<string, string>;
  activeHexId: string | null;
  winningPath: string[];
  onHexClick?: (hexId: string) => void;
  interactive?: boolean;
  hexSize?: number;
}

export const HexGrid: React.FC<HexGridProps> = ({
  hexOwnership,
  hexLetters,
  activeHexId,
  winningPath,
  onHexClick,
  interactive = false,
  hexSize = 120,
}) => {
  const hexHeight = hexSize / (Math.sqrt(3) / 2);
  const marginTop = -(hexHeight * 0.25);

  return (
    <div className="flex flex-col items-center justify-center p-4">
      {ROW_LENGTHS.map((length, r) => (
        <div
          key={`row-${r}`}
          className="flex justify-center"
          style={{
            marginTop: r === 0 ? 0 : marginTop,
          }}
        >
          {Array.from({ length }).map((_, c) => {
            const id = `r${r}c${c}`;
            return (
              <div key={id} style={{ width: hexSize }}>
                <HexCell
                  id={id}
                  letter={hexLetters[id] || ''}
                  owner={hexOwnership[id] || null}
                  isActive={activeHexId === id}
                  isWinningPath={winningPath.includes(id)}
                  onClick={() => onHexClick?.(id)}
                  size={hexSize}
                  interactive={interactive}
                />
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};
