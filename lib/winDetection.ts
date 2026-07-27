import { getEdgeHexes, getNeighbors } from './hexLayout';

export type Team = 'red' | 'blue';

export function checkWin(hexOwnership: Record<string, Team | null>): { winner: Team | null; path: string[] } {
  // Check RED (Left to Right)
  const redResult = bfsWinCheck('red', 'left', 'right', hexOwnership);
  if (redResult.winner) return redResult;

  // Check BLUE (Top to Bottom)
  const blueResult = bfsWinCheck('blue', 'top', 'bottom', hexOwnership);
  if (blueResult.winner) return blueResult;

  return { winner: null, path: [] };
}

function bfsWinCheck(
  team: Team,
  startEdge: 'left' | 'top',
  endEdge: 'right' | 'bottom',
  hexOwnership: Record<string, Team | null>
): { winner: Team | null; path: string[] } {
  const startNodes = getEdgeHexes(startEdge).filter((id) => hexOwnership[id] === team);
  const endNodes = new Set(getEdgeHexes(endEdge).filter((id) => hexOwnership[id] === team));

  if (startNodes.length === 0 || endNodes.size === 0) {
    return { winner: null, path: [] };
  }

  const queue: string[] = [...startNodes];
  const cameFrom = new Map<string, string | null>();
  const visited = new Set<string>();

  startNodes.forEach((node) => {
    cameFrom.set(node, null);
    visited.add(node);
  });

  while (queue.length > 0) {
    const current = queue.shift()!;

    if (endNodes.has(current)) {
      // Reconstruct path
      const path: string[] = [];
      let curr: string | null = current;
      while (curr !== null) {
        path.push(curr);
        curr = cameFrom.get(curr) || null;
      }
      return { winner: team, path: path.reverse() };
    }

    const neighbors = getNeighbors(current);
    for (const neighbor of neighbors) {
      if (hexOwnership[neighbor] === team && !visited.has(neighbor)) {
        visited.add(neighbor);
        cameFrom.set(neighbor, current);
        queue.push(neighbor);
      }
    }
  }

  return { winner: null, path: [] };
}
