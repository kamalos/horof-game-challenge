import React, { useState } from 'react';
import { Team } from '@/lib/gameState';

const CATEGORIES = [
  'Science',
  'History',
  'Geography',
  'Sports',
  'Entertainment',
  'Art',
  'Food',
  'Technology',
  'Literature',
  'General',
];

interface JokerButtonProps {
  team: Team;
  teamName: string;
  isAvailable: boolean;
  onUseJoker: (category: string) => void;
}

export const JokerButton: React.FC<JokerButtonProps> = ({
  team,
  teamName,
  isAvailable,
  onUseJoker,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [customDomain, setCustomDomain] = useState('');

  const handleUse = () => {
    if (isAvailable) {
      setShowModal(true);
    }
  };

  const selectCategory = (cat: string) => {
    onUseJoker(cat);
    setShowModal(false);
  };

  const bgColor = team === 'red' ? 'bg-[#F3722C]' : 'bg-[#4CAF50]';
  const hoverColor = team === 'red' ? 'active:bg-orange-700' : 'active:bg-green-700';
  const textColor = team === 'red' ? 'text-[#F3722C]' : 'text-[#4CAF50]';

  return (
    <>
      <div className="bg-white rounded-xl shadow-md p-4 flex flex-col items-center flex-1">
        <h3 className={`text-xl font-black mb-3 ${textColor}`}>{teamName}</h3>
        <button
          onClick={handleUse}
          disabled={!isAvailable}
          className={`w-full py-3 rounded-lg font-bold text-white transition-opacity ${
            isAvailable ? `${bgColor} ${hoverColor}` : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          {isAvailable ? 'USE JOKER' : 'JOKER USED'}
        </button>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md p-6 max-h-[80vh] overflow-y-auto slide-up">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800">
                Pick Category ({teamName})
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 text-gray-500 hover:text-gray-800 font-bold"
              >
                ✕
              </button>
            </div>
            
            <div className="grid grid-cols-2 gap-3 mb-6">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => selectCategory(cat)}
                  className={`py-4 rounded-xl font-bold text-lg text-white ${bgColor} ${hoverColor}`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="border-t pt-6">
              <h3 className="text-lg font-bold text-gray-800 mb-3">Or use a Custom Domain</h3>
              <div className="flex flex-col gap-3">
                <input
                  type="text"
                  placeholder="e.g. Space Exploration, 90s Music..."
                  value={customDomain}
                  onChange={(e) => setCustomDomain(e.target.value)}
                  className="w-full border rounded-lg p-3 text-gray-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                <button
                  onClick={() => {
                    if (customDomain.trim()) {
                      selectCategory(customDomain.trim());
                      setCustomDomain('');
                    }
                  }}
                  disabled={!customDomain.trim()}
                  className={`w-full py-3 rounded-lg font-bold text-white transition-opacity ${
                    customDomain.trim() ? `${bgColor} ${hoverColor}` : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  Use Custom Domain
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
