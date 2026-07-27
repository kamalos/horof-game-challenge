'use client';

import React, { useEffect, useState } from 'react';
import { useSocket } from '@/lib/socket';
import { useGameStore, Team } from '@/lib/gameState';
import { HexGrid } from '@/components/HexGrid';
import { WinnerBanner } from '@/components/WinnerBanner';

export default function BoardPage() {
  const { socket, connected } = useSocket();
  const store = useGameStore();

  useEffect(() => {
    if (!socket || !connected) return;

    socket.emit('request-state');

    socket.on('state-update', (state) => {
      store.applyStateUpdate(state);
    });

    socket.on('show-winner', ({ team, winningPath }) => {
      store.setWinner(team, winningPath);
    });

    socket.on('game-reset', () => {
      store.reset();
    });

    return () => {
      socket.off('state-update');
      socket.off('show-winner');
      socket.off('game-reset');
    };
  }, [socket, connected, store.applyStateUpdate, store.setWinner, store.reset]);

  const resetGame = () => {
    socket?.emit('game-reset', { keepLetters: false });
  };

  if (store.showSplash) {
    return (
      <div className="h-screen w-screen bg-[#1A1A2E] flex flex-col items-center justify-center relative overflow-hidden select-none">
        <div
          className="absolute inset-0 z-0 opacity-100"
          style={{
            background: 'conic-gradient(from 310.9deg at 50% 50%, #4CAF50 0deg 98.2deg, #F3722C 98.2deg 180deg, #4CAF50 180deg 278.2deg, #F3722C 278.2deg 360deg)'
          }}
        >
        </div>
        <img src="/logo.png" alt="Logo" className="h-[60vh] object-contain z-10 drop-shadow-[0_0_40px_rgba(255,255,255,0.4)]" />
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-[#1A1A2E] flex flex-col relative overflow-hidden select-none">
      {/* Background quadrants */}
      <div
        className="absolute inset-0 z-0 opacity-100"
        style={{
          background: 'conic-gradient(from 310.9deg at 50% 50%, #4CAF50 0deg 98.2deg, #F3722C 98.2deg 180deg, #4CAF50 180deg 278.2deg, #F3722C 278.2deg 360deg)'
        }}
      >
      </div>

      {/* Header / Scoreboard */}
      <header className="absolute top-0 left-0 w-full flex justify-between items-start p-8 z-20 pointer-events-none">
        <div className="flex flex-col items-start gap-2">
          <h2 className="text-5xl font-black text-white tracking-wider drop-shadow-lg px-6 py-2 rounded-xl bg-[#F3722C] shadow-[0_0_15px_#F3722C]">
            {store.teamNames.red}
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-white font-bold text-xl uppercase">Joker:</span>
            <div
              className={`w-4 h-4 rounded-full ${store.jokerStatus.red ? 'bg-[#F4D03F] shadow-[0_0_10px_#F4D03F]' : 'bg-gray-600'
                }`}
            />
          </div>
        </div>

        <div className="flex flex-col items-center justify-center -mt-6">
          {/* <img
            src="/logo.png"
            alt="حروف مع كمال"
            className="h-24 md:h-36 object-contain drop-shadow-[0_0_15px_rgba(255,255,255,0.3)] z-20"
          /> */}
          {!connected && (
            <div className="text-white font-bold tracking-widest text-sm opacity-50 mt-2">
              CONNECTING...
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-2">
          <h2 className="text-5xl font-black text-white tracking-wider drop-shadow-lg px-6 py-2 rounded-xl bg-[#4CAF50] shadow-[0_0_15px_#4CAF50]">
            {store.teamNames.blue}
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-white font-bold text-xl uppercase">Joker:</span>
            <div
              className={`w-4 h-4 rounded-full ${store.jokerStatus.blue ? 'bg-[#F4D03F] shadow-[0_0_10px_#F4D03F]' : 'bg-gray-600'
                }`}
            />
          </div>
        </div>
      </header>

      {/* Hex Grid */}
      <main className="flex-1 flex items-center justify-center p-8 z-10">
        <HexGrid
          hexOwnership={store.hexOwnership}
          hexLetters={store.hexLetters}
          activeHexId={store.activeHexId}
          winningPath={store.winningPath}
          hexSize={130}
        />
      </main>

      {/* Winner Banner */}
      {store.winner && (
        <WinnerBanner
          winner={store.winner}
          teamNames={store.teamNames}
          onReset={resetGame}
        />
      )}
    </div>
  );
}
