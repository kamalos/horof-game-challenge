import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { Team } from '@/lib/gameState';

interface WinnerBannerProps {
  winner: Team;
  teamNames: { red: string; blue: string };
  onReset: () => void;
}

export const WinnerBanner: React.FC<WinnerBannerProps> = ({ winner, teamNames, onReset }) => {
  useEffect(() => {
    const duration = 5 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 100 };

    const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

    const interval: any = setInterval(function () {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
        colors: winner === 'red' ? ['#F3722C', '#F4D03F'] : ['#4CAF50', '#F4D03F'],
      });
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
        colors: winner === 'red' ? ['#F3722C', '#F4D03F'] : ['#4CAF50', '#F4D03F'],
      });
    }, 250);

    return () => clearInterval(interval);
  }, [winner]);

  const winnerName = winner === 'red' ? teamNames.red : teamNames.blue;
  const bgColor = winner === 'red' ? 'bg-[#F3722C]/90' : 'bg-[#4CAF50]/90';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center backdrop-blur-sm ${bgColor}`}
    >
      <motion.h1
        initial={{ scale: 0.5, y: 50 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', bounce: 0.5 }}
        className="text-8xl font-extrabold text-white mb-8 text-center uppercase tracking-widest drop-shadow-2xl"
      >
        {winnerName} WINS!
      </motion.h1>

      <motion.button
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1 }}
        onClick={onReset}
        className="px-8 py-4 bg-white text-gray-900 font-bold text-2xl rounded-full hover:bg-gray-100 transition-colors shadow-xl"
      >
        New Game
      </motion.button>
    </motion.div>
  );
};
