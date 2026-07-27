export const ROW_LENGTHS = [5, 6, 5, 6, 5];

export interface HexNode {
  id: string;
  r: number;
  c: number;
}

export const HEX_IDS: string[] = [];
const hexNodes: Map<string, HexNode> = new Map();

for (let r = 0; r < ROW_LENGTHS.length; r++) {
  for (let c = 0; c < ROW_LENGTHS[r]; c++) {
    const id = `r${r}c${c}`;
    HEX_IDS.push(id);
    hexNodes.set(id, { id, r, c });
  }
}

export function getNeighbors(hexId: string): string[] {
  const node = hexNodes.get(hexId);
  if (!node) return [];

  const { r, c } = node;
  const neighbors: { r: number; c: number }[] = [
    { r, c: c - 1 },
    { r, c: c + 1 },
  ];

  if (r % 2 === 0) {
    // Even row (length 5)
    neighbors.push(
      { r: r - 1, c },
      { r: r - 1, c: c + 1 },
      { r: r + 1, c },
      { r: r + 1, c: c + 1 }
    );
  } else {
    // Odd row (length 6)
    neighbors.push(
      { r: r - 1, c: c - 1 },
      { r: r - 1, c },
      { r: r + 1, c: c - 1 },
      { r: r + 1, c }
    );
  }

  return neighbors
    .map((n) => `r${n.r}c${n.c}`)
    .filter((id) => hexNodes.has(id));
}

export function getEdgeHexes(side: 'left' | 'right' | 'top' | 'bottom'): string[] {
  switch (side) {
    case 'left':
      return HEX_IDS.filter((id) => hexNodes.get(id)!.c === 0);
    case 'right':
      return HEX_IDS.filter((id) => {
        const node = hexNodes.get(id)!;
        return node.c === ROW_LENGTHS[node.r] - 1;
      });
    case 'top':
      return HEX_IDS.filter((id) => hexNodes.get(id)!.r === 0);
    case 'bottom':
      return HEX_IDS.filter((id) => hexNodes.get(id)!.r === ROW_LENGTHS.length - 1);
  }
}

export const ARABIC_ALPHABET = ['ا', 'ب', 'ت', 'ث', 'ج', 'ح', 'خ', 'د', 'ذ', 'ر', 'ز', 'س', 'ش', 'ص', 'ض', 'ط', 'ظ', 'ع', 'غ', 'ف', 'ق', 'ك', 'ل', 'م', 'ن', 'و', 'ي', 'هـ'];

export type Language = 'fr' | 'ar';

export function getRandomLetters(language: Language = 'ar'): Record<string, string> {
  const alphabet = language === 'ar'
    ? ARABIC_ALPHABET
    : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  // We have 28 Arabic letters but only 27 cells, so drop one random; for English we add one extra
  let letters: string[];
  if (language === 'ar') {
    // Drop one random letter from the 28-letter Arabic alphabet
    const dropIndex = Math.floor(Math.random() * alphabet.length);
    letters = alphabet.filter((_, i) => i !== dropIndex);
  } else {
    // Duplicate one random letter so we have 27
    const extraLetter = alphabet[Math.floor(Math.random() * alphabet.length)];
    letters = [...alphabet, extraLetter];
  }

  // Shuffle
  for (let i = letters.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [letters[i], letters[j]] = [letters[j], letters[i]];
  }

  const hexLetters: Record<string, string> = {};
  HEX_IDS.forEach((id, index) => {
    hexLetters[id] = letters[index];
  });

  return hexLetters;
}
