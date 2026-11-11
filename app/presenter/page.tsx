'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useSocket } from '@/lib/socket';
import { useGameStore, Team } from '@/lib/gameState';
import { HexGrid } from '@/components/HexGrid';
import { JokerButton } from '@/components/JokerButton';
import { QuestionCard } from '@/components/QuestionCard';
import { BuzzerModal } from '@/components/BuzzerModal';
import { Question } from '@/lib/questions';
import { sounds } from '@/lib/audio';
import { QrCode, Zap, Lock, Unlock, RotateCcw, Volume2, VolumeX } from 'lucide-react';

export default function PresenterPage() {
  const { socket, connected } = useSocket();
  const store = useGameStore();

  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string | null>(null);
  const [availableQuestions, setAvailableQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isFetching, setIsFetching] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [isBuzzerModalOpen, setIsBuzzerModalOpen] = useState(false);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    if (!socket || !connected) return;

    socket.emit('request-state');

    socket.on('state-update', (state) => store.applyStateUpdate(state));

    socket.on('buzzer-buzz', () => {
      sounds.playBuzzer();
    });

    socket.on('buzzer-reset', () => {
      sounds.playReset();
    });

    socket.on('buzzer-update', (update) => {
      store.updateBuzzer(update);
    });

    socket.on('buzzer-device-status', (devices) => {
      store.updateBuzzer({ connectedDevices: devices });
    });

    socket.on('game-reset', () => {
      store.reset();
      setActiveCategoryFilter(null);
      setAvailableQuestions([]);
      setCurrentQuestionIndex(0);
    });

    return () => {
      socket.off('state-update');
      socket.off('buzzer-buzz');
      socket.off('buzzer-reset');
      socket.off('buzzer-update');
      socket.off('buzzer-device-status');
      socket.off('game-reset');
    };
  }, [socket, connected, store.applyStateUpdate, store.updateBuzzer, store.reset]);

  // Keyboard shortcut: Spacebar to Reset Buzzers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        const target = e.target as HTMLElement;
        if (
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT'
        ) {
          return;
        }
        e.preventDefault();
        socket?.emit('buzzer-reset');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [socket]);

  const fetchQuestion = useCallback(async (letter: string, category: string | null) => {
    setIsFetching(true);
    try {
      let url = `/api/questions?letter=${letter}`;
      if (category) {
        url += `&category=${category}`;
      }
      const res = await fetch(url);
      const questions: Question[] = await res.json();

      if (questions.length > 0) {
        setAvailableQuestions(questions);
        setCurrentQuestionIndex(Math.floor(Math.random() * questions.length));
      } else {
        setAvailableQuestions([]);
        setCurrentQuestionIndex(0);
      }
    } catch (err) {
      console.error(err);
      setAvailableQuestions([]);
      setCurrentQuestionIndex(0);
    } finally {
      setIsFetching(false);
    }
  }, []);

  const handleGenerateAI = async () => {
    if (!store.activeHexId) return;
    const letter = store.hexLetters[store.activeHexId];
    if (!letter) return;

    setIsGeneratingAI(true);
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          letter,
          category: activeCategoryFilter || 'General Knowledge',
          language: store.language,
        }),
      });

      if (!res.ok) throw new Error('Failed to generate question');
      const data = await res.json();

      const newQuestion: Question = {
        id: `ai-${Date.now()}`,
        question: data.question,
        answer: data.answer,
        letter: letter,
        category: `AI Generated (${activeCategoryFilter || 'General'})`,
        difficulty: 'Medium',
      };

      setAvailableQuestions((prev) => [...prev, newQuestion]);
      setCurrentQuestionIndex(availableQuestions.length);
    } catch (err) {
      console.error(err);
      alert('Failed to generate AI question. Check your API key and connection.');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleHexClick = (hexId: string) => {
    if (store.winner) return;

    socket?.emit('active-hex', { hexId });
    // Reset buzzer so it's fresh for this hex
    socket?.emit('buzzer-reset');

    if (!store.hexOwnership[hexId]) {
      const letter = store.hexLetters[hexId];
      if (letter) {
        fetchQuestion(letter, activeCategoryFilter);
      }
    } else {
      setAvailableQuestions([]);
      setCurrentQuestionIndex(0);
    }
  };

  const handleUseJoker = (team: Team, category: string) => {
    socket?.emit('joker-used', { team });
    setActiveCategoryFilter(category);
  };

  const handleAward = (team: Team) => {
    if (store.activeHexId) {
      socket?.emit('hex-claimed', { hexId: store.activeHexId, team });
    }
    socket?.emit('buzzer-reset');
    socket?.emit('active-hex', { hexId: null });
    setAvailableQuestions([]);
    setCurrentQuestionIndex(0);
    setActiveCategoryFilter(null);
  };

  const handleNoClaim = () => {
    socket?.emit('active-hex', { hexId: null });
    socket?.emit('buzzer-reset');
    setAvailableQuestions([]);
    setCurrentQuestionIndex(0);
    setActiveCategoryFilter(null);
  };

  const handleRemoveClaim = (hexId: string) => {
    socket?.emit('hex-unclaimed', { hexId });
    handleNoClaim();
  };

  const handleNextQuestion = () => {
    setCurrentQuestionIndex((prev) => (prev + 1) % availableQuestions.length);
    socket?.emit('buzzer-reset');
  };

  const handleResetBuzzer = () => {
    socket?.emit('buzzer-reset');
  };

  const handleToggleBuzzerLock = () => {
    socket?.emit('buzzer-toggle-lock');
  };

  const toggleMute = () => {
    const nextMuted = !muted;
    setMuted(nextMuted);
    sounds.setMuted(nextMuted);
  };

  const currentQuestion = availableQuestions[currentQuestionIndex] || null;

  const connectedCount =
    (store.buzzerState?.connectedDevices?.red ? 1 : 0) +
    (store.buzzerState?.connectedDevices?.blue ? 1 : 0);

  const buzzedTeam = store.buzzerState?.buzzedTeam;
  const isBuzzed = !!buzzedTeam;

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <header className="bg-[#1A1A2E] text-white p-4 shadow-md sticky top-0 z-30 flex justify-between items-center gap-3">
        <h1 className="text-lg sm:text-xl font-bold shrink-0">Presenter View</h1>

        <div className="flex items-center gap-2 flex-1 justify-end max-w-xl">
          {/* Buzzer QR Code Button */}
          <button
            onClick={() => setIsBuzzerModalOpen(true)}
            className="flex items-center gap-1.5 py-1.5 px-3 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-lg font-bold text-xs sm:text-sm transition-all shadow-sm shrink-0"
            title="Show QR codes for players to scan"
          >
            <QrCode className="w-4 h-4 text-yellow-300" />
            <span>Buzzers</span>
            <span
              className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                connectedCount === 2
                  ? 'bg-green-500 text-white'
                  : connectedCount === 1
                  ? 'bg-yellow-500 text-black'
                  : 'bg-gray-700 text-gray-300'
              }`}
            >
              {connectedCount}/2
            </span>
          </button>

          {/* Sound Toggle */}
          <button
            onClick={toggleMute}
            className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition-colors shrink-0"
            title={muted ? 'Unmute Sound' : 'Mute Sound'}
          >
            {muted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {/* Splash Toggle */}
          <button
            onClick={() => socket?.emit('toggle-splash', !store.showSplash)}
            className={`py-1.5 px-3 rounded-lg font-bold text-xs sm:text-sm transition-all truncate shrink-0 ${
              store.showSplash
                ? 'bg-amber-500 text-white ring-2 ring-amber-300'
                : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
            }`}
          >
            {store.showSplash ? '📷 Hide Splash' : '📷 Splash'}
          </button>

          <div
            className={`w-3 h-3 rounded-full shrink-0 ${
              connected ? 'bg-green-500' : 'bg-red-500'
            }`}
            title={connected ? 'Connected to server' : 'Disconnected'}
          />
        </div>
      </header>

      {/* Prominent Buzzer Control / Alert Bar */}
      <section className="sticky top-[65px] z-20 shadow-md">
        {isBuzzed ? (
          // ALARM: Team buzzed in!
          <div
            className={`p-3 sm:p-4 text-white flex flex-wrap items-center justify-between gap-3 animate-pulse transition-all ${
              buzzedTeam === 'red' ? 'bg-[#981f28]' : 'bg-[#5250fc]'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-xl">
                <Zap className="w-7 h-7 text-yellow-300 fill-yellow-300 animate-bounce" />
              </div>
              <div>
                <span className="text-xs uppercase tracking-wider font-extrabold text-white/90">
                  First Buzz Registered:
                </span>
                <h2 className="text-xl sm:text-2xl font-black drop-shadow-md">
                  {store.teamNames[buzzedTeam]}
                </h2>
              </div>
            </div>

            <button
              onClick={handleResetBuzzer}
              className="py-2.5 px-6 bg-white hover:bg-yellow-300 text-gray-950 font-black rounded-xl text-base shadow-lg transition-transform active:scale-95 flex items-center gap-2 ml-auto"
            >
              <RotateCcw className="w-5 h-5" />
              <span>RESET BUZZER</span>
              <kbd className="hidden sm:inline-block px-2 py-0.5 text-xs bg-gray-200 text-gray-700 rounded border border-gray-400">
                Space
              </kbd>
            </button>
          </div>
        ) : (
          // Normal Buzzer Status Toolbar
          <div className="bg-[#24243A] text-gray-200 px-4 py-2.5 border-b border-gray-800 flex items-center justify-between gap-3 text-xs sm:text-sm">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    store.buzzerState?.enabled
                      ? 'bg-green-400 shadow-[0_0_8px_#4ade80]'
                      : 'bg-red-400'
                  }`}
                />
                <span className="font-bold">
                  {store.buzzerState?.enabled ? (
                    <span className="text-green-400">Buzzers Ready</span>
                  ) : (
                    <span className="text-red-400">Buzzers Locked</span>
                  )}
                </span>
              </div>
              <span className="text-gray-500">|</span>
              <span className="text-gray-400 text-xs hidden sm:inline">
                Devices: {connectedCount}/2
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleToggleBuzzerLock}
                className="flex items-center gap-1 py-1 px-2.5 bg-gray-700 hover:bg-gray-600 active:bg-gray-500 text-gray-200 rounded font-semibold text-xs transition-colors"
                title={store.buzzerState?.enabled ? 'Lock Buzzers' : 'Unlock Buzzers'}
              >
                {store.buzzerState?.enabled ? (
                  <>
                    <Lock className="w-3.5 h-3.5 text-red-300" />
                    <span>Lock</span>
                  </>
                ) : (
                  <>
                    <Unlock className="w-3.5 h-3.5 text-green-300" />
                    <span>Unlock</span>
                  </>
                )}
              </button>

              <button
                onClick={handleResetBuzzer}
                className="flex items-center gap-1 py-1 px-2.5 bg-gray-700 hover:bg-gray-600 active:bg-gray-500 text-gray-200 rounded font-semibold text-xs transition-colors"
                title="Reset Buzzer state (Space)"
              >
                <RotateCcw className="w-3.5 h-3.5 text-yellow-300" />
                <span>Reset</span>
              </button>
            </div>
          </div>
        )}
      </section>

      <main className="p-4 max-w-md mx-auto flex flex-col gap-8">
        {/* Joker Controls */}
        <section className="flex gap-4">
          <JokerButton
            team="red"
            teamName={store.teamNames.red}
            isAvailable={store.jokerStatus.red}
            onUseJoker={(cat) => handleUseJoker('red', cat)}
          />
          <JokerButton
            team="blue"
            teamName={store.teamNames.blue}
            isAvailable={store.jokerStatus.blue}
            onUseJoker={(cat) => handleUseJoker('blue', cat)}
          />
        </section>

        {activeCategoryFilter && !store.activeHexId && (
          <div className="bg-yellow-100 border-l-4 border-yellow-500 p-4 rounded text-yellow-800">
            <p className="font-bold">Joker Active: {activeCategoryFilter}</p>
            <p className="text-sm">Select a hex to get a question in this category.</p>
          </div>
        )}

        {/* Mini Hex Grid */}
        <section className="bg-white p-4 rounded-xl shadow-md overflow-hidden flex justify-center">
          <div className="scale-[0.8] origin-top">
            <HexGrid
              hexOwnership={store.hexOwnership}
              hexLetters={store.hexLetters}
              activeHexId={store.activeHexId}
              winningPath={store.winningPath}
              onHexClick={handleHexClick}
              interactive={true}
              hexSize={60}
            />
          </div>
        </section>

        {/* Question Panel */}
        {store.activeHexId && (
          <section id="question-panel">
            {store.hexOwnership[store.activeHexId] ? (
              <div className="bg-white p-6 rounded-xl shadow-md text-center">
                <h2 className="text-2xl font-bold mb-6">Change Hex Ownership</h2>
                <div className="grid grid-cols-1 gap-4 mb-4 sm:grid-cols-3">
                  <button
                    onClick={() => handleAward('red')}
                    className="py-4 bg-[#981f28] text-white font-bold rounded-lg text-xl active:bg-red-800"
                  >
                    Give to {store.teamNames.red}
                  </button>
                  <button
                    onClick={() => handleAward('blue')}
                    className="py-4 bg-[#5250fc] text-white font-bold rounded-lg text-xl active:bg-indigo-800"
                  >
                    Give to {store.teamNames.blue}
                  </button>
                  <button
                    onClick={() => handleRemoveClaim(store.activeHexId!)}
                    className="py-4 bg-gray-500 text-white font-bold rounded-lg text-xl active:bg-gray-600"
                  >
                    Unclaim
                  </button>
                </div>
                <button
                  onClick={handleNoClaim}
                  className="w-full py-3 bg-gray-200 text-gray-800 font-bold rounded-lg text-lg active:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            ) : isFetching ? (
              <div className="bg-white p-8 rounded-xl shadow-md text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
                <p className="text-gray-500 font-bold">Fetching question...</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {availableQuestions.length > 0 && (
                  <div className="bg-white p-4 rounded-xl shadow-md flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-grow mr-4">
                      <label
                        htmlFor="question-select"
                        className="font-bold text-gray-700 whitespace-nowrap"
                      >
                        Select Question:
                      </label>
                      <select
                        id="question-select"
                        value={currentQuestionIndex}
                        onChange={(e) => setCurrentQuestionIndex(Number(e.target.value))}
                        className="p-2 border rounded-md w-full bg-gray-50 text-gray-800 focus:ring-indigo-500 focus:border-indigo-500"
                      >
                        {availableQuestions.map((q, idx) => (
                          <option key={q.id} value={idx}>
                            {idx + 1}. {q.question.substring(0, 50)}... | A:{' '}
                            {q.answer.substring(0, 30)} ({q.difficulty})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleGenerateAI}
                        disabled={isGeneratingAI}
                        className="bg-purple-100 hover:bg-purple-200 text-purple-700 font-bold py-2 px-3 rounded-lg transition-colors whitespace-nowrap"
                        title="Generate AI Question"
                      >
                        {isGeneratingAI ? '...' : '✨ AI'}
                      </button>
                      <button
                        onClick={handleNextQuestion}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded-lg transition-colors whitespace-nowrap"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}

                <QuestionCard
                  letter={store.hexLetters[store.activeHexId] || '?'}
                  question={currentQuestion}
                  onAward={handleAward}
                  onNoClaim={handleNoClaim}
                  teamNames={store.teamNames}
                  onGenerateAI={handleGenerateAI}
                  isGeneratingAI={isGeneratingAI}
                  buzzedTeam={store.buzzerState?.buzzedTeam}
                />
              </div>
            )}
          </section>
        )}
      </main>

      {/* QR Code Modal */}
      <BuzzerModal
        isOpen={isBuzzerModalOpen}
        onClose={() => setIsBuzzerModalOpen(false)}
        socket={socket}
        buzzerState={store.buzzerState}
        teamNames={store.teamNames}
        localIPs={store.localIPs}
      />
    </div>
  );
}
