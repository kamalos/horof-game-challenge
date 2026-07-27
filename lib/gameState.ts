import { create } from 'zustand';

export type Team = 'red' | 'blue';
export type Language = 'fr' | 'ar';

export interface GameState {
  hexOwnership: Record<string, Team | null>;
  hexLetters: Record<string, string>;
  activeHexId: string | null;
  jokerStatus: { red: boolean; blue: boolean };
  teamNames: { red: string; blue: string };
  winner: Team | null;
  winningPath: string[];
  language: Language;
  showSplash: boolean;
}

export interface GameStore extends GameState {
  applyStateUpdate: (state: Partial<GameState>) => void;
  claimHex: (hexId: string, team: Team) => void;
  setActiveHex: (hexId: string | null) => void;
  setWinner: (team: Team, path: string[]) => void;
  reset: () => void;
}

const initialState: GameState = {
  hexOwnership: {},
  hexLetters: {},
  activeHexId: null,
  jokerStatus: { red: true, blue: true }, // true means available
  teamNames: { red: 'Team ORANGE', blue: 'Team GREEN' },
  winner: null,
  winningPath: [],
  language: 'ar',
  showSplash: false,
};

export const useGameStore = create<GameStore>((set) => ({
  ...initialState,

  applyStateUpdate: (state) => set((prev) => ({ ...prev, ...state })),

  claimHex: (hexId, team) =>
    set((state) => ({
      hexOwnership: { ...state.hexOwnership, [hexId]: team },
      activeHexId: null, // clear active after claim
    })),

  setActiveHex: (hexId) => set({ activeHexId: hexId }),

  setWinner: (team, path) => set({ winner: team, winningPath: path }),

  reset: () => set(initialState),
}));
