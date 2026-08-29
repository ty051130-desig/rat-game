const DIRECTIONS = ['N', 'E', 'S', 'W'];

export const DIR_DELTA = {
  N: { dr: -1, dc: 0 },
  E: { dr: 0, dc: 1 },
  S: { dr: 1, dc: 0 },
  W: { dr: 0, dc: -1 }
};

export function turnLeft(dir) {
  return DIRECTIONS[(DIRECTIONS.indexOf(dir) + 3) % 4];
}

export function turnRight(dir) {
  return DIRECTIONS[(DIRECTIONS.indexOf(dir) + 1) % 4];
}

export function directionFromStep(from, to) {
  const dr = to.row - from.row;
  const dc = to.col - from.col;
  if (dr === -1 && dc === 0) return 'N';
  if (dr === 1 && dc === 0) return 'S';
  if (dr === 0 && dc === 1) return 'E';
  if (dr === 0 && dc === -1) return 'W';
  return null;
}

// BFS on (cell + facing). A rat may go forward, turn left, or turn right,
// but may not reverse 180 degrees in one decision.
export function findPath(stage, startCell, startFacing, goalCell) {
  if (!startCell || !goalCell) return [];
  if (startCell.row === goalCell.row && startCell.col === goalCell.col) return [startCell];

  const queue = [{ cell: startCell, facing: startFacing }];
  let head = 0;
  const startKey = key(startCell, startFacing);
  const visited = new Set([startKey]);
  const parent = new Map();
  let goalStateKey = null;

  while (head < queue.length) {
    const current = queue[head++];
    const candidates = [
      current.facing,
      turnLeft(current.facing),
      turnRight(current.facing)
    ];

    for (const nextFacing of candidates) {
      const d = DIR_DELTA[nextFacing];
      const nextCell = {
        row: current.cell.row + d.dr,
        col: current.cell.col + d.dc
      };

      if (!stage.isWalkableCell(nextCell.row, nextCell.col)) continue;

      const nextKey = key(nextCell, nextFacing);
      if (visited.has(nextKey)) continue;

      visited.add(nextKey);
      parent.set(nextKey, {
        prevKey: key(current.cell, current.facing),
        cell: nextCell,
        facing: nextFacing
      });

      if (nextCell.row === goalCell.row && nextCell.col === goalCell.col) {
        goalStateKey = nextKey;
        queue.length = 0;
        break;
      }

      queue.push({ cell: nextCell, facing: nextFacing });
    }
  }

  if (!goalStateKey) return [startCell];

  const reversed = [];
  let cursor = goalStateKey;
  while (cursor !== startKey) {
    const info = parent.get(cursor);
    if (!info) break;
    reversed.push(info.cell);
    cursor = info.prevKey;
  }

  reversed.push(startCell);
  reversed.reverse();
  return reversed;
}

function key(cell, facing) {
  return `${cell.row},${cell.col},${facing}`;
}
