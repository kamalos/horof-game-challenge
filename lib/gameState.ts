import { create } from 'zustand';

export type Team = 'red' | 'blue';
export type Language = 'fr' | 'ar';

export interface BuzzerState {
  enabled: boolean;
  buzzedTeam: Team | null;
  buzzedAt: number | null;
  tokens: { red: string; blue: string };
  connectedDevices: { red: boolean; blue: boolean };
}

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
  buzzerState: BuzzerState;
  localIPs: { ip: string; name: string }[];
}

export interface GameStore extends GameState {
  applyStateUpdate: (state: Partial<GameState>) => void;
  claimHex: (hexId: string, team: Team) => void;
  setActiveHex: (hexId: string | null) => void;
  setWinner: (team: Team, path: string[]) => void;
  updateBuzzer: (buzzer: Partial<BuzzerState>) => void;
  reset: () => void;
}

const initialBuzzerState: BuzzerState = {
  enabled: true,
  buzzedTeam: null,
  buzzedAt: null,
  tokens: { red: '', blue: '' },
  connectedDevices: { red: false, blue: false },
};

const initialState: GameState = {
  hexOwnership: {},
  hexLetters: {},
  activeHexId: null,
  jokerStatus: { red: true, blue: true }, // true means available
  teamNames: { red: 'Team RED', blue: 'Team BLUE' },
  winner: null,
  winningPath: [],
  language: 'ar',
  showSplash: false,
  buzzerState: initialBuzzerState,
  localIPs: [],
};

export const useGameStore = create<GameStore>((set) => ({
  ...initialState,

  applyStateUpdate: (state) =>
    set((prev) => {
      const next = { ...prev, ...state };
      if (state.buzzerState) {
        next.buzzerState = { ...prev.buzzerState, ...state.buzzerState };
      }
      return next;
    }),

  claimHex: (hexId, team) =>
    set((state) => ({
      hexOwnership: { ...state.hexOwnership, [hexId]: team },
      activeHexId: null, // clear active after claim
    })),

  setActiveHex: (hexId) => set({ activeHexId: hexId }),

  setWinner: (team, path) => set({ winner: team, winningPath: path }),

  updateBuzzer: (buzzer) =>
    set((state) => ({
      buzzerState: { ...state.buzzerState, ...buzzer },
    })),

  reset: () => set(initialState),
}));
