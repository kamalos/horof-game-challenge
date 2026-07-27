'use client';

import React, { useEffect, useState } from 'react';
import { useSocket } from '@/lib/socket';
import { useGameStore, Team } from '@/lib/gameState';
import { Question } from '@/lib/questions';
import { HexGrid } from '@/components/HexGrid';
import { v4 as uuidv4 } from 'uuid';

const CATEGORIES = [
  'Science', 'History', 'Geography', 'Sports', 'Entertainment',
  'Art', 'Food', 'Technology', 'Literature', 'General'
];

type Tab = 'questions' | 'setup';

export default function AdminPage() {
  const { socket, connected } = useSocket();
  const store = useGameStore();

  const [activeTab, setActiveTab] = useState<Tab>('questions');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [logs, setLogs] = useState<{ id: string; time: string; message: string }[]>([]);

  // Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<Partial<Question>>({
    question: '', answer: '', letter: '', category: 'General', difficulty: 'Easy'
  });

  // Filters
  const [filterLetter, setFilterLetter] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Bulk Import
  const [importJson, setImportJson] = useState<string>('');
  const [importSummary, setImportSummary] = useState<string | null>(null);

  // Setup State
  const [teamRedName, setTeamRedName] = useState('');
  const [teamBlueName, setTeamBlueName] = useState('');

  useEffect(() => {
    fetchQuestions();
  }, []);

  useEffect(() => {
    if (store.teamNames) {
      setTeamRedName(store.teamNames.red);
      setTeamBlueName(store.teamNames.blue);
    }
  }, [store.teamNames]);

  useEffect(() => {
    if (!socket) return;
    
    socket.emit('request-state');
    
    const addLog = (msg: string) => {
      setLogs((prev) => [{ id: uuidv4(), time: new Date().toLocaleTimeString(), message: msg }, ...prev]);
    };

    socket.on('state-update', (state) => {
      store.applyStateUpdate(state);
    });

    socket.on('hex-claimed', ({ hexId, team }) => addLog(`${team} claimed hex ${hexId}`));
    socket.on('joker-used', ({ team }) => addLog(`${team} used joker`));
    socket.on('show-winner', ({ team }) => addLog(`${team} wins the game!`));
    socket.on('game-reset', () => addLog(`Game was reset`));

    return () => {
      socket.off('state-update');
      socket.off('hex-claimed');
      socket.off('joker-used');
      socket.off('show-winner');
      socket.off('game-reset');
    };
  }, [socket, store.applyStateUpdate]);

  const fetchQuestions = async () => {
    const res = await fetch('/api/questions');
    const data = await res.json();
    setQuestions(data);
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'answer') {
      const firstChar = value.trim().charAt(0);
      const isLatin = /^[A-Za-z]$/.test(firstChar);
      const isArabic = /^[\u0600-\u06FF]$/.test(firstChar);
      const autoLetter = isLatin ? firstChar.toUpperCase() : isArabic ? firstChar : '';
      setFormValues((prev) => ({ ...prev, [name]: value, letter: autoLetter || prev.letter }));
    } else {
      setFormValues((prev) => ({ ...prev, [name]: value }));
    }
  };

  const saveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formValues.question || !formValues.answer) return;

    const payload = {
      ...formValues,
      id: editingId || uuidv4(),
      letter: formValues.letter || formValues.answer.charAt(0).toUpperCase()
    };

    const method = editingId ? 'PUT' : 'POST';
    const url = editingId ? `/api/questions/${editingId}` : '/api/questions';

    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    setFormValues({ question: '', answer: '', letter: '', category: 'General', difficulty: 'Easy' });
    setEditingId(null);
    fetchQuestions();
  };

  const editQuestion = (q: Question) => {
    setEditingId(q.id);
    setFormValues(q);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const deleteQuestion = async (id: string) => {
    if (confirm('Are you sure you want to delete this question?')) {
      await fetch(`/api/questions/${id}`, { method: 'DELETE' });
      fetchQuestions();
    }
  };

  const handleBulkImport = async () => {
    try {
      const parsed = JSON.parse(importJson);
      if (!Array.isArray(parsed)) throw new Error('Must be an array');
      
      let added = 0;
      for (const item of parsed) {
        if (item.question && item.answer) {
          const firstChar = (item.answer as string).charAt(0);
          const isLatin = /^[A-Za-z]$/.test(firstChar);
          const isArabic = /^[\u0600-\u06FF]$/.test(firstChar);
          const autoLetter = isLatin ? firstChar.toUpperCase() : isArabic ? firstChar : firstChar.toUpperCase();
          const payload = {
            id: item.id || uuidv4(),
            question: item.question,
            answer: item.answer,
            letter: item.letter || autoLetter,
            category: item.category || 'General',
            difficulty: item.difficulty || 'Easy'
          };
          await fetch('/api/questions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          added++;
        }
      }
      setImportSummary(`Successfully imported ${added} questions.`);
      setImportJson('');
      fetchQuestions();
    } catch (err) {
      setImportSummary(`Import failed: Invalid JSON format.`);
    }
  };

  const filteredQuestions = questions.filter((q) => {
    if (filterLetter && q.letter !== filterLetter) return false;
    if (filterCategory && q.category !== filterCategory) return false;
    if (searchQuery && !q.question.toLowerCase().includes(searchQuery.toLowerCase()) && !q.answer.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const letterCounts: Record<string, number> = {};
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').forEach((l) => letterCounts[l] = 0);
  questions.forEach((q) => {
    if (letterCounts[q.letter] !== undefined) letterCounts[q.letter]++;
  });

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <header className="bg-[#1A1A2E] text-white p-4 shadow-md flex justify-between items-center z-10">
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium">{connected ? 'Connected' : 'Disconnected'}</span>
          <div className={`w-3 h-3 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
        </div>
      </header>

      <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
        <aside className="w-full md:w-64 bg-white shadow-lg flex flex-row md:flex-col z-0 shrink-0">
          <button
            className={`flex-1 md:flex-none p-4 text-center md:text-left font-bold md:border-l-4 border-b-4 md:border-b-0 ${activeTab === 'questions' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-transparent text-gray-600 hover:bg-gray-50'}`}
            onClick={() => setActiveTab('questions')}
          >
            Questions
          </button>
          <button
            className={`flex-1 md:flex-none p-4 text-center md:text-left font-bold md:border-l-4 border-b-4 md:border-b-0 ${activeTab === 'setup' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-transparent text-gray-600 hover:bg-gray-50'}`}
            onClick={() => setActiveTab('setup')}
          >
            Game Setup
          </button>
        </aside>

        <main className="flex-1 p-4 md:p-8 overflow-y-auto max-h-[calc(100vh-120px)] md:max-h-[calc(100vh-64px)]">
          
          {activeTab === 'questions' && (
            <div className="space-y-8 max-w-5xl">
              
              <section className="bg-white p-6 rounded-xl shadow-md">
                <h2 className="text-xl font-bold mb-4">{editingId ? 'Edit Question' : 'Add Question'}</h2>
                <form onSubmit={saveQuestion} className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Question</label>
                    <textarea required name="question" value={formValues.question} onChange={handleFormChange} className="w-full border rounded p-2" rows={2} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">Answer</label>
                      <input required type="text" name="answer" value={formValues.answer} onChange={handleFormChange} className="w-full border rounded p-2" />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">Starting Letter</label>
                      <input type="text" name="letter" value={formValues.letter} onChange={handleFormChange} maxLength={4} className="w-20 border rounded p-2 font-bold text-center" dir="auto" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">Category</label>
                      <select name="category" value={formValues.category} onChange={handleFormChange} className="w-full border rounded p-2">
                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">Difficulty</label>
                      <div className="flex gap-4 pt-2">
                        {['Easy', 'Medium', 'Hard'].map((d) => (
                          <label key={d} className="flex items-center gap-1 cursor-pointer">
                            <input type="radio" name="difficulty" value={d} checked={formValues.difficulty === d} onChange={handleFormChange} />
                            <span>{d}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-4">
                    <button type="submit" className="px-6 py-2 bg-indigo-600 text-white font-bold rounded shadow hover:bg-indigo-700">Save</button>
                    {editingId && (
                      <button type="button" onClick={() => { setEditingId(null); setFormValues({ question: '', answer: '', letter: '', category: 'General', difficulty: 'Easy' }); }} className="px-6 py-2 bg-gray-200 text-gray-800 font-bold rounded shadow hover:bg-gray-300">Cancel</button>
                    )}
                  </div>
                </form>
              </section>

              <section className="bg-white p-6 rounded-xl shadow-md">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-4 gap-4 md:gap-0">
                  <h2 className="text-xl font-bold">Question List ({filteredQuestions.length})</h2>
                  <div className="flex flex-wrap gap-2">
                    <input type="text" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="border rounded px-3 py-1 text-sm w-full sm:w-auto" />
                    <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="border rounded px-3 py-1 text-sm flex-1 sm:flex-none">
                      <option value="">All Categories</option>
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <select value={filterLetter} onChange={(e) => setFilterLetter(e.target.value)} className="border rounded px-3 py-1 text-sm flex-1 sm:flex-none">
                      <option value="">All Letters</option>
                      {'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                </div>

                <div className="mb-4 flex flex-wrap gap-1">
                  {'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(l => {
                    const count = letterCounts[l];
                    const colorClass = count === 0 ? 'bg-red-100 text-red-800' : count < 3 ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800';
                    return (
                      <div key={l} className={`text-xs px-2 py-1 rounded font-bold cursor-pointer border ${colorClass} ${filterLetter === l ? 'ring-2 ring-indigo-500' : ''}`} onClick={() => setFilterLetter(filterLetter === l ? '' : l)}>
                        {l}: {count}
                      </div>
                    );
                  })}
                </div>

                <div className="overflow-x-auto max-h-96 overflow-y-auto border rounded">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-4 py-3">L</th>
                        <th className="px-4 py-3 w-1/3">Question</th>
                        <th className="px-4 py-3">Answer</th>
                        <th className="px-4 py-3">Category</th>
                        <th className="px-4 py-3">Diff</th>
                        <th className="px-4 py-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredQuestions.map((q) => (
                        <tr key={q.id} className="bg-white border-b hover:bg-gray-50">
                          <td className="px-4 py-3 font-bold">{q.letter}</td>
                          <td className="px-4 py-3 font-medium text-gray-900">{q.question}</td>
                          <td className="px-4 py-3">{q.answer}</td>
                          <td className="px-4 py-3">{q.category}</td>
                          <td className="px-4 py-3">{q.difficulty}</td>
                          <td className="px-4 py-3">
                            <button onClick={() => editQuestion(q)} className="font-medium text-indigo-600 hover:underline mr-3">Edit</button>
                            <button onClick={() => deleteQuestion(q.id)} className="font-medium text-red-600 hover:underline">Delete</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="bg-white p-6 rounded-xl shadow-md">
                <h2 className="text-xl font-bold mb-4">Bulk Import (JSON)</h2>
                <textarea
                  value={importJson}
                  onChange={(e) => setImportJson(e.target.value)}
                  className="w-full border rounded p-2 font-mono text-xs"
                  rows={4}
                  placeholder="[{ 'question': '...', 'answer': '...' }]"
                />
                <div className="mt-2 flex items-center gap-4">
                  <button onClick={handleBulkImport} className="px-4 py-2 bg-gray-800 text-white font-bold rounded shadow hover:bg-gray-900">Import</button>
                  {importSummary && <span className="text-sm font-bold text-green-600">{importSummary}</span>}
                </div>
              </section>
            </div>
          )}

          {activeTab === 'setup' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-8 max-w-5xl">
              
              <div className="space-y-4 md:space-y-8">
                <section className="bg-white p-6 rounded-xl shadow-md">
                  <h2 className="text-xl font-bold mb-4">Language / اللغة</h2>
                  <div className="flex gap-4">
                    <button
                      onClick={() => socket?.emit('set-language', { lang: 'fr' })}
                      className={`flex-1 py-3 font-bold rounded shadow text-lg transition-all ${
                        store.language === 'fr'
                          ? 'bg-indigo-600 text-white ring-2 ring-indigo-400'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      🇫🇷 Français (A–Z)
                    </button>
                    <button
                      onClick={() => socket?.emit('set-language', { lang: 'ar' })}
                      className={`flex-1 py-3 font-bold rounded shadow text-lg transition-all ${
                        store.language === 'ar'
                          ? 'bg-amber-500 text-white ring-2 ring-amber-300'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      🇸🇦 العربية (أ–ي)
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Switching language reshuffles the hex board with the new alphabet. Make sure to also have matching questions in the database.
                  </p>
                </section>

                <section className="bg-white p-6 rounded-xl shadow-md">
                  <h2 className="text-xl font-bold mb-4">Board Configuration</h2>
                  <div className="flex gap-4 mb-6">
                    <button
                      onClick={() => { if (confirm('Clear claims and shuffle letters?')) socket?.emit('game-reset', { keepLetters: false }) }}
                      className="flex-1 py-3 bg-red-600 text-white font-bold rounded shadow hover:bg-red-700"
                    >
                      Randomize Letters (New Game)
                    </button>
                    <button
                      onClick={() => { if (confirm('Clear claims but KEEP letters?')) socket?.emit('game-reset', { keepLetters: true }) }}
                      className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded shadow hover:bg-indigo-700"
                    >
                      Reset Game (Keep Letters)
                    </button>
                  </div>
                  
                  <div className="border rounded p-4 bg-gray-50 flex justify-center">
                    <div className="scale-[0.5] origin-top">
                      <HexGrid
                        hexOwnership={store.hexOwnership}
                        hexLetters={store.hexLetters}
                        activeHexId={null}
                        winningPath={[]}
                        hexSize={60}
                      />
                    </div>
                  </div>
                </section>

                <section className="bg-white p-6 rounded-xl shadow-md">
                  <h2 className="text-xl font-bold mb-4">Display Controls</h2>
                  <div className="flex gap-4">
                    <button
                      onClick={() => socket?.emit('toggle-splash', !store.showSplash)}
                      className={`flex-1 py-3 font-bold rounded shadow transition-all ${
                        store.showSplash 
                          ? 'bg-amber-500 text-white ring-2 ring-amber-300' 
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {store.showSplash ? 'Hide Splash Screen' : 'Show Splash Screen'}
                    </button>
                  </div>
                </section>

                <section className="bg-white p-6 rounded-xl shadow-md">
                  <h2 className="text-xl font-bold mb-4">Team Settings</h2>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">Team ORANGE Name</label>
                      <input type="text" value={teamRedName} onChange={(e) => setTeamRedName(e.target.value)} className="w-full border border-orange-300 rounded p-2 focus:ring-orange-500 focus:border-orange-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">Team GREEN Name</label>
                      <input type="text" value={teamBlueName} onChange={(e) => setTeamBlueName(e.target.value)} className="w-full border border-green-300 rounded p-2 focus:ring-green-500 focus:border-green-500" />
                    </div>
                    <button
                      onClick={() => socket?.emit('update-team-names', { red: teamRedName, blue: teamBlueName })}
                      className="w-full py-2 bg-gray-800 text-white font-bold rounded shadow hover:bg-gray-900"
                    >
                      Save Team Names
                    </button>
                  </div>
                </section>

                <section className="bg-white p-6 rounded-xl shadow-md">
                  <h2 className="text-xl font-bold mb-4">Joker Management</h2>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="border border-orange-200 bg-orange-50 p-4 rounded-lg flex flex-col items-center">
                      <span className="font-bold text-orange-800 mb-2">Orange Joker</span>
                      <span className={`text-sm font-bold mb-4 ${store.jokerStatus.red ? 'text-green-600' : 'text-gray-500'}`}>
                        {store.jokerStatus.red ? 'Available' : 'Used'}
                      </span>
                      <button
                        onClick={() => socket?.emit('joker-restore', { team: 'red' })}
                        className="px-4 py-1 bg-orange-600 text-white text-sm font-bold rounded shadow"
                      >
                        Restore
                      </button>
                    </div>
                    <div className="border border-green-200 bg-green-50 p-4 rounded-lg flex flex-col items-center">
                      <span className="font-bold text-green-800 mb-2">Green Joker</span>
                      <span className={`text-sm font-bold mb-4 ${store.jokerStatus.blue ? 'text-green-600' : 'text-gray-500'}`}>
                        {store.jokerStatus.blue ? 'Available' : 'Used'}
                      </span>
                      <button
                        onClick={() => socket?.emit('joker-restore', { team: 'blue' })}
                        className="px-4 py-1 bg-green-600 text-white text-sm font-bold rounded shadow"
                      >
                        Restore
                      </button>
                    </div>
                  </div>
                </section>
              </div>

              <div>
                <section className="bg-white p-6 rounded-xl shadow-md h-full flex flex-col">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold">Match Log</h2>
                    <button onClick={() => setLogs([])} className="text-sm text-gray-500 hover:text-gray-800 font-bold">Clear</button>
                  </div>
                  <div className="flex-1 overflow-y-auto border rounded p-4 bg-gray-50 space-y-2">
                    {logs.map((log) => (
                      <div key={log.id} className="text-sm">
                        <span className="text-gray-400 mr-2">[{log.time}]</span>
                        <span className="font-medium text-gray-800">{log.message}</span>
                      </div>
                    ))}
                    {logs.length === 0 && <p className="text-gray-400 text-center italic mt-10">No events yet.</p>}
                  </div>
                </section>
              </div>

            </div>
          )}

        </main>
      </div>
    </div>
  );
}
