'use client';

import React, { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSocket } from '@/lib/socket';
import { Team, BuzzerState } from '@/lib/gameState';
import { sounds } from '@/lib/audio';
import { Zap, Lock, ShieldX, Volume2, VolumeX } from 'lucide-react';

function BuzzerContent() {
  const searchParams = useSearchParams();
  const teamParam = (searchParams.get('team') as Team) || null;
  const tokenParam = searchParams.get('token') || '';

  const { socket, connected } = useSocket();

  const [authStatus, setAuthStatus] = useState<'checking' | 'authorized' | 'denied'>('checking');
  const [denialMessage, setDenialMessage] = useState<string>('');
  const [teamName, setTeamName] = useState<string>('');
  const [buzzerState, setBuzzerState] = useState<BuzzerState>({
    enabled: true,
    buzzedTeam: null,
    buzzedAt: null,
    tokens: { red: '', blue: '' },
    connectedDevices: { red: false, blue: false },
  });
  const [isPressing, setIsPressing] = useState<boolean>(false);
  const [muted, setMuted] = useState<boolean>(false);

  // Authenticate with server using team & token
  useEffect(() => {
    if (!socket || !connected) return;

    if (!teamParam || !tokenParam) {
      setAuthStatus('denied');
      setDenialMessage('No valid buzzer credentials provided. Please scan the QR code from the presenter screen.');
      return;
    }

    setAuthStatus('checking');
    socket.emit('buzzer-auth', { team: teamParam, token: tokenParam });

    const handleAuthResult = (res: {
      valid: boolean;
      team?: Team;
      teamName?: string;
      message?: string;
      buzzerState?: { enabled: boolean; buzzedTeam: Team | null; buzzedAt: number | null };
    }) => {
      if (res.valid) {
        setAuthStatus('authorized');
        if (res.teamName) setTeamName(res.teamName);
        if (res.buzzerState) {
          setBuzzerState((prev) => ({ ...prev, ...res.buzzerState }));
        }
      } else {
        setAuthStatus('denied');
        setDenialMessage(
          res.message || 'QR code expired or invalid for this game session. Please scan the latest QR code.'
        );
      }
    };

    const handleBuzzerUpdate = (update: Partial<BuzzerState>) => {
      setBuzzerState((prev) => ({ ...prev, ...update }));
    };

    const handleBuzzerBuzz = (buzz: { team: Team; teamName: string; timestamp: number }) => {
      setBuzzerState((prev) => ({
        ...prev,
        enabled: false,
        buzzedTeam: buzz.team,
        buzzedAt: buzz.timestamp,
      }));

      // Audio & Haptic feedback
      if (buzz.team === teamParam) {
        sounds.playWin();
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate([100, 50, 150, 50, 200]);
        }
      } else {
        sounds.playLock();
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate([80]);
        }
      }
    };

    const handleBuzzerReset = () => {
      sounds.playReset();
      setBuzzerState((prev) => ({
        ...prev,
        buzzedTeam: null,
        buzzedAt: null,
        enabled: true,
      }));
    };

    const handleInvalidated = () => {
      setAuthStatus('denied');
      setDenialMessage(
        'A new game has started or new QR codes were generated. Please scan the new QR code from the presenter screen.'
      );
    };

    socket.on('buzzer-auth-result', handleAuthResult);
    socket.on('buzzer-update', handleBuzzerUpdate);
    socket.on('buzzer-buzz', handleBuzzerBuzz);
    socket.on('buzzer-reset', handleBuzzerReset);
    socket.on('buzzer-invalidated', handleInvalidated);

    return () => {
      socket.off('buzzer-auth-result', handleAuthResult);
      socket.off('buzzer-update', handleBuzzerUpdate);
      socket.off('buzzer-buzz', handleBuzzerBuzz);
      socket.off('buzzer-reset', handleBuzzerReset);
      socket.off('buzzer-invalidated', handleInvalidated);
    };
  }, [socket, connected, teamParam, tokenParam]);

  // Handle pointer down (lowest latency touch / click event)
  const handleBuzzerPress = useCallback(
    (e: React.PointerEvent | React.TouchEvent) => {
      e.preventDefault();

      if (authStatus !== 'authorized') return;
      if (!buzzerState.enabled || buzzerState.buzzedTeam !== null) return;

      setIsPressing(true);

      // Instant local tactile vibration
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(60);
      }

      // Emit to server
      socket?.emit('buzzer-press', {
        team: teamParam,
        token: tokenParam,
      });

      // Release visual pressed state quickly
      setTimeout(() => setIsPressing(false), 200);
    },
    [authStatus, buzzerState.enabled, buzzerState.buzzedTeam, socket, teamParam, tokenParam]
  );

  const toggleMute = () => {
    const nextMuted = !muted;
    setMuted(nextMuted);
    sounds.setMuted(nextMuted);
  };

  const isRed = teamParam === 'red';
  const teamPrimaryColor = isRed ? '#981f28' : '#5250fc';
  const teamBgGradient = isRed
    ? 'from-[#1e0508] via-[#120305] to-[#080102]'
    : 'from-[#080721] via-[#050414] to-[#02020a]';

  // State calculations
  const isWinnerOfBuzz = buzzerState.buzzedTeam === teamParam;
  const isOtherTeamWinner = buzzerState.buzzedTeam !== null && buzzerState.buzzedTeam !== teamParam;
  const isLockedByPresenter = !buzzerState.enabled && buzzerState.buzzedTeam === null;
  const isReady = buzzerState.enabled && buzzerState.buzzedTeam === null;

  // 1. Loading / Checking Screen
  if (authStatus === 'checking') {
    return (
      <div className="fixed inset-0 bg-[#0d0d1a] text-white flex flex-col items-center justify-center p-6 select-none">
        <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-6" />
        <h2 className="text-2xl font-bold mb-2">Connecting to Buzzer...</h2>
        <p className="text-gray-400 text-sm text-center max-w-xs">
          Verifying secure game session credentials
        </p>
      </div>
    );
  }

  // 2. Denied / Expired Screen
  if (authStatus === 'denied') {
    return (
      <div className="fixed inset-0 bg-[#121218] text-white flex flex-col items-center justify-center p-6 select-none">
        <div className="max-w-md w-full bg-[#1A1A24] border border-red-500/30 rounded-3xl p-8 flex flex-col items-center text-center shadow-2xl">
          <div className="p-4 bg-red-500/10 rounded-2xl text-red-400 mb-6 border border-red-500/20">
            <ShieldX className="w-12 h-12" />
          </div>
          <h1 className="text-2xl font-black text-white mb-3">Access Denied</h1>
          <p className="text-gray-300 text-sm leading-relaxed mb-6">
            {denialMessage}
          </p>
          <div className="bg-red-950/40 border border-red-800/40 rounded-xl p-4 w-full text-xs text-red-200">
            <strong>Security Protection:</strong> Buzzer links are regenerated for each game to keep buzzers private and fair. Old or shared links are rejected.
          </div>
        </div>
      </div>
    );
  }

  // 3. Authorized Buzzer Screen (ONLY THE BUZZER ON IT)
  return (
    <main
      className={`fixed inset-0 bg-gradient-to-b ${teamBgGradient} text-white flex flex-col justify-between items-center p-6 select-none overflow-hidden touch-none`}
      style={{ WebkitUserSelect: 'none', touchAction: 'manipulation', overscrollBehavior: 'none' }}
    >
      {/* Top Bar: Team Name & Connection Status */}
      <header className="w-full flex justify-between items-center z-10 pt-2">
        <div className="flex items-center gap-2">
          <div
            className="w-3.5 h-3.5 rounded-full"
            style={{
              backgroundColor: teamPrimaryColor,
              boxShadow: `0 0 10px ${teamPrimaryColor}`,
            }}
          />
          <h1 className="text-xl sm:text-2xl font-black tracking-wider uppercase text-white drop-shadow-md">
            {teamName || (isRed ? 'Team Red' : 'Team Blue')}
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={toggleMute}
            className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 text-white transition-colors"
            aria-label={muted ? 'Unmute' : 'Mute'}
          >
            {muted ? <VolumeX className="w-5 h-5 text-red-400" /> : <Volume2 className="w-5 h-5 text-gray-200" />}
          </button>
          <div className="flex items-center gap-1.5 px-3 py-1 bg-black/40 rounded-full border border-white/10 text-xs font-semibold">
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400' : 'bg-red-500'}`} />
            <span className="text-gray-300">{connected ? 'Live' : 'Reconnecting'}</span>
          </div>
        </div>
      </header>

      {/* Center: The Giant Buzzer Button */}
      <div className="flex-1 flex flex-col items-center justify-center w-full my-auto">
        <div className="relative flex items-center justify-center">
          {/* Outer glowing aura when winner */}
          {isWinnerOfBuzz && (
            <div
              className="absolute -inset-8 rounded-full animate-ping opacity-75 blur-xl pointer-events-none"
              style={{ backgroundColor: teamPrimaryColor }}
            />
          )}

          {/* Buzzer Pedestal / Rim */}
          <div
            className={`relative rounded-full p-4 sm:p-5 transition-transform duration-100 ${
              isPressing ? 'scale-95' : 'scale-100'
            }`}
            style={{
              background: 'radial-gradient(circle, #2a2a38 0%, #111116 100%)',
              boxShadow: isWinnerOfBuzz
                ? `0 0 50px ${teamPrimaryColor}, 0 20px 40px rgba(0,0,0,0.8)`
                : '0 20px 50px rgba(0,0,0,0.8), inset 0 2px 4px rgba(255,255,255,0.1)',
            }}
          >
            {/* The Dome Button */}
            <button
              onPointerDown={handleBuzzerPress}
              disabled={!isReady}
              aria-label="Buzz"
              className={`relative w-64 h-64 sm:w-80 sm:h-80 rounded-full flex flex-col items-center justify-center transition-all duration-75 cursor-pointer disabled:cursor-not-allowed outline-none select-none ${
                isPressing ? 'translate-y-2' : ''
              }`}
              style={{
                background: isWinnerOfBuzz
                  ? isRed
                    ? 'radial-gradient(circle at 35% 35%, #d13542 0%, #981f28 50%, #73131a 100%)'
                    : 'radial-gradient(circle at 35% 35%, #8b89fd 0%, #5250fc 50%, #3432bb 100%)'
                  : isOtherTeamWinner || isLockedByPresenter
                  ? 'radial-gradient(circle at 35% 35%, #555566 0%, #3a3a46 60%, #25252e 100%)'
                  : isRed
                  ? 'radial-gradient(circle at 35% 35%, #b92934 0%, #981f28 55%, #600f15 100%)'
                  : 'radial-gradient(circle at 35% 35%, #7674fd 0%, #5250fc 55%, #2a28a3 100%)',
                boxShadow: isPressing
                  ? 'inset 0 10px 25px rgba(0,0,0,0.6), 0 4px 10px rgba(0,0,0,0.5)'
                  : isWinnerOfBuzz
                  ? `0 15px 35px rgba(0,0,0,0.6), inset 0 3px 15px rgba(255,255,255,0.7), 0 0 40px ${teamPrimaryColor}`
                  : isOtherTeamWinner || isLockedByPresenter
                  ? '0 10px 20px rgba(0,0,0,0.5), inset 0 2px 8px rgba(255,255,255,0.1)'
                  : '0 20px 40px rgba(0,0,0,0.6), inset 0 4px 20px rgba(255,255,255,0.4)',
                border: isWinnerOfBuzz
                  ? '4px solid #ffffff'
                  : '3px solid rgba(255,255,255,0.2)',
              }}
            >
              {/* Highlight Glare */}
              <div
                className="absolute top-4 left-8 right-8 h-20 rounded-full opacity-35 pointer-events-none"
                style={{
                  background: 'linear-gradient(to bottom, rgba(255,255,255,0.8), transparent)',
                }}
              />

              {/* Status Content Inside Button */}
              {isWinnerOfBuzz ? (
                <div className="flex flex-col items-center text-center animate-bounce">
                  <Zap className="w-16 h-16 sm:w-20 sm:h-20 text-yellow-200 fill-yellow-200 mb-2 drop-shadow-lg" />
                  <span className="text-3xl sm:text-4xl font-black tracking-wider text-white drop-shadow-md">
                    BUZZED!
                  </span>
                  <span className="text-xs sm:text-sm font-bold text-yellow-100 tracking-widest mt-1 uppercase">
                    Your Turn!
                  </span>
                </div>
              ) : isOtherTeamWinner ? (
                <div className="flex flex-col items-center text-center opacity-60">
                  <Lock className="w-14 h-14 sm:w-16 sm:h-16 text-gray-300 mb-2" />
                  <span className="text-2xl sm:text-3xl font-black tracking-wider text-gray-300">
                    LOCKED
                  </span>
                  <span className="text-xs font-semibold text-gray-400 mt-1 uppercase">
                    Other team first
                  </span>
                </div>
              ) : isLockedByPresenter ? (
                <div className="flex flex-col items-center text-center opacity-60">
                  <Lock className="w-14 h-14 sm:w-16 sm:h-16 text-gray-300 mb-2" />
                  <span className="text-2xl sm:text-3xl font-black tracking-wider text-gray-300">
                    WAITING
                  </span>
                  <span className="text-xs font-semibold text-gray-400 mt-1 uppercase">
                    Host locked
                  </span>
                </div>
              ) : (
                <div className="flex flex-col items-center text-center">
                  <Zap className="w-16 h-16 sm:w-20 sm:h-20 text-white fill-white mb-2 drop-shadow-[0_2px_10px_rgba(0,0,0,0.3)] animate-pulse" />
                  <span className="text-4xl sm:text-5xl font-black tracking-wider text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]">
                    BUZZ!
                  </span>
                  <span className="text-xs sm:text-sm font-bold text-white/90 tracking-widest mt-1 uppercase">
                    Tap To Answer
                  </span>
                </div>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Status Banner */}
      <footer className="w-full text-center pb-4 z-10">
        <div
          className={`py-3 px-6 rounded-2xl max-w-sm mx-auto backdrop-blur-md border transition-all ${
            isWinnerOfBuzz
              ? 'bg-yellow-500/20 border-yellow-400 text-yellow-300 shadow-[0_0_20px_rgba(234,179,8,0.3)]'
              : isOtherTeamWinner
              ? 'bg-red-500/10 border-red-500/30 text-gray-400'
              : isLockedByPresenter
              ? 'bg-gray-800/40 border-gray-700 text-gray-400'
              : 'bg-white/10 border-white/20 text-white shadow-lg'
          }`}
        >
          <p className="text-sm sm:text-base font-black tracking-wide">
            {isWinnerOfBuzz
              ? '⚡ YOU BUZZED IN FIRST! ⚡'
              : isOtherTeamWinner
              ? '🔒 Other team buzzed in first'
              : isLockedByPresenter
              ? '⏳ Waiting for presenter to open buzzers...'
              : '⚡ READY TO BUZZ — TAP WHEN READY!'}
          </p>
        </div>
      </footer>
    </main>
  );
}

export default function BuzzerPage() {
  return (
    <Suspense
      fallback={
        <div className="fixed inset-0 bg-[#0d0d1a] text-white flex items-center justify-center">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <BuzzerContent />
    </Suspense>
  );
}
