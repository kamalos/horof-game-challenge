'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useSocket } from '@/lib/socket';
import { useGameStore, Team } from '@/lib/gameState';
import { HexGrid } from '@/components/HexGrid';
import { JokerButton } from '@/components/JokerButton';
import { QuestionCard } from '@/components/QuestionCard';
import { Question } from '@/lib/questions';

export default function PresenterPage() {
  const { socket, connected } = useSocket();
  const store = useGameStore();

  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string | null>(null);
  const [availableQuestions, setAvailableQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isFetching, setIsFetching] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);

  useEffect(() => {
    if (!socket || !connected) return;
    socket.emit('request-state');
    socket.on('state-update', (state) => store.applyStateUpdate(state));
    socket.on('game-reset', () => {
      store.reset();
      setActiveCategoryFilter(null);
      setAvailableQuestions([]);
      setCurrentQuestionIndex(0);
    });
    return () => {
      socket.off('state-update');
      socket.off('game-reset');
    };
  }, [socket, connected, store.applyStateUpdate, store.reset]);

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
      setCurrentQuestionIndex(availableQuestions.length); // point to the new one
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
    // Reset local state
    socket?.emit('active-hex', { hexId: null });
    setAvailableQuestions([]);
    setCurrentQuestionIndex(0);
    setActiveCategoryFilter(null);
  };

  const handleNoClaim = () => {
    socket?.emit('active-hex', { hexId: null });
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
  };

  const currentQuestion = availableQuestions[currentQuestionIndex] || null;

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <header className="bg-[#1A1A2E] text-white p-4 shadow-md sticky top-0 z-20 flex justify-between items-center gap-4">
        <h1 className="text-xl font-bold shrink-0">Presenter View</h1>
        <button
          onClick={() => socket?.emit('toggle-splash', !store.showSplash)}
          className={`flex-1 max-w-xs py-2 px-4 rounded-lg font-bold text-sm transition-all ${
            store.showSplash
              ? 'bg-amber-500 text-white ring-2 ring-amber-300'
              : 'bg-gray-600 text-gray-200 hover:bg-gray-500'
          }`}
        >
          {store.showSplash ? '📷 Hide Splash' : '📷 Show Splash'}
        </button>
        <div className={`w-3 h-3 rounded-full shrink-0 ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
      </header>

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
                    className="py-4 bg-[#F3722C] text-white font-bold rounded-lg text-xl active:bg-orange-700"
                  >
                    Give to {store.teamNames.red}
                  </button>
                  <button
                    onClick={() => handleAward('blue')}
                    className="py-4 bg-[#4CAF50] text-white font-bold rounded-lg text-xl active:bg-green-700"
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
                      <label htmlFor="question-select" className="font-bold text-gray-700 whitespace-nowrap">Select Question:</label>
                      <select
                        id="question-select"
                        value={currentQuestionIndex}
                        onChange={(e) => setCurrentQuestionIndex(Number(e.target.value))}
                        className="p-2 border rounded-md w-full bg-gray-50 text-gray-800 focus:ring-indigo-500 focus:border-indigo-500"
                      >
                        {availableQuestions.map((q, idx) => (
                          <option key={q.id} value={idx}>
                            {idx + 1}. {q.question.substring(0, 50)}... | A: {q.answer.substring(0, 30)} ({q.difficulty})
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
                />
              </div>
            )}
          </section>
        )}

      </main>
    </div>
  );
}
