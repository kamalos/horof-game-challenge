import React, { useState, useEffect } from 'react';
import { Question } from '@/lib/questions';
import { Team } from '@/lib/gameState';

interface QuestionCardProps {
  letter: string;
  question: Question | null;
  onAward: (team: Team) => void;
  onNoClaim: () => void;
  teamNames: { red: string; blue: string };
  onGenerateAI?: () => void;
  isGeneratingAI?: boolean;
}

export const QuestionCard: React.FC<QuestionCardProps> = ({
  letter,
  question,
  onAward,
  onNoClaim,
  teamNames,
  onGenerateAI,
  isGeneratingAI,
}) => {
  const [showAnswer, setShowAnswer] = useState(false);

  useEffect(() => {
    setShowAnswer(false);
  }, [question]);

  if (!question) {
    return (
      <div className="bg-white p-6 rounded-xl shadow-lg w-full flex flex-col items-center text-center">
        <div className="text-6xl font-bold text-gray-800 mb-4">{letter}</div>
        <p className="text-xl text-red-500 mb-6">No question available for this letter/category.</p>
        
        {onGenerateAI && (
          <button
            onClick={onGenerateAI}
            disabled={isGeneratingAI}
            className={`w-full py-4 mb-4 font-bold rounded-lg text-lg text-white transition-all ${
              isGeneratingAI ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800'
            }`}
          >
            {isGeneratingAI ? (
              <span className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Generating...
              </span>
            ) : (
              '✨ Generate AI Question'
            )}
          </button>
        )}

        <button
          onClick={onNoClaim}
          className="w-full py-4 bg-gray-200 text-gray-800 font-bold rounded-lg text-lg hover:bg-gray-300"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-xl shadow-lg w-full flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <div className="text-5xl font-black text-gray-800">{letter}</div>
        <div className="flex flex-col items-end gap-1">
          <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-semibold">
            {question.category}
          </span>
          <span
            className={`px-3 py-1 rounded-full text-sm font-semibold ${
              question.difficulty === 'Easy'
                ? 'bg-green-100 text-green-800'
                : question.difficulty === 'Medium'
                ? 'bg-yellow-100 text-yellow-800'
                : 'bg-red-100 text-red-800'
            }`}
          >
            {question.difficulty}
          </span>
        </div>
      </div>

      <div className="text-2xl font-medium text-gray-900 mb-8 min-h-[100px]" dir="auto">
        {question.question}
      </div>

      {!showAnswer ? (
        <div className="mt-auto flex flex-col gap-4">
          <button
            onClick={() => setShowAnswer(true)}
            className="w-full py-4 bg-indigo-600 text-white font-bold rounded-lg text-xl active:bg-indigo-700"
          >
            Show Answer
          </button>
          <button
            onClick={onNoClaim}
            className="w-full py-3 bg-gray-100 text-gray-600 font-bold rounded-lg text-lg active:bg-gray-200"
          >
            Cancel
          </button>
        </div>
      ) : (
        <div className="mt-auto flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4">
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg mb-2">
            <div className="text-sm text-green-800 font-bold mb-1">ANSWER:</div>
            <div className="text-3xl font-bold text-green-900" dir="auto">{question.answer}</div>
          </div>

          <button
            onClick={() => setShowAnswer(false)}
            className="w-full py-3 bg-amber-100 text-amber-800 font-bold rounded-lg text-lg border border-amber-300 active:bg-amber-200"
          >
            Hide Answer
          </button>

          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => onAward('red')}
              className="py-4 bg-[#F3722C] text-white font-bold rounded-lg text-xl active:bg-orange-700"
            >
              Award {teamNames.red}
            </button>
            <button
              onClick={() => onAward('blue')}
              className="py-4 bg-[#4CAF50] text-white font-bold rounded-lg text-xl active:bg-green-700"
            >
              Award {teamNames.blue}
            </button>
          </div>
          <button
            onClick={onNoClaim}
            className="w-full py-3 bg-gray-200 text-gray-800 font-bold rounded-lg text-lg active:bg-gray-300"
          >
            No Claim (Wrong / Pass)
          </button>
        </div>
      )}
    </div>
  );
};
