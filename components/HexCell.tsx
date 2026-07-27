import React from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { Team } from '@/lib/gameState';

interface HexCellProps {
  id: string;
  letter: string;
  owner: Team | null;
  isActive: boolean;
  isWinningPath: boolean;
  onClick?: () => void;
  size?: number; // width in pixels
  interactive?: boolean;
}

export const HexCell: React.FC<HexCellProps> = ({
  id,
  letter,
  owner,
  isActive,
  isWinningPath,
  onClick,
  size = 120,
  interactive = false,
}) => {
  // Pointy-topped hex
  // Width = size
  // Height = size / (sqrt(3)/2)
  const width = size;
  const height = size / (Math.sqrt(3) / 2);

  let fill = '#FFFFFF';
  let textColor = '#5B2C6F';
  let stroke = '#5B2C6F';

  if (owner === 'red') {
    fill = '#F3722C';
    textColor = '#FFFFFF';
    stroke = isWinningPath ? '#FFFFFF' : '#F3722C';
  } else if (owner === 'blue') {
    fill = '#4CAF50';
    textColor = '#FFFFFF';
    stroke = isWinningPath ? '#FFFFFF' : '#4CAF50';
  }

  return (
    <motion.div
      className={clsx('relative flex items-center justify-center', {
        'cursor-pointer hover:scale-105 transition-transform hover:z-20': interactive && !owner,
        'z-50': isActive,
        'z-40': isWinningPath,
        'z-30': owner !== null && !isActive && !isWinningPath,
        'z-10': owner === null && !isActive && !isWinningPath,
      })}
      style={{ width, height }}
      onClick={() => interactive && onClick?.()}
      animate={isActive ? { scale: [1, 1.1, 1] } : {}}
      transition={isActive ? { repeat: Infinity, duration: 1.5 } : {}}
    >
      <svg
        viewBox="0 0 86.6 100"
        className={clsx('absolute inset-0 overflow-visible', {
          'drop-shadow-[0_0_15px_rgba(244,208,63,0.8)]': isActive,
          'drop-shadow-[0_0_20px_rgba(255,255,255,1)]': isWinningPath,
        })}
        style={{ width: '100%', height: '100%' }}
      >
        <motion.polygon
          points="43.3,0 86.6,25 86.6,75 43.3,100 0,75 0,25"
          fill={fill}
          stroke={isActive ? '#F4D03F' : stroke}
          strokeWidth={isActive ? 8 : 4}
          initial={false}
          animate={{ fill, stroke }}
          transition={{ duration: 0.4 }}
        />
      </svg>
      <span
        className="relative z-10 font-bold select-none pointer-events-none"
        style={{ fontSize: size * 0.45, color: textColor }}
      >
        {letter}
      </span>
    </motion.div>
  );
};
